const express = require('express');
const router  = express.Router();
const { query } = require('../database/db');

function daysLeft(deadline) {
    const d = new Date(deadline); d.setHours(0,0,0,0);
    const t = new Date();          t.setHours(0,0,0,0);
    return Math.round((d - t) / 86400000);
}

function fmtDate(iso) {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' });
}

const PRIO = { high: 'Hoog', mid: 'Middel', low: 'Laag' };

router.get('/data', async (req, res) => {
    try {
        const uid = req.userId;

        const [vandaagRes, deadlineRes, morgenRes, tweeminRes, subtaskRes] = await Promise.all([
            query(`SELECT * FROM tasks
                   WHERE user_id = $1 AND completed = false
                     AND (DATE(deadline) = CURRENT_DATE OR focus = true)
                   ORDER BY focus DESC, deadline NULLS LAST`, [uid]),

            query(`SELECT * FROM tasks
                   WHERE user_id = $1 AND completed = false
                     AND deadline IS NOT NULL
                     AND DATE(deadline) BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '4 days'
                   ORDER BY deadline`, [uid]),

            query(`SELECT * FROM tasks
                   WHERE user_id = $1 AND completed = false
                     AND DATE(deadline) = CURRENT_DATE + INTERVAL '1 day'
                   ORDER BY deadline`, [uid]),

            query(`SELECT id, title, priority, context
                   FROM tasks
                   WHERE user_id = $1 AND completed = false
                     AND tijd_minuten IS NOT NULL AND tijd_minuten <= 2
                   ORDER BY
                     CASE priority WHEN 'high' THEN 1 WHEN 'mid' THEN 2 ELSE 3 END,
                     title`, [uid]),

            query(`SELECT * FROM subtasks
                   WHERE task_id IN (
                     SELECT id FROM tasks WHERE user_id = $1 AND completed = false
                   )`, [uid]),
        ]);

        const subsById = {};
        subtaskRes.rows.forEach(s => {
            if (!subsById[s.task_id]) subsById[s.task_id] = [];
            subsById[s.task_id].push(s);
        });

        const taken_vandaag = vandaagRes.rows.map(t => ({
            id:         t.id,
            titel:      t.title,
            prioriteit: PRIO[t.priority] || 'Middel',
            priority:   t.priority || 'mid',
            context:    t.context || '',
            energie:    t.energie || '',
            tijd:       t.tijd_minuten || null,
            completed:  t.completed,
            subtaken:   (subsById[t.id] || []).map(s => ({
                id:     s.id,
                tekst:  s.text,
                gedaan: s.completed,
            })),
        }));

        const deadline_taken = deadlineRes.rows.map(t => {
            const dlStr = new Date(t.deadline).toISOString().slice(0, 10);
            const days = daysLeft(dlStr);
            return {
                id:           t.id,
                titel:        t.title,
                deadline_str: fmtDate(dlStr),
                days,
                urgentie:     days <= 0 ? 'vandaag' : days === 1 ? 'morgen' : 'binnenkort',
                detail:       t.description || '',
                subtaken:     (subsById[t.id] || []).map(s => ({
                    id:     s.id,
                    tekst:  s.text,
                    gedaan: s.completed,
                })),
            };
        });

        const taken_morgen = morgenRes.rows.map(t => ({
            id:         t.id,
            titel:      t.title,
            prioriteit: PRIO[t.priority] || 'Middel',
            priority:   t.priority || 'mid',
            context:    t.context || '',
            detail:     t.description || '',
            subtaken:   (subsById[t.id] || []).filter(s => !s.completed).map(s => ({
                id:    s.id,
                tekst: s.text,
                gedaan: false,
            })),
        }));

        const twee_min = tweeminRes.rows.map(t => ({
            id:       t.id,
            titel:    t.title,
            priority: t.priority || 'mid',
            context:  t.context || '',
        }));

        res.json({ datum: new Date().toISOString().slice(0, 10), taken_vandaag, deadline_taken, taken_morgen, twee_min });

    } catch (e) {
        console.error('Dagplanner data error:', e);
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;

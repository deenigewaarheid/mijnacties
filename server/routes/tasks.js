const express = require('express');
const router = express.Router();
const { query, transaction } = require('../database/db');

// Subtask JSON fragment reused in all SELECT queries (now includes deadline)
const SUBTASK_AGG = `
    COALESCE(json_agg(
        json_build_object(
            'id', s.id,
            'text', s.text,
            'completed', s.completed,
            'position', s.position,
            'deadline', s.deadline,
            'tijd_minuten', s.tijd_minuten,
            'priority', s.priority,
            'category', s.category,
            'context', s.context,
            'energie', s.energie
        ) ORDER BY s.position
    ) FILTER (WHERE s.id IS NOT NULL), '[]') as subtasks`;

/**
 * GET /api/tasks
 */
router.get('/', async (req, res) => {
    try {
        const userId = req.userId;
        const { completed, category, priority, search } = req.query;

        let sql = `SELECT t.*, ${SUBTASK_AGG} FROM tasks t LEFT JOIN subtasks s ON t.id = s.task_id WHERE t.user_id = $1`;
        const params = [userId];
        let paramIndex = 2;

        if (completed !== undefined) { sql += ` AND t.completed = $${paramIndex}`; params.push(completed === 'true'); paramIndex++; }
        if (category)  { sql += ` AND t.category = $${paramIndex}`;  params.push(category);  paramIndex++; }
        if (priority)  { sql += ` AND t.priority = $${paramIndex}`;  params.push(priority);  paramIndex++; }
        if (search)    { sql += ` AND (t.title ILIKE $${paramIndex} OR t.description ILIKE $${paramIndex})`; params.push(`%${search}%`); paramIndex++; }

        sql += ' GROUP BY t.id ORDER BY t.deadline ASC NULLS LAST, t.created_at DESC';

        const result = await query(sql, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Get tasks error:', error);
        res.status(500).json({ error: 'Taken ophalen mislukt' });
    }
});

/**
 * GET /api/tasks/today
 * Tasks where task deadline = today OR any incomplete subtask deadline = today
 */
router.get('/today', async (req, res) => {
    try {
        const userId = req.userId;
        const result = await query(
            `SELECT t.*, ${SUBTASK_AGG}
             FROM tasks t LEFT JOIN subtasks s ON t.id = s.task_id
             WHERE t.user_id = $1
               AND t.completed = false
               AND (
                 DATE(t.deadline) = CURRENT_DATE
                 OR EXISTS (
                   SELECT 1 FROM subtasks s2
                   WHERE s2.task_id = t.id AND s2.completed = false AND DATE(s2.deadline) = CURRENT_DATE
                 )
               )
             GROUP BY t.id
             ORDER BY t.deadline ASC NULLS LAST, t.created_at DESC`,
            [userId]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Get today tasks error:', error);
        res.status(500).json({ error: 'Taken voor vandaag ophalen mislukt' });
    }
});

/**
 * GET /api/tasks/week
 * Tasks where task deadline is this week OR any incomplete subtask deadline is this week
 */
router.get('/week', async (req, res) => {
    try {
        const userId = req.userId;
        const result = await query(
            `SELECT t.*, ${SUBTASK_AGG}
             FROM tasks t LEFT JOIN subtasks s ON t.id = s.task_id
             WHERE t.user_id = $1
               AND t.completed = false
               AND (
                 (t.deadline IS NOT NULL AND t.deadline < DATE_TRUNC('week', CURRENT_DATE) + INTERVAL '7 days')
                 OR EXISTS (
                   SELECT 1 FROM subtasks s2
                   WHERE s2.task_id = t.id AND s2.completed = false
                     AND s2.deadline IS NOT NULL
                     AND s2.deadline < DATE_TRUNC('week', CURRENT_DATE) + INTERVAL '7 days'
                 )
               )
             GROUP BY t.id
             ORDER BY t.deadline ASC NULLS LAST, t.created_at DESC`,
            [userId]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Get week tasks error:', error);
        res.status(500).json({ error: 'Taken voor deze week ophalen mislukt' });
    }
});

/**
 * POST /api/tasks
 */
router.post('/', async (req, res) => {
    try {
        const userId = req.userId;
        const { title, description, deadline, priority, category, subtasks, context, energie, tijd_minuten, bestemming, focus, belangrijk } = req.body;
        if (!title) return res.status(400).json({ error: 'Titel verplicht' });

        await transaction(async (client) => {
            const taskResult = await client.query(
                `INSERT INTO tasks (user_id, title, description, deadline, priority, category, context, energie, tijd_minuten, bestemming, focus, belangrijk)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
                [userId, title, description || null, deadline || null, priority || 'mid', category || 'werk', context || null, energie || null, tijd_minuten || null, bestemming || null, focus || false, belangrijk || false]
            );
            const task = taskResult.rows[0];

            if (subtasks && subtasks.length > 0) {
                for (let i = 0; i < subtasks.length; i++) {
                    await client.query(
                        'INSERT INTO subtasks (task_id, text, position) VALUES ($1, $2, $3)',
                        [task.id, subtasks[i], i]
                    );
                }
            }
            res.status(201).json(task);
        });
    } catch (error) {
        console.error('Create task error:', error);
        res.status(500).json({ error: 'Taak aanmaken mislukt' });
    }
});

/**
 * PATCH /api/tasks/:id
 */
router.patch('/:id', async (req, res) => {
    try {
        const userId = req.userId;
        const taskId = req.params.id;
        const updates = req.body;

        const allowedFields = ['title', 'description', 'deadline', 'priority', 'category', 'completed', 'context', 'energie', 'tijd_minuten', 'bestemming', 'focus', 'belangrijk'];
        const updateFields = [];
        const values = [taskId, userId];
        let paramIndex = 3;

        for (const [key, value] of Object.entries(updates)) {
            if (allowedFields.includes(key)) {
                updateFields.push(`${key} = $${paramIndex}`);
                values.push(value);
                paramIndex++;
            }
        }

        if (updateFields.length === 0) return res.status(400).json({ error: 'Geen geldige velden om te updaten' });
        if (updates.completed === true) updateFields.push(`completed_at = NOW()`);
        updateFields.push('updated_at = NOW()');

        const result = await query(
            `UPDATE tasks SET ${updateFields.join(', ')} WHERE id = $1 AND user_id = $2 RETURNING *`,
            values
        );

        if (result.rows.length === 0) return res.status(404).json({ error: 'Taak niet gevonden' });
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update task error:', error);
        res.status(500).json({ error: 'Taak updaten mislukt' });
    }
});

/**
 * DELETE /api/tasks/:id
 */
router.delete('/:id', async (req, res) => {
    try {
        const userId = req.userId;
        const taskId = req.params.id;
        const result = await query('DELETE FROM tasks WHERE id = $1 AND user_id = $2 RETURNING id', [taskId, userId]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Taak niet gevonden' });
        res.json({ success: true });
    } catch (error) {
        console.error('Delete task error:', error);
        res.status(500).json({ error: 'Taak verwijderen mislukt' });
    }
});

/**
 * POST /api/tasks/:id/subtasks
 */
router.post('/:id/subtasks', async (req, res) => {
    try {
        const userId = req.userId;
        const taskId = req.params.id;
        const { text, deadline } = req.body;

        if (!text) return res.status(400).json({ error: 'Tekst verplicht' });

        const taskCheck = await query('SELECT id FROM tasks WHERE id = $1 AND user_id = $2', [taskId, userId]);
        if (taskCheck.rows.length === 0) return res.status(404).json({ error: 'Taak niet gevonden' });

        const posResult = await query(
            'SELECT COALESCE(MAX(position), -1) + 1 as next_position FROM subtasks WHERE task_id = $1',
            [taskId]
        );
        const position = posResult.rows[0].next_position;

        const result = await query(
            'INSERT INTO subtasks (task_id, text, position, deadline) VALUES ($1, $2, $3, $4) RETURNING *',
            [taskId, text, position, deadline || null]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Create subtask error:', error);
        res.status(500).json({ error: 'Subtaak aanmaken mislukt' });
    }
});

/**
 * PATCH /api/tasks/:taskId/subtasks/:subtaskId
 */
router.patch('/:taskId/subtasks/:subtaskId', async (req, res) => {
    try {
        const userId = req.userId;
        const { taskId, subtaskId } = req.params;
        const { completed, text, deadline, tijd_minuten, priority, category, context, energie } = req.body;

        const taskCheck = await query('SELECT id FROM tasks WHERE id = $1 AND user_id = $2', [taskId, userId]);
        if (taskCheck.rows.length === 0) return res.status(404).json({ error: 'Taak niet gevonden' });

        const updates = [];
        const values = [subtaskId, taskId];
        let paramIndex = 3;

        if (completed !== undefined)     { updates.push(`completed = $${paramIndex}`);     values.push(completed);            paramIndex++; }
        if (text !== undefined)          { updates.push(`text = $${paramIndex}`);           values.push(text);                 paramIndex++; }
        if (deadline !== undefined)      { updates.push(`deadline = $${paramIndex}`);       values.push(deadline || null);     paramIndex++; }
        if (tijd_minuten !== undefined)  { updates.push(`tijd_minuten = $${paramIndex}`);   values.push(tijd_minuten || null); paramIndex++; }
        if (priority !== undefined)      { updates.push(`priority = $${paramIndex}`);       values.push(priority || null);     paramIndex++; }
        if (category !== undefined)      { updates.push(`category = $${paramIndex}`);       values.push(category || null);     paramIndex++; }
        if (context !== undefined)       { updates.push(`context = $${paramIndex}`);        values.push(context || null);      paramIndex++; }
        if (energie !== undefined)       { updates.push(`energie = $${paramIndex}`);        values.push(energie || null);      paramIndex++; }

        if (updates.length === 0) return res.status(400).json({ error: 'Geen velden om te updaten' });

        const result = await query(
            `UPDATE subtasks SET ${updates.join(', ')} WHERE id = $1 AND task_id = $2 RETURNING *`,
            values
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Subtaak niet gevonden' });
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update subtask error:', error);
        res.status(500).json({ error: 'Subtaak updaten mislukt' });
    }
});

/**
 * DELETE /api/tasks/:taskId/subtasks/:subtaskId
 */
router.delete('/:taskId/subtasks/:subtaskId', async (req, res) => {
    try {
        const userId = req.userId;
        const { taskId, subtaskId } = req.params;

        const taskCheck = await query('SELECT id FROM tasks WHERE id = $1 AND user_id = $2', [taskId, userId]);
        if (taskCheck.rows.length === 0) return res.status(404).json({ error: 'Taak niet gevonden' });

        const result = await query('DELETE FROM subtasks WHERE id = $1 AND task_id = $2 RETURNING id', [subtaskId, taskId]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Subtaak niet gevonden' });
        res.json({ success: true });
    } catch (error) {
        console.error('Delete subtask error:', error);
        res.status(500).json({ error: 'Subtaak verwijderen mislukt' });
    }
});

module.exports = router;

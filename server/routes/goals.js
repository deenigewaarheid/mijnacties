const express = require('express');
const router = express.Router();
const { query, transaction } = require('../database/db');

const ACTIONS_AGG = `
  COALESCE(json_agg(
    json_build_object(
      'id', a.id,
      'title', a.title,
      'completed', a.completed,
      'completed_at', a.completed_at,
      'deadline', a.deadline,
      'position', a.position,
      'created_at', a.created_at,
      'priority', a.priority,
      'category', a.category,
      'context', a.context,
      'energie', a.energie,
      'tijd_minuten', a.tijd_minuten
    ) ORDER BY a.position, a.created_at
  ) FILTER (WHERE a.id IS NOT NULL), '[]') as actions`;

/** GET /api/goals */
router.get('/', async (req, res) => {
  try {
    const result = await query(
      `SELECT g.*, ${ACTIONS_AGG}
       FROM goals g
       LEFT JOIN goal_actions a ON a.goal_id = g.id
       WHERE g.user_id = $1
       GROUP BY g.id
       ORDER BY g.created_at DESC`,
      [req.userId]
    );
    res.json(result.rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Doelen ophalen mislukt' });
  }
});

/** POST /api/goals */
router.post('/', async (req, res) => {
  try {
    const { title, description, deadline } = req.body;
    if (!title) return res.status(400).json({ error: 'Titel verplicht' });
    const result = await query(
      `INSERT INTO goals (user_id, title, description, deadline) VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.userId, title, description || null, deadline || null]
    );
    res.status(201).json({ ...result.rows[0], actions: [] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Doel aanmaken mislukt' });
  }
});

/** PATCH /api/goals/:id */
router.patch('/:id', async (req, res) => {
  try {
    const updates = [];
    const vals = [req.params.id, req.userId];
    let i = 3;
    if (req.body.title       !== undefined) { updates.push(`title = $${i++}`);       vals.push(req.body.title); }
    if (req.body.description !== undefined) { updates.push(`description = $${i++}`); vals.push(req.body.description || null); }
    if (req.body.deadline    !== undefined) { updates.push(`deadline = $${i++}`);    vals.push(req.body.deadline || null); }
    if (!updates.length) return res.status(400).json({ error: 'Niets te updaten' });
    updates.push('updated_at = NOW()');
    const result = await query(
      `UPDATE goals SET ${updates.join(', ')} WHERE id = $1 AND user_id = $2 RETURNING *`,
      vals
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Doel niet gevonden' });
    res.json(result.rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Doel updaten mislukt' });
  }
});

/** DELETE /api/goals/:id */
router.delete('/:id', async (req, res) => {
  try {
    const result = await query(
      'DELETE FROM goals WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.userId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Doel niet gevonden' });
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Doel verwijderen mislukt' });
  }
});

/** POST /api/goals/:id/actions */
router.post('/:id/actions', async (req, res) => {
  try {
    const goalId = req.params.id;
    const { title, deadline } = req.body;
    if (!title) return res.status(400).json({ error: 'Titel verplicht' });

    const check = await query('SELECT id FROM goals WHERE id = $1 AND user_id = $2', [goalId, req.userId]);
    if (!check.rows.length) return res.status(404).json({ error: 'Doel niet gevonden' });

    const pos = await query(
      'SELECT COALESCE(MAX(position), -1) + 1 AS next FROM goal_actions WHERE goal_id = $1',
      [goalId]
    );
    const result = await query(
      'INSERT INTO goal_actions (goal_id, title, position, deadline) VALUES ($1, $2, $3, $4) RETURNING *',
      [goalId, title, pos.rows[0].next, deadline || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Actie aanmaken mislukt' });
  }
});

/** PATCH /api/goals/:id/actions/:actionId */
router.patch('/:id/actions/:actionId', async (req, res) => {
  try {
    const { title, completed, deadline, priority, category, context, energie, tijd_minuten } = req.body;
    const check = await query('SELECT id FROM goals WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
    if (!check.rows.length) return res.status(404).json({ error: 'Doel niet gevonden' });

    const updates = [];
    const vals = [req.params.actionId, req.params.id];
    let i = 3;
    if (title         !== undefined) { updates.push(`title = $${i++}`);         vals.push(title); }
    if (deadline      !== undefined) { updates.push(`deadline = $${i++}`);      vals.push(deadline || null); }
    if (priority      !== undefined) { updates.push(`priority = $${i++}`);      vals.push(priority || null); }
    if (category      !== undefined) { updates.push(`category = $${i++}`);      vals.push(category || null); }
    if (context       !== undefined) { updates.push(`context = $${i++}`);       vals.push(context || null); }
    if (energie       !== undefined) { updates.push(`energie = $${i++}`);       vals.push(energie || null); }
    if (tijd_minuten  !== undefined) { updates.push(`tijd_minuten = $${i++}`);  vals.push(tijd_minuten || null); }
    if (completed !== undefined) {
      updates.push(`completed = $${i++}`);
      vals.push(completed);
      updates.push(`completed_at = $${i++}`);
      vals.push(completed ? new Date() : null);
    }
    if (!updates.length) return res.status(400).json({ error: 'Niets te updaten' });

    const result = await query(
      `UPDATE goal_actions SET ${updates.join(', ')} WHERE id = $1 AND goal_id = $2 RETURNING *`,
      vals
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Actie niet gevonden' });
    res.json(result.rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Actie updaten mislukt' });
  }
});

/** DELETE /api/goals/:id/actions/:actionId */
router.delete('/:id/actions/:actionId', async (req, res) => {
  try {
    const check = await query('SELECT id FROM goals WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
    if (!check.rows.length) return res.status(404).json({ error: 'Doel niet gevonden' });

    const result = await query(
      'DELETE FROM goal_actions WHERE id = $1 AND goal_id = $2 RETURNING id',
      [req.params.actionId, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Actie niet gevonden' });
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Actie verwijderen mislukt' });
  }
});

module.exports = router;

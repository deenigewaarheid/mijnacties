const express = require('express');
const router = express.Router();
const { query } = require('../database/db');
const { generateReply } = require('../services/claude');

/**
 * GET /api/mailmaker
 * Get all mails that need a reply
 */
router.get('/', async (req, res) => {
    try {
        const userId = req.userId;

        const result = await query(
            `SELECT m.*, md.questions, md.answers, md.generated_reply
             FROM mails m
             LEFT JOIN mail_drafts md ON md.mail_id = m.id AND md.user_id = m.user_id
             WHERE m.user_id = $1
               AND m.needs_reply = TRUE
               AND (md.sent IS NULL OR md.sent = FALSE)
             ORDER BY m.received_at DESC`,
            [userId]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Get mailmaker error:', error);
        res.status(500).json({ error: 'Ophalen mislukt' });
    }
});

/**
 * POST /api/mailmaker/:mailId/generate
 * Generate a reply for a mail based on user answers
 */
router.post('/:mailId/generate', async (req, res) => {
    try {
        const userId = req.userId;
        const mailId = req.params.mailId;
        const { answers } = req.body;

        const mailResult = await query(
            'SELECT * FROM mails WHERE id = $1 AND user_id = $2',
            [mailId, userId]
        );

        if (mailResult.rows.length === 0) {
            return res.status(404).json({ error: 'Mail niet gevonden' });
        }

        const mail = mailResult.rows[0];
        const reply = await generateReply(
            { from: mail.from_email, subject: mail.subject, body: mail.body },
            answers
        );

        // Upsert draft
        const existing = await query(
            'SELECT id FROM mail_drafts WHERE mail_id = $1 AND user_id = $2',
            [mailId, userId]
        );

        if (existing.rows.length > 0) {
            await query(
                `UPDATE mail_drafts SET answers = $1, generated_reply = $2, updated_at = NOW()
                 WHERE mail_id = $3 AND user_id = $4`,
                [JSON.stringify(answers), reply, mailId, userId]
            );
        } else {
            await query(
                `INSERT INTO mail_drafts (user_id, mail_id, answers, generated_reply)
                 VALUES ($1, $2, $3, $4)`,
                [userId, mailId, JSON.stringify(answers), reply]
            );
        }

        res.json({ reply });
    } catch (error) {
        console.error('Generate reply error:', error);
        res.status(500).json({ error: 'Antwoord genereren mislukt' });
    }
});

/**
 * POST /api/mailmaker/:mailId/mark-replied
 * Mark a mail as replied (removes it from mailmaker)
 */
router.post('/:mailId/mark-replied', async (req, res) => {
    try {
        const userId = req.userId;
        const mailId = req.params.mailId;

        await query(
            `UPDATE mail_drafts SET sent = TRUE, updated_at = NOW()
             WHERE mail_id = $1 AND user_id = $2`,
            [mailId, userId]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Mark replied error:', error);
        res.status(500).json({ error: 'Markeren mislukt' });
    }
});

module.exports = router;

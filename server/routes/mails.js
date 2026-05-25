const express = require('express');
const router = express.Router();
const multer = require('multer');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const { query, transaction } = require('../database/db');
const { analyzeEmail } = require('../services/claude');
const { pollGmail, removeLabel } = require('../services/gmail');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

/**
 * GET /api/mails
 * Get all mails for user
 */
router.get('/', async (req, res) => {
    try {
        const userId = req.userId;
        const { status, category, limit = 50 } = req.query;

        let sql = 'SELECT * FROM mails WHERE user_id = $1';
        const params = [userId];
        let paramIndex = 2;

        if (status) {
            sql += ` AND status = $${paramIndex}`;
            params.push(status);
            paramIndex++;
        }

        if (category) {
            sql += ` AND category = $${paramIndex}`;
            params.push(category);
            paramIndex++;
        }

        sql += ' ORDER BY received_at DESC LIMIT $' + paramIndex;
        params.push(limit);

        const result = await query(sql, params);
        res.json(result.rows);

    } catch (error) {
        console.error('Get mails error:', error);
        res.status(500).json({ error: 'Mails ophalen mislukt' });
    }
});

/**
 * GET /api/mails/:id
 * Get single mail
 */
router.get('/:id', async (req, res) => {
    try {
        const userId = req.userId;
        const mailId = req.params.id;

        const result = await query(
            'SELECT * FROM mails WHERE id = $1 AND user_id = $2',
            [mailId, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Mail niet gevonden' });
        }

        res.json(result.rows[0]);

    } catch (error) {
        console.error('Get mail error:', error);
        res.status(500).json({ error: 'Mail ophalen mislukt' });
    }
});

/**
 * POST /api/mails/analyze-file
 * Extract text from PDF or Word file and analyze
 */
router.post('/analyze-file', upload.single('file'), async (req, res) => {
    try {
        const userId = req.userId;
        const { subject = 'Geen onderwerp', from = 'onbekend@email.com' } = req.body;

        if (!req.file) {
            return res.status(400).json({ error: 'Geen bestand ontvangen' });
        }

        const mime = req.file.mimetype;
        const originalName = req.file.originalname.toLowerCase();
        let body = '';

        if (mime === 'application/pdf' || originalName.endsWith('.pdf')) {
            const parsed = await pdfParse(req.file.buffer);
            body = parsed.text;
        } else if (
            mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
            originalName.endsWith('.docx')
        ) {
            const result = await mammoth.extractRawText({ buffer: req.file.buffer });
            body = result.value;
        } else {
            return res.status(400).json({ error: 'Alleen PDF en Word (.docx) bestanden worden ondersteund' });
        }

        body = body.trim();
        if (!body) {
            return res.status(400).json({ error: 'Bestand bevat geen leesbare tekst' });
        }

        const analysis = await analyzeEmail({ body, subject, from }, 'file');

        const mailResult = await query(
            `INSERT INTO mails (user_id, from_email, subject, body, category, priority, status, received_at)
             VALUES ($1, $2, $3, $4, $5, $6, 'unread', NOW())
             RETURNING *`,
            [userId, from, subject, body, analysis.category, analysis.priority]
        );

        res.json({
            mail: mailResult.rows[0],
            tasks: analysis.tasks,
            category: analysis.category,
            priority: analysis.priority
        });

    } catch (error) {
        console.error('Analyze file error:', error);
        res.status(500).json({ error: 'Bestand analyseren mislukt' });
    }
});

/**
 * POST /api/mails/analyze
 * Analyze pasted email
 */
router.post('/analyze', async (req, res) => {
    try {
        const userId = req.userId;
        const { body, subject = 'Geen onderwerp', from = 'unknown@email.com' } = req.body;

        if (!body) {
            return res.status(400).json({ error: 'Email body verplicht' });
        }

        // Analyze with Claude
        const analysis = await analyzeEmail({ body, subject, from });

        // Save mail
        const mailResult = await query(
            `INSERT INTO mails (user_id, from_email, subject, body, category, priority, status, needs_reply, display_subject, received_at)
             VALUES ($1, $2, $3, $4, $5, $6, 'unread', $7, $8, NOW())
             RETURNING *`,
            [userId, from, subject, body, analysis.category, analysis.priority, analysis.needsReply, analysis.displaySubject]
        );

        const mail = mailResult.rows[0];

        if (analysis.needsReply) {
            await query(
                `INSERT INTO mail_drafts (user_id, mail_id, questions) VALUES ($1, $2, $3)`,
                [userId, mail.id, JSON.stringify(analysis.customQuestions || [])]
            );
        }

        res.json({
            mail,
            tasks: analysis.tasks,
            category: analysis.category,
            priority: analysis.priority,
            needsReply: analysis.needsReply,
        });

    } catch (error) {
        console.error('Analyze mail error:', error);
        res.status(500).json({ error: 'Mail analyseren mislukt' });
    }
});

/**
 * POST /api/mails/:id/analyze
 * Re-analyze an existing mail and return tasks (no new mail created)
 */
router.post('/:id/analyze', async (req, res) => {
    try {
        const userId = req.userId;
        const mailId = req.params.id;

        const result = await query(
            'SELECT * FROM mails WHERE id = $1 AND user_id = $2',
            [mailId, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Mail niet gevonden' });
        }

        const mail = result.rows[0];
        const analysis = await analyzeEmail({
            body: mail.body,
            subject: mail.subject,
            from: mail.from_email,
        });

        res.json({ tasks: analysis.tasks, mail });
    } catch (error) {
        console.error('Re-analyze mail error:', error);
        res.status(500).json({ error: 'Analyse mislukt' });
    }
});

/**
 * POST /api/mails/:id/approve
 * Approve mail and create tasks
 */
router.post('/:id/approve', async (req, res) => {
    try {
        const userId = req.userId;
        const mailId = req.params.id;
        const { tasks } = req.body;

        await transaction(async (client) => {
            // Update mail status
            await client.query(
                'UPDATE mails SET status = $1 WHERE id = $2 AND user_id = $3',
                ['approved', mailId, userId]
            );

            // Create tasks
            for (const task of tasks) {
                const taskResult = await client.query(
                    `INSERT INTO tasks (user_id, mail_id, title, description, deadline, priority, category, context, energie, tijd_minuten, bestemming)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                     RETURNING id`,
                    [
                        userId,
                        mailId,
                        task.title,
                        task.description || null,
                        task.deadline || null,
                        task.priority || 'mid',
                        task.category || 'werk',
                        task.context || null,
                        task.energie || null,
                        task.tijd_minuten || null,
                        task.bestemming || null
                    ]
                );

                const taskId = taskResult.rows[0].id;

                // Create subtasks
                if (task.subtasks && task.subtasks.length > 0) {
                    for (let i = 0; i < task.subtasks.length; i++) {
                        await client.query(
                            'INSERT INTO subtasks (task_id, text, position) VALUES ($1, $2, $3)',
                            [taskId, task.subtasks[i], i]
                        );
                    }
                }
            }
        });

        // Remove Gmail label if this was from Gmail
        const mailData = await query('SELECT gmail_message_id FROM mails WHERE id = $1', [mailId]);
        if (mailData.rows[0] && mailData.rows[0].gmail_message_id) {
            await removeLabel(mailData.rows[0].gmail_message_id, 'Analyzer');
        }

        res.json({ success: true, tasksCreated: tasks.length });

    } catch (error) {
        console.error('Approve mail error:', error);
        res.status(500).json({ error: 'Mail goedkeuren mislukt' });
    }
});

/**
 * DELETE /api/mails/:id
 * Delete mail
 */
router.delete('/:id', async (req, res) => {
    try {
        const userId = req.userId;
        const mailId = req.params.id;

        // Get mail first to remove Gmail label
        const mailData = await query(
            'SELECT gmail_message_id FROM mails WHERE id = $1 AND user_id = $2',
            [mailId, userId]
        );

        if (mailData.rows.length === 0) {
            return res.status(404).json({ error: 'Mail niet gevonden' });
        }

        // Remove from database
        await query('DELETE FROM mails WHERE id = $1 AND user_id = $2', [mailId, userId]);

        // Remove Gmail label
        if (mailData.rows[0].gmail_message_id) {
            await removeLabel(mailData.rows[0].gmail_message_id, 'Analyzer');
        }

        res.json({ success: true });

    } catch (error) {
        console.error('Delete mail error:', error);
        res.status(500).json({ error: 'Mail verwijderen mislukt' });
    }
});

/**
 * POST /api/mails/sync
 * Manually trigger Gmail sync
 */
router.post('/sync', async (req, res) => {
    try {
        const userId = req.userId;

        // Poll Gmail
        const newMessages = await pollGmail(userId);

        if (newMessages.length === 0) {
            return res.json({ newMails: 0, message: 'Geen nieuwe mails' });
        }

        // Process each message
        const processedMails = [];
        
        for (const message of newMessages) {
            // Analyze with Claude
            const analysis = await analyzeEmail(message);

            // Save to database
            const result = await query(
                `INSERT INTO mails
                 (user_id, gmail_message_id, from_email, from_name, subject, body,
                  category, priority, status, needs_reply, display_subject, received_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'unread', $9, $10, $11)
                 RETURNING *`,
                [
                    userId,
                    message.id,
                    message.from,
                    message.fromName,
                    message.subject,
                    message.body,
                    analysis.category,
                    analysis.priority,
                    analysis.needsReply,
                    analysis.displaySubject,
                    message.internalDate
                ]
            );

            const mailId = result.rows[0].id;
            const toSave = analysis.tasks.filter(t => t.bestemming !== 'weggooien' && t.title);
            for (const task of toSave) {
                const title = task.gtd?.verbeterd || task.title;
                const taskResult = await query(
                    `INSERT INTO tasks (user_id, mail_id, title, description, deadline, priority, category, context, energie, tijd_minuten, bestemming)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
                    [userId, mailId, title, task.description || null, task.deadline || null,
                     task.priority || 'mid', task.category || 'werk', task.context || null,
                     task.energie || null, task.tijd_minuten || null, task.bestemming || 'actie']
                );
                if (task.subtasks?.length > 0) {
                    for (let i = 0; i < task.subtasks.length; i++) {
                        await query('INSERT INTO subtasks (task_id, text, position) VALUES ($1,$2,$3)',
                            [taskResult.rows[0].id, task.subtasks[i], i]);
                    }
                }
            }

            if (analysis.needsReply) {
                await query(
                    `INSERT INTO mail_drafts (user_id, mail_id, questions) VALUES ($1, $2, $3)`,
                    [userId, mailId, JSON.stringify(analysis.customQuestions || [])]
                );
            }

            processedMails.push({
                mail: result.rows[0],
                tasks: analysis.tasks
            });
        }

        res.json({
            newMails: processedMails.length,
            mails: processedMails
        });

    } catch (error) {
        console.error('Sync error:', error);
        res.status(500).json({ error: 'Synchronisatie mislukt' });
    }
});

module.exports = router;

const express = require('express');
const router  = express.Router();
const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// POST /api/ai/insights
router.post('/insights', async (req, res) => {
    const { prompt } = req.body;

    if (!prompt || typeof prompt !== 'string') {
        return res.status(400).json({ error: 'prompt is verplicht' });
    }

    try {
        const message = await anthropic.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 1024,
            messages: [{ role: 'user', content: prompt }],
        });

        const text = message.content[0].text.trim();

        // Extract JSON array from response (may be wrapped in markdown code block)
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
            return res.status(502).json({ error: 'Ongeldig antwoord van AI', raw: text });
        }

        const insights = JSON.parse(jsonMatch[0]);
        res.json({ insights });

    } catch (err) {
        console.error('AI insights error:', err);
        res.status(500).json({ error: 'AI analyse mislukt', message: err.message });
    }
});

module.exports = router;

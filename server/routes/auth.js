const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { query } = require('../database/db');
const { getAuthUrl, getTokens, setUserCredentials } = require('../services/gmail');
const { authenticateToken } = require('../middleware/auth');

const COOKIE_OPTIONS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 30 * 24 * 60 * 60 * 1000,
};

/**
 * POST /api/auth/register
 * Register new user
 */
router.post('/register', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate
        if (!email || !password) {
            return res.status(400).json({ error: 'Email en wachtwoord verplicht' });
        }

        // Check if exists
        const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
        if (existing.rows.length > 0) {
            return res.status(409).json({ error: 'Email al in gebruik' });
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);

        // Create user
        const result = await query(
            'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
            [email, passwordHash]
        );

        const user = result.rows[0];

        // Create default preferences
        await query(
            'INSERT INTO user_preferences (user_id) VALUES ($1)',
            [user.id]
        );

        const token = jwt.sign(
            { userId: user.id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '30d' }
        );

        res.cookie('token', token, COOKIE_OPTIONS);
        res.status(201).json({ user: { id: user.id, email: user.email } });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registratie mislukt' });
    }
});

/**
 * POST /api/auth/login
 * Login user
 */
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Get user
        const result = await query(
            'SELECT id, email, password_hash FROM users WHERE email = $1',
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Ongeldige inloggegevens' });
        }

        const user = result.rows[0];

        // Verify password
        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) {
            return res.status(401).json({ error: 'Ongeldige inloggegevens' });
        }

        const token = jwt.sign(
            { userId: user.id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '30d' }
        );

        res.cookie('token', token, COOKIE_OPTIONS);
        res.json({ user: { id: user.id, email: user.email } });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Inloggen mislukt' });
    }
});

/** GET /api/auth/me */
router.get('/me', authenticateToken, (req, res) => {
    res.json({ id: req.userId, email: req.userEmail });
});

/** POST /api/auth/change-password */
router.post('/change-password', authenticateToken, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Beide velden zijn verplicht' });
        }
        if (newPassword.length < 8) {
            return res.status(400).json({ error: 'Nieuw wachtwoord moet minimaal 8 tekens zijn' });
        }
        const result = await query('SELECT password_hash FROM users WHERE id = $1', [req.userId]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Gebruiker niet gevonden' });
        const valid = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
        if (!valid) return res.status(401).json({ error: 'Huidig wachtwoord klopt niet' });
        const newHash = await bcrypt.hash(newPassword, 10);
        await query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, req.userId]);
        res.json({ success: true });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ error: 'Wachtwoord wijzigen mislukt' });
    }
});

/** POST /api/auth/logout */
router.post('/logout', (req, res) => {
    res.clearCookie('token', COOKIE_OPTIONS);
    res.json({ success: true });
});

/**
 * GET /api/auth/gmail
 * Start Gmail OAuth flow
 */
router.get('/gmail', (req, res) => {
    try {
        const authUrl = getAuthUrl();
        res.json({ authUrl });
    } catch (error) {
        console.error('Gmail auth error:', error);
        res.status(500).json({ error: 'Gmail authorisatie mislukt' });
    }
});

/**
 * GET /api/auth/gmail/callback
 * Gmail OAuth callback
 */
router.get('/gmail/callback', async (req, res) => {
    try {
        const { code, state } = req.query;

        if (!code) {
            return res.redirect(`${process.env.CLIENT_URL}?error=no_code`);
        }

        // Exchange code for tokens
        const tokens = await getTokens(code);

        // Get user ID from state (or from session in real app)
        // For now, we'll return tokens to frontend
        const encodedTokens = Buffer.from(JSON.stringify(tokens)).toString('base64');
        
        res.redirect(`${process.env.CLIENT_URL}/settings?gmail_tokens=${encodedTokens}`);

    } catch (error) {
        console.error('Gmail callback error:', error);
        res.redirect(`${process.env.CLIENT_URL}?error=gmail_auth_failed`);
    }
});

/**
 * GET /api/auth/gmail/status
 * Check if Gmail is connected for current user
 */
router.get('/gmail/status', authenticateToken, async (req, res) => {
    try {
        const result = await query(
            'SELECT gmail_refresh_token FROM users WHERE id = $1',
            [req.userId]
        );
        const connected = !!(result.rows[0]?.gmail_refresh_token);
        res.json({ connected });
    } catch (error) {
        console.error('Gmail status error:', error);
        res.status(500).json({ error: 'Status ophalen mislukt' });
    }
});

/**
 * POST /api/auth/gmail/connect
 * Save Gmail tokens for user
 */
router.post('/gmail/connect', authenticateToken, async (req, res) => {
    try {
        const { tokens } = req.body;
        const userId = req.userId; // From auth middleware

        await query(
            `UPDATE users 
             SET gmail_refresh_token = $1,
                 gmail_access_token = $2,
                 gmail_token_expiry = $3,
                 updated_at = NOW()
             WHERE id = $4`,
            [
                tokens.refresh_token,
                tokens.access_token,
                new Date(tokens.expiry_date),
                userId
            ]
        );

        res.json({ success: true, message: 'Gmail verbonden!' });

    } catch (error) {
        console.error('Gmail connect error:', error);
        res.status(500).json({ error: 'Gmail verbinden mislukt' });
    }
});

module.exports = router;

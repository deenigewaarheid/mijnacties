const express = require('express');
const { google } = require('googleapis');
const jwt = require('jsonwebtoken');
const pool = require('../database/db');

const router = express.Router();

// OAuth2 Client configuratie
const oauth2Client = new google.auth.OAuth2(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
  process.env.GMAIL_REDIRECT_URI
);

// JWT Authenticatie Middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
}

// Start OAuth flow MET user ID
router.get('/authorize', authenticateToken, (req, res) => {
  const userId = req.user.id;
  
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    state: JSON.stringify({ userId }),
    scope: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.modify'
    ]
  });
  
  res.redirect(authUrl);
});

// OAuth callback - ontvang en sla tokens op
router.get('/callback', async (req, res) => {
  const { code, state } = req.query;
  
  if (!code) {
    return res.status(400).send('Authorization code missing');
  }

  try {
    const { userId } = JSON.parse(state);
    
    const { tokens } = await oauth2Client.getToken(code);
    
    if (!tokens.refresh_token) {
      throw new Error('No refresh token received');
    }

    await pool.query(
      'UPDATE users SET gmail_refresh_token = $1 WHERE id = $2',
      [tokens.refresh_token, userId]
    );

    console.log(`✅ Gmail refresh token saved for user ${userId}`);

    res.redirect('/settings?gmail_connected=true');
    
  } catch (error) {
    console.error('❌ Gmail OAuth error:', error);
    res.redirect('/settings?gmail_error=true');
  }
});

// Check Gmail connectie status
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT gmail_refresh_token FROM users WHERE id = $1',
      [req.user.id]
    );

    const hasToken = result.rows[0]?.gmail_refresh_token ? true : false;

    res.json({ connected: hasToken });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
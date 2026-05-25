const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const path = require('path');
require('dotenv').config();

const { pool, query } = require('./database/db');
const { authenticateToken } = require('./middleware/auth');
const { pollGmail } = require('./services/gmail');
const { analyzeEmail } = require('./services/claude');

// Import routes
const authRoutes = require('./routes/auth');
const mailsRoutes = require('./routes/mails');
const tasksRoutes = require('./routes/tasks');
const goalsRoutes = require('./routes/goals');
const dagplannerRoutes = require('./routes/dagplanner');
const aiRoutes         = require('./routes/ai');
const mailmakerRoutes  = require('./routes/mailmaker');

// Initialize Express
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
const ALLOWED_ORIGINS = [
    process.env.CLIENT_URL || 'http://localhost:3000',
    'http://localhost:3001',
];
app.use(cors({
    origin: (origin, cb) => cb(null, !origin || ALLOWED_ORIGINS.includes(origin)),
    credentials: true
}));
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        service: 'Mail Analyzer API'
    });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/mails', authenticateToken, mailsRoutes);
app.use('/api/tasks', authenticateToken, tasksRoutes);
app.use('/api/goals', authenticateToken, goalsRoutes);
app.use('/api/dagplanner', authenticateToken, dagplannerRoutes);
app.use('/api/ai', authenticateToken, aiRoutes);
app.use('/api/mailmaker', authenticateToken, mailmakerRoutes);

// Serve React frontend in production
if (process.env.NODE_ENV === 'production') {
    const clientBuildPath = path.resolve(__dirname, '..', 'client', 'dist');
    console.log('📁 Serving client from:', clientBuildPath);
    
    // Serve static files
    app.use(express.static(clientBuildPath));
    
    // Serve index.html for all non-API routes
    app.get('*', (req, res) => {
        res.sendFile(path.join(clientBuildPath, 'index.html'));
    });
}

// 404 handler (only in development)
if (process.env.NODE_ENV !== 'production') {
    app.use((req, res) => {
        res.status(404).json({ error: 'Route niet gevonden' });
    });
}

// Error handler
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ 
        error: 'Er is iets misgegaan',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Gmail polling interval (every 5 minutes)
let gmailPollingInterval = null;

async function syncGmailForUser(userId) {
    const newMessages = await pollGmail(userId);
    if (newMessages.length === 0) return;

    console.log(`📥 Processing ${newMessages.length} new message(s) for user ${userId}`);

    for (const message of newMessages) {
        try {
            const analysis = await analyzeEmail(message);
            const result = await query(
                `INSERT INTO mails
                 (user_id, gmail_message_id, from_email, from_name, subject, body,
                  category, priority, status, needs_reply, display_subject, received_at)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'unread',$9,$10,$11)
                 RETURNING id`,
                [
                    userId, message.id, message.from, message.fromName,
                    message.subject, message.body,
                    analysis.category, analysis.priority,
                    analysis.needsReply, analysis.displaySubject,
                    message.internalDate,
                ]
            );

            if (analysis.needsReply && result.rows[0]) {
                await query(
                    `INSERT INTO mail_drafts (user_id, mail_id, questions) VALUES ($1, $2, $3)`,
                    [userId, result.rows[0].id, JSON.stringify(analysis.customQuestions || [])]
                );
            }

            console.log(`✓ Saved: ${message.subject} (needsReply=${analysis.needsReply})`);
        } catch (err) {
            console.error(`Error processing message ${message.id}:`, err.message);
        }
    }
}

async function startGmailPolling() {
    console.log('🔄 Starting Gmail polling service...');

    gmailPollingInterval = setInterval(async () => {
        try {
            const result = await pool.query(
                'SELECT id FROM users WHERE gmail_refresh_token IS NOT NULL'
            );
            for (const user of result.rows) {
                try {
                    await syncGmailForUser(user.id);
                } catch (error) {
                    console.error(`Error syncing Gmail for user ${user.id}:`, error.message);
                }
            }
        } catch (error) {
            console.error('Gmail polling error:', error);
        }
    }, 5 * 60 * 1000);

    console.log('✓ Gmail polling active (every 5 minutes)');
}

// Start server
async function startServer() {
    try {
        // Test database connection
        await pool.query('SELECT NOW()');
        console.log('✓ Database connected');

        // Start Gmail polling
        startGmailPolling();

        // Start Express server
        app.listen(PORT, () => {
            console.log(`
╔════════════════════════════════════════╗
║   📧 MAIL ANALYZER SERVER RUNNING     ║
║                                        ║
║   Port: ${PORT}                         ║
║   Environment: ${process.env.NODE_ENV || 'development'}         ║
║   Database: Connected ✓                ║
║   Gmail Polling: Active ✓              ║
║                                        ║
║   Ready to receive requests! 🚀        ║
╚════════════════════════════════════════╝
            `);
        });

    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    
    if (gmailPollingInterval) {
        clearInterval(gmailPollingInterval);
    }
    
    await pool.end();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('\nSIGINT received. Shutting down gracefully...');
    
    if (gmailPollingInterval) {
        clearInterval(gmailPollingInterval);
    }
    
    await pool.end();
    process.exit(0);
});

// Start the server
startServer();

module.exports = app;

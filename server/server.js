const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const path = require('path');
require('dotenv').config();

const { pool } = require('./database/db');
const { authenticateToken } = require('./middleware/auth');
const { pollGmail } = require('./services/gmail');

// Import routes
const authRoutes = require('./routes/auth');
const mailsRoutes = require('./routes/mails');
const tasksRoutes = require('./routes/tasks');
const goalsRoutes = require('./routes/goals');
const dagplannerRoutes = require('./routes/dagplanner');
const aiRoutes         = require('./routes/ai');
const setupRoutes = require('./routes/setup');

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
app.use('/api/setup', setupRoutes);

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

async function startGmailPolling() {
    console.log('🔄 Starting Gmail polling service...');
    
    gmailPollingInterval = setInterval(async () => {
        try {
            // Get all users with Gmail connected
            const result = await pool.query(
                'SELECT id FROM users WHERE gmail_refresh_token IS NOT NULL'
            );
            
            for (const user of result.rows) {
                try {
                    await pollGmail(user.id);
                } catch (error) {
                    console.error(`Error polling Gmail for user ${user.id}:`, error.message);
                }
            }
        } catch (error) {
            console.error('Gmail polling error:', error);
        }
    }, 5 * 60 * 1000); // 5 minutes

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

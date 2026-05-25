const express = require('express');
const router = express.Router();
const { pool } = require('../database/db');
const fs = require('fs');
const path = require('path');

// TIJDELIJKE ROUTE - VERWIJDER NA GEBRUIK!
router.post('/run-schema', async (req, res) => {
    try {
        console.log('📊 Reading schema.sql...');
        const schemaPath = path.join(__dirname, '../database/schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');
        
        console.log('🔧 Executing schema...');
        await pool.query(schema);
        
        console.log('✅ Database setup complete!');
        res.json({ success: true, message: 'Database tables created!' });
    } catch (error) {
        console.error('❌ Setup failed:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
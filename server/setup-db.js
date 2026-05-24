const { pool } = require('./database/db');
const fs = require('fs');
const path = require('path');

async function setupDatabase() {
    try {
        console.log('📊 Reading schema.sql...');
        const schemaPath = path.join(__dirname, 'database', 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');
        
        console.log('🔧 Executing schema...');
        await pool.query(schema);
        
        console.log('✅ Database setup complete!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Setup failed:', error);
        process.exit(1);
    }
}

setupDatabase();
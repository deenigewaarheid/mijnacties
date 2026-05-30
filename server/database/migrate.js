const { pool } = require('./db');

const migrations = [
    // Subtasks: extra GTD fields
    `ALTER TABLE subtasks ADD COLUMN IF NOT EXISTS deadline TIMESTAMP`,
    `ALTER TABLE subtasks ADD COLUMN IF NOT EXISTS priority VARCHAR(20)`,
    `ALTER TABLE subtasks ADD COLUMN IF NOT EXISTS category VARCHAR(50)`,
    `ALTER TABLE subtasks ADD COLUMN IF NOT EXISTS context VARCHAR(50)`,
    `ALTER TABLE subtasks ADD COLUMN IF NOT EXISTS energie VARCHAR(20)`,
    `ALTER TABLE subtasks ADD COLUMN IF NOT EXISTS tijd_minuten INTEGER`,
    // Mails: reply detection
    `ALTER TABLE mails ADD COLUMN IF NOT EXISTS needs_reply BOOLEAN DEFAULT FALSE`,
    `ALTER TABLE mails ADD COLUMN IF NOT EXISTS display_subject TEXT`,
    // Tasks: extra GTD fields (may already exist)
    `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS context VARCHAR(50)`,
    `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS energie VARCHAR(20)`,
    `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS tijd_minuten INTEGER`,
    `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS bestemming VARCHAR(50)`,
    `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS focus BOOLEAN DEFAULT FALSE`,
    `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS belangrijk BOOLEAN DEFAULT FALSE`,
];

async function runMigrations() {
    console.log('🔧 Running database migrations...');
    for (const sql of migrations) {
        try {
            await pool.query(sql);
        } catch (err) {
            console.error('Migration error:', sql, err.message);
        }
    }
    console.log('✓ Migrations complete');
}

module.exports = { runMigrations };

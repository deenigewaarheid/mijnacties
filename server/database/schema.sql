-- Mail Analyzer Database Schema
-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    gmail_refresh_token TEXT,
    gmail_access_token TEXT,
    gmail_token_expiry TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Mails table
CREATE TABLE IF NOT EXISTS mails (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    gmail_message_id VARCHAR(255),
    from_email VARCHAR(255) NOT NULL,
    from_name VARCHAR(255),
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    received_at TIMESTAMP NOT NULL,
    category VARCHAR(50) DEFAULT 'uncategorized',
    priority VARCHAR(20) DEFAULT 'mid',
    status VARCHAR(20) DEFAULT 'unread',
    needs_reply BOOLEAN DEFAULT FALSE,
    display_subject TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_mails_user_id ON mails(user_id);
CREATE INDEX idx_mails_status ON mails(status);
CREATE INDEX idx_mails_category ON mails(category);

-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    mail_id INTEGER REFERENCES mails(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    deadline TIMESTAMP,
    priority VARCHAR(20) DEFAULT 'mid',
    category VARCHAR(50) DEFAULT 'school',
    completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_tasks_user_id ON tasks(user_id);
CREATE INDEX idx_tasks_completed ON tasks(completed);
CREATE INDEX idx_tasks_deadline ON tasks(deadline);
CREATE INDEX idx_tasks_category ON tasks(category);

-- Subtasks table
CREATE TABLE IF NOT EXISTS subtasks (
    id SERIAL PRIMARY KEY,
    task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    completed BOOLEAN DEFAULT FALSE,
    position INTEGER DEFAULT 0,
    deadline TIMESTAMP,
    priority VARCHAR(20),
    category VARCHAR(50),
    context VARCHAR(50),
    energie VARCHAR(20),
    tijd_minuten INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_subtasks_task_id ON subtasks(task_id);

-- Mail drafts (for reply feature)
CREATE TABLE IF NOT EXISTS mail_drafts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    mail_id INTEGER REFERENCES mails(id) ON DELETE CASCADE,
    questions JSONB,
    answers JSONB,
    generated_reply TEXT,
    sent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_mail_drafts_user_id ON mail_drafts(user_id);
CREATE INDEX idx_mail_drafts_mail_id ON mail_drafts(mail_id);

-- User preferences
CREATE TABLE IF NOT EXISTS user_preferences (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    claude_model VARCHAR(50) DEFAULT 'claude-sonnet-4-6',
    notifications_enabled BOOLEAN DEFAULT TRUE,
    notifications_deadlines BOOLEAN DEFAULT TRUE,
    notifications_daily_summary BOOLEAN DEFAULT FALSE,
    gmail_check_interval INTEGER DEFAULT 300,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Categories (for custom user categories)
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(7) DEFAULT '#007AFF',
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, name)
);

CREATE INDEX idx_categories_user_id ON categories(user_id);
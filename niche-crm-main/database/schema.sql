-- Niche CRM - Structure complète de la base de données

-- Table des utilisateurs
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    username VARCHAR(100),
    phone VARCHAR(50),
    role VARCHAR(50) DEFAULT 'user',
    status VARCHAR(50) DEFAULT 'active',
    salary DECIMAL(10,2) DEFAULT 0,
    commission_rate DECIMAL(5,2) DEFAULT 0,
    niche VARCHAR(100),
    skills TEXT[],
    rating DECIMAL(3,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des leads
CREATE TABLE IF NOT EXISTS leads (
    id SERIAL PRIMARY KEY,
    company_name VARCHAR(255) NOT NULL,
    contact_name VARCHAR(255),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),
    source VARCHAR(50),
    niche VARCHAR(100),
    estimated_value DECIMAL(10,2),
    pain_notes TEXT,
    stage VARCHAR(50) DEFAULT 'LEAD',
    assigned_to INTEGER REFERENCES users(id),
    first_contact_date DATE,
    meeting_date TIMESTAMP,
    proposal_date DATE,
    deal_value DECIMAL(10,2),
    closed_reason TEXT,
    country VARCHAR(100),
    lat DECIMAL(10,6),
    lng DECIMAL(10,6),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des appels
CREATE TABLE IF NOT EXISTS calls (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER REFERENCES leads(id),
    caller_id INTEGER REFERENCES users(id),
    company_called VARCHAR(255),
    call_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    duration INTEGER,
    outcome VARCHAR(100),
    pain_noted TEXT,
    next_action TEXT,
    recording_url TEXT
);

-- Table des projets
CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    client_id INTEGER REFERENCES users(id),
    project_name VARCHAR(255) NOT NULL,
    description TEXT,
    start_date DATE,
    end_date DATE,
    budget DECIMAL(10,2),
    status VARCHAR(50) DEFAULT 'active',
    progress INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des tâches
CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id),
    assigned_to INTEGER REFERENCES users(id),
    task_name VARCHAR(255) NOT NULL,
    description TEXT,
    priority VARCHAR(20) DEFAULT 'medium',
    status VARCHAR(50) DEFAULT 'todo',
    due_date DATE,
    visible_to_client BOOLEAN DEFAULT FALSE,
    attachments TEXT[],
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des factures
CREATE TABLE IF NOT EXISTS invoices (
    id SERIAL PRIMARY KEY,
    client_id INTEGER REFERENCES users(id),
    invoice_number VARCHAR(50) UNIQUE,
    amount DECIMAL(10,2),
    status VARCHAR(50) DEFAULT 'pending',
    due_date DATE,
    paid_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des dépenses
CREATE TABLE IF NOT EXISTS expenses (
    id SERIAL PRIMARY KEY,
    category VARCHAR(100),
    amount DECIMAL(10,2),
    vendor VARCHAR(255),
    expense_date DATE,
    recurring BOOLEAN DEFAULT FALSE,
    receipt_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des messages outreach
CREATE TABLE IF NOT EXISTS outreach_messages (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER REFERENCES leads(id),
    outreacher_id INTEGER REFERENCES users(id),
    channel VARCHAR(50),
    message_text TEXT,
    subject_line VARCHAR(255),
    date_sent TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reply_received BOOLEAN DEFAULT FALSE,
    reply_content TEXT,
    next_step TEXT
);

-- Index
CREATE INDEX IF NOT EXISTS idx_leads_stage ON leads(stage);
CREATE INDEX IF NOT EXISTS idx_leads_assigned ON leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to);

-- Trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_leads_updated_at ON leads;
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_projects_updated_at ON projects;
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tasks_updated_at ON tasks;
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- Tables CRM additionnelles utilisées par les pages frontend
CREATE TABLE IF NOT EXISTS clients (
    id SERIAL PRIMARY KEY,
    company VARCHAR(255) NOT NULL,
    contact VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    niche VARCHAR(100),
    budget DECIMAL(12,2) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS staffing_requests (
    id SERIAL PRIMARY KEY,
    company_name VARCHAR(255) NOT NULL,
    skill VARCHAR(120),
    description TEXT,
    budget DECIMAL(12,2) DEFAULT 0,
    timeline VARCHAR(120),
    status VARCHAR(50) DEFAULT 'Open',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS placements (
    id SERIAL PRIMARY KEY,
    freelancer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    request_id INTEGER REFERENCES staffing_requests(id) ON DELETE SET NULL,
    freelancer_name VARCHAR(255),
    company_name VARCHAR(255),
    budget DECIMAL(12,2) DEFAULT 0,
    freelancer_earn DECIMAL(12,2) DEFAULT 0,
    our_profit DECIMAL(12,2) DEFAULT 0,
    start_date DATE DEFAULT CURRENT_DATE,
    status VARCHAR(50) DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255),
    message TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS time_tracking (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP,
    duration_seconds INTEGER DEFAULT 0,
    is_idle BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS screen_sessions (
    id SERIAL PRIMARY KEY,
    freelancer_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP,
    duration_seconds INTEGER DEFAULT 0,
    recording_url TEXT,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE calls ADD COLUMN IF NOT EXISTS twilio_call_sid VARCHAR(100);
ALTER TABLE calls ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'completed';
ALTER TABLE calls ADD COLUMN IF NOT EXISTS start_time TIMESTAMP;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS end_time TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);
CREATE INDEX IF NOT EXISTS idx_staffing_requests_status ON staffing_requests(status);
CREATE INDEX IF NOT EXISTS idx_screen_sessions_freelancer ON screen_sessions(freelancer_id);

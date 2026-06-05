const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');
const multer = require('multer');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'niche-crm-development-secret';

const upload = multer();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

app.set('db', pool);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..')));
app.use('/page', express.static(path.join(__dirname, '..', 'page')));
app.use('/assets', express.static(path.join(__dirname, '..', 'assets')));

// ============================================================
// AUTH HELPERS
// ============================================================
const createAuthToken = (user) => jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
);

const buildAuthResponse = (user) => ({
    success: true,
    token: createAuthToken(user),
    id: user.id,
    role: user.role || 'client',
    name: user.full_name,
    email: user.email,
    avatar_initials: user.avatar_initials || (user.full_name || 'U').slice(0, 2).toUpperCase()
});

// ============================================================
// NORMALIZE HELPERS
// ============================================================
const normalizeStageForClient = (stage = 'lead') => String(stage || 'lead').toLowerCase().replace('closed_won', 'won').replace('closed_lost', 'lost').replace('negotiating', 'negotiation');
const normalizeStageForDb = (stage = 'lead') => {
    const normalized = normalizeStageForClient(stage);
    const stages = {
        lead: 'LEAD', contacted: 'CONTACTED', meeting: 'MEETING', qualified: 'QUALIFIED',
        proposal: 'PROPOSAL', negotiation: 'NEGOTIATING', won: 'WON', lost: 'LOST'
    };
    return stages[normalized] || 'LEAD';
};

const mapDeal = (row) => ({
    id: String(row.id),
    company: row.company || row.company || 'Unnamed',
    contact: row.contact || row.contact_name || '',
    email: row.email || row.email || '',
    phone: row.phone || row.contact_phone || '',
    source: row.source || '',
    niche: row.niche || '',
    deal_value: Number(row.deal_value ?? row.deal_value ?? row.deal_value ?? 0),
    expectedClose: row.expected_close || row.expectedClose || row.proposal_date || '',
    assignedTo: row.assigned_to_name || row.assignedTo || '',
    stage: normalizeStageForClient(row.stage),
    createdAt: row.created_at || row.createdAt || null,
    country: row.country || '',
    lat: row.lat,
    lng: row.lng
});

const mapClient = (row) => ({
    id: String(row.id),
    company: row.company || row.company || row.full_name || row.name || 'Unnamed',
    contact: row.contact || row.contact_name || row.full_name || row.name || '',
    email: row.email || row.email || '',
    phone: row.phone || '',
    niche: row.niche || '',
    budget: Number(row.budget || 0),
    status: row.status || 'active',
    createdAt: row.created_at ? new Date(row.created_at).toISOString().slice(0, 10) : (row.createdAt || ''),
    projects: row.projects || [],
    invoices: row.invoices || []
});

const mapProject = (row) => ({
    id: String(row.id),
    name: row.name || row.project_name || '',
    client: row.client || row.client_name || '',
    description: row.description || '',
    startDate: row.start_date || row.startDate || '',
    endDate: row.end_date || row.endDate || '',
    budget: Number(row.budget || 0),
    status: row.status || 'active',
    progress: Number(row.progress || 0),
    createdAt: row.created_at ? new Date(row.created_at).toISOString().slice(0, 10) : (row.createdAt || ''),
    tasks: row.tasks || [],
    deliverables: row.deliverables || []
});

const mapTask = (row) => ({
    id: String(row.id),
    name: row.name || row.task_name || '',
    client: row.client || row.project_name || '',
    projectId: row.project_id ? String(row.project_id) : '',
    assignedTo: row.assignedTo || row.assigned_to_name || row.assigned_to || '',
    deadline: row.deadline || row.due_date || '',
    priority: row.priority || 'Medium',
    status: row.status || 'To Do',
    visibleToClient: row.visibleToClient ?? row.visible_to_client ?? false,
    description: row.description || '',
    updates: row.updates || [],
    attachments: row.attachments || [],
    createdAt: row.created_at || row.createdAt || null
});

// ============================================================
// DATABASE SCHEMA BOOTSTRAP
// ============================================================
const ensureDatabaseSchema = async () => {
    const statements = [
        // ✅ USERS TABLE - lazm tkun LWLA qbel ay table okhra
        `CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            full_name VARCHAR(255) NOT NULL,
            username VARCHAR(100),
            email VARCHAR(255) UNIQUE NOT NULL,
            phone VARCHAR(50),
            password_hash TEXT NOT NULL,
            role VARCHAR(50) DEFAULT 'client',
            status VARCHAR(50) DEFAULT 'active',
            avatar_initials VARCHAR(5),
            skills TEXT,
            niche VARCHAR(100),
            salary DECIMAL(12,2) DEFAULT 0,
            rating DECIMAL(3,1) DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS clients (
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
        )`,
        `CREATE TABLE IF NOT EXISTS leads (
            id SERIAL PRIMARY KEY,
            company VARCHAR(255) NOT NULL,
            contact_name VARCHAR(255),
            email VARCHAR(255),
            contact_phone VARCHAR(50),
            source VARCHAR(100),
            niche VARCHAR(100),
            deal_value DECIMAL(12,2) DEFAULT 0,
            deal_value DECIMAL(12,2) DEFAULT 0,
            proposal_date DATE,
            stage VARCHAR(50) DEFAULT 'LEAD',
            assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
            country VARCHAR(100),
            lat DECIMAL(10,7),
            lng DECIMAL(10,7),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS projects (
            id SERIAL PRIMARY KEY,
            client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
            project_name VARCHAR(255) NOT NULL,
            description TEXT,
            start_date DATE,
            end_date DATE,
            budget DECIMAL(12,2) DEFAULT 0,
            status VARCHAR(50) DEFAULT 'active',
            progress INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS tasks (
            id SERIAL PRIMARY KEY,
            task_name VARCHAR(255) NOT NULL,
            project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
            assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
            description TEXT,
            priority VARCHAR(50) DEFAULT 'Medium',
            status VARCHAR(50) DEFAULT 'To Do',
            due_date DATE,
            visible_to_client BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS invoices (
            id SERIAL PRIMARY KEY,
            client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
            amount DECIMAL(12,2) DEFAULT 0,
            status VARCHAR(50) DEFAULT 'Pending',
            due_date DATE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS expenses (
            id SERIAL PRIMARY KEY,
            description VARCHAR(255),
            amount DECIMAL(12,2) DEFAULT 0,
            category VARCHAR(100),
            expense_date DATE DEFAULT CURRENT_DATE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS calls (
            id SERIAL PRIMARY KEY,
            caller_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            lead_id INTEGER REFERENCES leads(id) ON DELETE SET NULL,
            company_called VARCHAR(255),
            call_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            duration INTEGER DEFAULT 0,
            outcome TEXT,
            notes TEXT,
            recording_url TEXT,
            twilio_call_sid VARCHAR(100),
            status VARCHAR(50) DEFAULT 'completed',
            start_time TIMESTAMP,
            end_time TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS staffing_requests (
            id SERIAL PRIMARY KEY,
            company VARCHAR(255) NOT NULL,
            skill VARCHAR(120),
            description TEXT,
            budget DECIMAL(12,2) DEFAULT 0,
            timeline VARCHAR(120),
            status VARCHAR(50) DEFAULT 'Open',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS placements (
            id SERIAL PRIMARY KEY,
            freelancer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            request_id INTEGER REFERENCES staffing_requests(id) ON DELETE SET NULL,
            freelancer_name VARCHAR(255),
            company VARCHAR(255),
            budget DECIMAL(12,2) DEFAULT 0,
            freelancer_earn DECIMAL(12,2) DEFAULT 0,
            our_profit DECIMAL(12,2) DEFAULT 0,
            start_date DATE DEFAULT CURRENT_DATE,
            status VARCHAR(50) DEFAULT 'Active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS notifications (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            title VARCHAR(255),
            message TEXT,
            is_read BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS time_tracking (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            end_time TIMESTAMP,
            duration_seconds INTEGER DEFAULT 0,
            is_idle BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS screen_sessions (
            id SERIAL PRIMARY KEY,
            freelancer_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            end_time TIMESTAMP,
            duration_seconds INTEGER DEFAULT 0,
            recording_url TEXT,
            status VARCHAR(50) DEFAULT 'active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
        // ALTER statements for backward compatibility
        `ALTER TABLE calls ADD COLUMN IF NOT EXISTS twilio_call_sid VARCHAR(100)`,
        `ALTER TABLE calls ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'completed'`,
        `ALTER TABLE calls ADD COLUMN IF NOT EXISTS start_time TIMESTAMP`,
        `ALTER TABLE calls ADD COLUMN IF NOT EXISTS end_time TIMESTAMP`,
        `UPDATE calls SET start_time = COALESCE(start_time, call_time) WHERE start_time IS NULL`
    ];

    for (const statement of statements) {
        await pool.query(statement);
    }
    console.log('✅ Database schema ready');
};

ensureDatabaseSchema().catch((error) => {
    console.warn('⚠️ Database schema bootstrap skipped:', error.message);
});

// ============================================================
// AUTHENTICATE MIDDLEWARE
// ============================================================
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.userId = decoded.id;
        req.user = decoded;
        next();
    } catch (jwtError) {
        try {
            const decoded = Buffer.from(token, 'base64').toString();
            const userId = parseInt(decoded.split(':')[0], 10);
            if (!Number.isInteger(userId)) throw new Error('Invalid legacy token');
            req.userId = userId;
            req.user = { id: userId };
            next();
        } catch (legacyError) {
            return res.status(403).json({ message: 'Invalid token.' });
        }
    }
};

// ============================================================
// HEALTH CHECK
// ============================================================
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'API is running', timestamp: new Date().toISOString() });
});

// ============================================================
// AUTH ROUTES (PUBLIC)
// ============================================================
app.post('/api/auth/register', upload.any(), async (req, res) => {
    const { full_name, username, email, phone, role, avatar_initials } = req.body;
    const password = req.body.password || req.body.password_hash;

    if (!full_name || !email || !password) {
        return res.status(400).json({ success: false, message: 'Full name, email and password are required.' });
    }

    try {
        const exists = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (exists.rows.length > 0) {
            return res.status(400).json({ success: false, message: 'Email already exists' });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const result = await pool.query(
            `INSERT INTO users (full_name, username, email, phone, password_hash, role)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id, full_name, email, role`,
            [full_name, username || null, email, phone || null, passwordHash, role || 'client']
        );

        res.status(201).json(buildAuthResponse({ ...result.rows[0], avatar_initials }));
    } catch (error) {
        console.error('Register error:', error.message);
        res.status(500).json({ success: false, message: 'Registration failed. Please try again.', debug: error.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    try {
        const result = await pool.query('SELECT id, full_name, email, role, password_hash FROM users WHERE email = $1', [email]);
        if (result.rows.length === 0) {
            return res.status(401).json({ success: false, message: 'Email ou mot de passe incorrect' });
        }

        const user = result.rows[0];
        const isBcryptHash = /^\$2[aby]\$/.test(user.password_hash || '');
        const passwordMatches = isBcryptHash
            ? await bcrypt.compare(password, user.password_hash)
            : password === user.password_hash;

        if (!passwordMatches) {
            return res.status(401).json({ success: false, message: 'Email ou mot de passe incorrect' });
        }

        res.json(buildAuthResponse(user));
    } catch (error) {
        console.error('Login error:', error.message);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// ============================================================
// PROTECTED ROUTES
// ============================================================

// Dashboard
app.get('/api/dashboard', authenticateToken, async (req, res) => {
    try {
        const [calls, meetings, wonDeals, pipeline, revenue, expenses] = await Promise.all([
            pool.query("SELECT COUNT(*) FROM calls WHERE DATE(COALESCE(call_time, NOW())) = CURRENT_DATE"),
            pool.query("SELECT COUNT(*) FROM calls WHERE outcome ILIKE '%meeting%'"),
            pool.query("SELECT COUNT(*) FROM leads WHERE stage IN ('WON', 'CLOSED_WON')"),
            pool.query("SELECT COALESCE(SUM(COALESCE(deal_value, deal_value, 0)), 0) AS total FROM leads"),
            pool.query("SELECT COALESCE(SUM(amount), 0) AS total FROM invoices WHERE status IN ('paid', 'Paid')"),
            pool.query("SELECT COALESCE(SUM(amount), 0) AS total FROM expenses")
        ]);

        const totalRevenue = Number(revenue.rows[0]?.total || 0);
        const totalExpenses = Number(expenses.rows[0]?.total || 0);
        const netProfit = totalRevenue - totalExpenses;

        res.json({
            todayCalls: Number(calls.rows[0]?.count || 0),
            todayMeetings: Number(meetings.rows[0]?.count || 0),
            todayDeals: Number(wonDeals.rows[0]?.count || 0),
            todayRevenue: totalRevenue,
            pipelineTotal: Number(pipeline.rows[0]?.total || 0),
            pipelineMonth: Number(pipeline.rows[0]?.total || 0),
            pipelineAtRisk: 0,
            topPerformer: '—',
            needsAttention: '—',
            mrr: totalRevenue,
            expenses: totalExpenses,
            netProfit,
            profitMargin: totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 100) : 0
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.json({
            todayCalls: 0, todayMeetings: 0, todayDeals: 0, todayRevenue: 0,
            pipelineTotal: 0, pipelineMonth: 0, pipelineAtRisk: 0, topPerformer: '—',
            needsAttention: '—', mrr: 0, expenses: 0, netProfit: 0, profitMargin: 0
        });
    }
});

// Users
app.get('/api/users/me', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, full_name, username, email, phone, role, status, created_at FROM users WHERE id = $1',
            [req.userId]
        );
        if (result.rows.length === 0) return res.status(404).json({ message: 'User not found' });
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.post('/api/users/avatar', authenticateToken, upload.single('avatar'), async (req, res) => {
    try {
        const initials = (req.body.avatar_initials || req.body.initials || 'U').slice(0, 2).toUpperCase();
        res.json({ success: true, avatar_initials: initials, message: 'Avatar uploaded' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.put('/api/users/me', authenticateToken, async (req, res) => {
    const { full_name, username, phone } = req.body;
    try {
        const result = await pool.query(
            `UPDATE users
             SET full_name = COALESCE($1, full_name),
                 username = COALESCE($2, username),
                 phone = COALESCE($3, phone),
                 updated_at = NOW()
             WHERE id = $4
             RETURNING id, full_name, username, email, phone, role, status, created_at`,
            [full_name || null, username || null, phone || null, req.userId]
        );
        if (result.rows.length === 0) return res.status(404).json({ message: 'User not found' });
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.get('/api/users', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT id, full_name, email, role, status, created_at FROM users ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Clients
app.get('/api/clients', authenticateToken, async (req, res) => {
    try {
        const [clientRows, projectRows, invoiceRows] = await Promise.all([
            pool.query('SELECT id, company_name as company, company_name, phone, address FROM clients ORDER BY id DESC'),
            pool.query('SELECT * FROM projects ORDER BY created_at DESC'),
            pool.query('SELECT * FROM invoices ORDER BY created_at DESC')
        ]);

        const clients = clientRows.rows.map((client) => {
            const mapped = mapClientOld(client);
            mapped.projects = projectRows.rows
                .filter((project) => String(project.client_id || '') === String(client.id))
                .map(mapProject);
            mapped.invoices = invoiceRows.rows
                .filter((invoice) => String(invoice.client_id || '') === String(client.id))
                .map((invoice) => ({ ...invoice, amount: Number(invoice.amount || 0) }));
            return mapped;
        });

        res.json(clients);
    } catch (error) {
        console.error('Clients error:', error);
        res.status(500).json({ message: error.message });
    }
});

app.get('/api/clients/:id', authenticateToken, async (req, res) => {
    if (!/^\d+$/.test(String(req.params.id))) return res.json(mapClientOld({ id: req.params.id, company: 'Demo Client', contact: 'Client Portal', status: 'active' }));
    try {
        const result = await pool.query('SELECT id, company_name as company, company_name, phone, address FROM clients WHERE id = $1', [req.params.id]);
        if (!result.rows.length) return res.status(404).json({ message: 'Client not found' });
        res.json(mapClientOld(result.rows[0]));
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.get('/api/clients/:id/projects', authenticateToken, async (req, res) => {
    if (!/^\d+$/.test(String(req.params.id))) return res.json([]);
    try {
        const result = await pool.query('SELECT * FROM projects WHERE client_id = $1 ORDER BY created_at DESC', [req.params.id]);
        res.json(result.rows.map(mapProject));
    } catch (error) {
        res.json([]);
    }
});

app.get('/api/clients/:id/invoices', authenticateToken, async (req, res) => {
    if (!/^\d+$/.test(String(req.params.id))) return res.json([]);
    try {
        const result = await pool.query('SELECT * FROM invoices WHERE client_id = $1 ORDER BY created_at DESC', [req.params.id]);
        res.json(result.rows.map((invoice) => ({ ...invoice, amount: Number(invoice.amount || 0) })));
    } catch (error) {
        res.json([]);
    }
});

app.get('/api/clients/:id/team', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query("SELECT id, full_name AS name, role, email FROM users WHERE role IN ('admin', 'freelancer', 'caller', 'outreacher') ORDER BY role, full_name LIMIT 12");
        res.json(result.rows);
    } catch (error) {
        res.json([]);
    }
});

app.post('/api/clients', authenticateToken, async (req, res) => {
    const { company, contact, email, phone, niche, budget, status } = req.body;
    if (!company) return res.status(400).json({ message: 'Company is required' });
    try {
        const result = await pool.query(
            `INSERT INTO clients (company, contact, email, phone, niche, budget, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [company, contact || null, email || null, phone || null, niche || null, budget || 0, status || 'active']
        );
        res.status(201).json(mapClientOld(result.rows[0]));
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.put('/api/clients/:id', authenticateToken, async (req, res) => {
    const { company, contact, email, phone, niche, budget, status } = req.body;
    try {
        const result = await pool.query(
            `UPDATE clients
             SET company = COALESCE($1, company), contact = COALESCE($2, contact), email = COALESCE($3, email),
                 phone = COALESCE($4, phone), niche = COALESCE($5, niche), budget = COALESCE($6, budget),
                 status = COALESCE($7, status), updated_at = NOW()
             WHERE id = $8 RETURNING *`,
            [company || null, contact || null, email || null, phone || null, niche || null, budget ?? null, status || null, req.params.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ message: 'Client not found' });
        res.json(mapClientOld(result.rows[0]));
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.delete('/api/clients/:id', authenticateToken, async (req, res) => {
    try {
        await pool.query('DELETE FROM clients WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Projects
app.get('/api/projects', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT p.*, clients.company AS client_name
            FROM projects p
            LEFT JOIN clients c ON c.id = p.client_id
            ORDER BY p.created_at DESC
        `);
        res.json(result.rows.map(mapProject));
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.post('/api/projects', authenticateToken, async (req, res) => {
    const { name, project_name, client, description, startDate, endDate, budget, status, progress } = req.body;
    const projectName = name || project_name;
    if (!projectName) return res.status(400).json({ message: 'Project name is required' });
    try {
        let clientId = null;
        if (client) {
            const found = await pool.query('SELECT id FROM clients WHERE company ILIKE $1 LIMIT 1', [client]);
            if (found.rows.length) clientId = found.rows[0].id;
        }
        const result = await pool.query(
            `INSERT INTO projects (client_id, project_name, description, start_date, end_date, budget, status, progress)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [clientId, projectName, description || null, startDate || null, endDate || null, budget || 0, status || 'active', progress || 0]
        );
        res.status(201).json(mapProject({ ...result.rows[0], client_name: client || '' }));
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.get('/api/projects/:projectId/tasks', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT t.*, p.project_name, u.full_name AS assigned_to_name
            FROM tasks t
            LEFT JOIN projects p ON p.id = t.project_id
            LEFT JOIN users u ON u.id = t.assigned_to
            WHERE t.project_id = $1
            ORDER BY t.due_date ASC NULLS LAST, t.created_at DESC
        `, [req.params.projectId]);
        res.json(result.rows.map(mapTask));
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.post('/api/projects/:projectId/tasks', authenticateToken, async (req, res) => {
    const { name, task_name, assigned_to, description, priority, status, deadline, due_date, visibleToClient, visible_to_client } = req.body;
    const taskName = name || task_name;
    if (!taskName) return res.status(400).json({ message: 'Task name is required' });
    try {
        const result = await pool.query(
            `INSERT INTO tasks (task_name, project_id, assigned_to, description, priority, status, due_date, visible_to_client)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [taskName, req.params.projectId, assigned_to || null, description || null, priority || 'Medium', status || 'To Do', deadline || due_date || null, visibleToClient ?? visible_to_client ?? false]
        );
        res.status(201).json(mapTask(result.rows[0]));
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Tasks
app.get('/api/tasks', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT t.*, p.project_name, u.full_name AS assigned_to_name
            FROM tasks t
            LEFT JOIN projects p ON p.id = t.project_id
            LEFT JOIN users u ON u.id = t.assigned_to
            ORDER BY t.due_date ASC NULLS LAST, t.created_at DESC
        `);
        res.json(result.rows.map(mapTask));
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.post('/api/tasks', authenticateToken, async (req, res) => {
    const { name, task_name, client, project_id, assigned_to, description, priority, status, deadline, due_date, visibleToClient, visible_to_client } = req.body;
    const taskName = name || task_name;
    if (!taskName) return res.status(400).json({ message: 'Task name is required' });
    try {
        let projectId = project_id || null;
        if (!projectId && client) {
            const found = await pool.query('SELECT id FROM projects WHERE project_name ILIKE $1 LIMIT 1', [client]);
            if (found.rows.length) projectId = found.rows[0].id;
        }
        const result = await pool.query(
            `INSERT INTO tasks (task_name, project_id, assigned_to, description, priority, status, due_date, visible_to_client)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [taskName, projectId, assigned_to || null, description || null, priority || 'Medium', status || 'To Do', deadline || due_date || null, visibleToClient ?? visible_to_client ?? false]
        );
        res.status(201).json(mapTask({ ...result.rows[0], project_name: client || '' }));
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.put('/api/tasks/:id/status', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query('UPDATE tasks SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *', [req.body.status, req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ message: 'Task not found' });
        res.json(mapTask(result.rows[0]));
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Finance
app.get('/api/finance/invoices', authenticateToken, async (req, res) => {
    try {
        const r = await pool.query('SELECT * FROM invoices ORDER BY created_at DESC');
        res.json(r.rows.map((invoice) => ({ ...invoice, amount: Number(invoice.amount || 0) })));
    } catch(e) { res.json([]); }
});

app.get('/api/finance/expenses', authenticateToken, async (req, res) => {
    try {
        const r = await pool.query('SELECT * FROM expenses ORDER BY expense_date DESC');
        res.json(r.rows.map((expense) => ({ ...expense, amount: Number(expense.amount || 0) })));
    } catch(e) { res.json([]); }
});

// Pipeline & Kanban
app.get(['/api/pipeline', '/api/pipeline/deals', '/api/leads'], authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT l.*, u.full_name AS assigned_to_name
            FROM leads l
            LEFT JOIN users u ON u.id = l.assigned_to
            ORDER BY l.created_at DESC
        `);
        res.json(result.rows.map(mapDeal));
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.post(['/api/pipeline/deals', '/api/pipeline/leads', '/api/leads'], authenticateToken, async (req, res) => {
    const { company, contact, email, phone, source, niche, deal_value, expectedClose, stage, assigned_to } = req.body;
    if (!company) return res.status(400).json({ message: 'Company is required' });
    try {
        const result = await pool.query(
            `INSERT INTO leads (company, contact_name, email, contact_phone, source, niche, deal_value, proposal_date, stage, assigned_to)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
            [company, contact || null, email || null, phone || null, source || null, niche || null, deal_value || 0, expectedClose || null, normalizeStageForDb(stage), assigned_to || null]
        );
        res.status(201).json(mapDeal(result.rows[0]));
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.put(['/api/pipeline/deals/:id/stage', '/api/pipeline/leads/:id/stage', '/api/leads/:id/stage'], authenticateToken, async (req, res) => {
    try {
        const result = await pool.query('UPDATE leads SET stage = $1, updated_at = NOW() WHERE id = $2 RETURNING *', [normalizeStageForDb(req.body.stage), req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ message: 'Deal not found' });
        res.json(mapDeal(result.rows[0]));
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.delete(['/api/pipeline/deals/:id', '/api/leads/:id'], authenticateToken, async (req, res) => {
    try {
        await pool.query('DELETE FROM leads WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.get('/api/kanban', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM leads ORDER BY stage, created_at DESC');
        res.json(result.rows.map(mapDeal));
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Team
app.get('/api/cold-callers', authenticateToken, async (req, res) => {
    try {
        const r = await pool.query("SELECT id, full_name AS name, full_name, email, phone, role, status, salary, niche, rating, created_at FROM users WHERE role = 'caller' ORDER BY created_at DESC");
        res.json(r.rows);
    } catch(e) { res.json([]); }
});

app.get('/api/outreachers', authenticateToken, async (req, res) => {
    try {
        const r = await pool.query("SELECT id, full_name AS name, full_name, email, phone, role, status, salary, niche, rating, created_at FROM users WHERE role = 'outreacher' ORDER BY created_at DESC");
        res.json(r.rows);
    } catch(e) { res.json([]); }
});

app.get('/api/freelancers', authenticateToken, async (req, res) => {
    try {
        const r = await pool.query("SELECT id, full_name AS name, full_name, email, phone, role, status, salary AS hourlyRate, salary, skills, rating, created_at FROM users WHERE role = 'freelancer' ORDER BY created_at DESC");
        res.json(r.rows.map((f) => ({ ...f, skills: Array.isArray(f.skills) ? f.skills.join(', ') : (f.skills || ''), hourlyRate: Number(f.hourlyrate || f.hourlyRate || f.salary || 0), rating: Number(f.rating || 0) })));
    } catch(e) { res.json([]); }
});

// Staffing
app.get('/api/staffing/requests', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM staffing_requests ORDER BY created_at DESC');
        res.json(result.rows.map((r) => ({ id: String(r.id), companyName: r.company, skill: r.skill, description: r.description, budget: Number(r.budget || 0), timeline: r.timeline, status: r.status || 'Open', createdAt: r.created_at })));
    } catch (error) { res.json([]); }
});

app.post('/api/staffing/requests', authenticateToken, async (req, res) => {
    const { companyName, skill, description, budget, timeline, status } = req.body;
    if (!companyName) return res.status(400).json({ message: 'Company name is required' });
    try {
        const result = await pool.query(
            `INSERT INTO staffing_requests (company, skill, description, budget, timeline, status)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [companyName, skill || null, description || null, budget || 0, timeline || null, status || 'Open']
        );
        const r = result.rows[0];
        res.status(201).json({ id: String(r.id), companyName: r.company, skill: r.skill, description: r.description, budget: Number(r.budget || 0), timeline: r.timeline, status: r.status, createdAt: r.created_at });
    } catch (error) { res.status(500).json({ message: error.message }); }
});

app.get('/api/staffing/placements', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM placements ORDER BY created_at DESC');
        res.json(result.rows.map((p) => ({ id: String(p.id), freelancerId: p.freelancer_id ? String(p.freelancer_id) : '', requestId: p.request_id ? String(p.request_id) : '', freelancerName: p.freelancer_name, companyName: p.company, budget: Number(p.budget || 0), freelancerEarn: Number(p.freelancer_earn || 0), ourProfit: Number(p.our_profit || 0), startDate: p.start_date, status: p.status || 'Active' })));
    } catch (error) { res.json([]); }
});

app.post('/api/staffing/placements', authenticateToken, async (req, res) => {
    const { freelancerId, requestId, freelancerName, companyName, budget, freelancerEarn, ourProfit, startDate, status } = req.body;
    try {
        const result = await pool.query(
            `INSERT INTO placements (freelancer_id, request_id, freelancer_name, company, budget, freelancer_earn, our_profit, start_date, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
            [freelancerId || null, requestId || null, freelancerName || null, companyName || null, budget || 0, freelancerEarn || 0, ourProfit || 0, startDate || null, status || 'Active']
        );
        if (requestId) await pool.query('UPDATE staffing_requests SET status = $1, updated_at = NOW() WHERE id = $2', ['Filled', requestId]);
        const p = result.rows[0];
        res.status(201).json({ id: String(p.id), freelancerId: p.freelancer_id ? String(p.freelancer_id) : '', requestId: p.request_id ? String(p.request_id) : '', freelancerName: p.freelancer_name, companyName: p.company, budget: Number(p.budget || 0), freelancerEarn: Number(p.freelancer_earn || 0), ourProfit: Number(p.our_profit || 0), startDate: p.start_date, status: p.status });
    } catch (error) { res.status(500).json({ message: error.message }); }
});

// Notifications
app.get('/api/notifications', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20', [req.userId]);
        res.json(result.rows);
    } catch (error) { res.json([]); }
});

// Time Tracking
app.get('/api/time-tracking', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM time_tracking WHERE user_id = $1 ORDER BY start_time DESC LIMIT 10', [req.userId]);
        res.json(result.rows);
    } catch (error) { res.json([]); }
});

// Automation
app.get('/api/automation', authenticateToken, async (req, res) => {
    try {
        const tasks = await pool.query('SELECT COUNT(*) FROM tasks WHERE status != $1 AND due_date < CURRENT_DATE', ['Done']);
        const invoices = await pool.query('SELECT COUNT(*) FROM invoices WHERE status = $1 AND due_date < NOW()', ['Pending']);
        res.json({ overdueTasks: parseInt(tasks.rows[0]?.count || 0), overdueInvoices: parseInt(invoices.rows[0]?.count || 0), alerts: (parseInt(tasks.rows[0]?.count || 0) + parseInt(invoices.rows[0]?.count || 0)) });
    } catch (error) { res.json({ overdueTasks: 0, overdueInvoices: 0, alerts: 0 }); }
});

// Analytics
app.get('/api/analytics/revenue-trend', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT to_char(day, 'Mon DD') AS label, COALESCE(SUM(i.amount), 0)::float AS amount
            FROM generate_series(CURRENT_DATE - INTERVAL '29 days', CURRENT_DATE, INTERVAL '1 day') AS day
            LEFT JOIN invoices i ON DATE(i.created_at) = day AND i.status IN ('paid', 'Paid')
            GROUP BY day ORDER BY day
        `);
        res.json(result.rows.map((row) => row.amount));
    } catch (error) { res.json(Array.from({ length: 30 }, () => 0)); }
});

app.get('/api/analytics/calls-trend', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT day, COUNT(c.id)::int AS calls, COUNT(c.id) FILTER (WHERE c.outcome ILIKE '%meeting%')::int AS meetings
            FROM generate_series(CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE, INTERVAL '1 day') AS day
            LEFT JOIN calls c ON DATE(COALESCE(c.call_time, c.start_time)) = day
            GROUP BY day ORDER BY day
        `);
        res.json({ calls: result.rows.map((row) => row.calls), meetings: result.rows.map((row) => row.meetings) });
    } catch (error) { res.json({ calls: [0,0,0,0,0,0,0], meetings: [0,0,0,0,0,0,0] }); }
});

app.get('/api/analytics/revenue-by-niche', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT COALESCE(l.niche, 'Other') AS niche, COALESCE(SUM(COALESCE(l.deal_value, l.deal_value, 0)), 0)::float AS revenue
            FROM leads l GROUP BY COALESCE(l.niche, 'Other') ORDER BY revenue DESC LIMIT 8
        `);
        res.json(result.rows);
    } catch (error) { res.json([]); }
});

app.get('/api/analytics/revenue-by-service', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT COALESCE(status, 'active') AS service, COALESCE(SUM(budget), 0)::float AS revenue
            FROM projects GROUP BY COALESCE(status, 'active') ORDER BY revenue DESC
        `);
        res.json(result.rows);
    } catch (error) { res.json([]); }
});

app.get('/api/analytics/leaderboard', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT u.full_name, u.role,
                   COUNT(c.id)::int AS calls,
                   COUNT(c.id) FILTER (WHERE c.outcome ILIKE '%meeting%')::int AS meetings,
                   COUNT(l.id) FILTER (WHERE l.stage IN ('WON', 'CLOSED_WON'))::int AS deals,
                   COALESCE(SUM(COALESCE(l.deal_value, l.deal_value, 0)) FILTER (WHERE l.stage IN ('WON', 'CLOSED_WON')), 0)::float AS revenue
            FROM users u
            LEFT JOIN calls c ON c.caller_id = u.id
            LEFT JOIN leads l ON l.assigned_to = u.id
            WHERE u.role IN ('caller', 'outreacher', 'freelancer', 'admin')
            GROUP BY u.id ORDER BY revenue DESC, meetings DESC, calls DESC LIMIT 10
        `);
        res.json(result.rows);
    } catch (error) { res.json([]); }
});

app.get('/api/analytics/conversion-funnel', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT stage, COUNT(*)::int AS count FROM leads GROUP BY stage');
        const counts = Object.fromEntries(result.rows.map(row => [normalizeStageForDb(row.stage), row.count]));
        const stages = ['LEAD', 'CONTACTED', 'MEETING', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATING', 'WON'];
        res.json(stages.map(stage => ({ stage, count: counts[stage] || 0 })));
    } catch (error) { res.json(['LEAD','CONTACTED','MEETING','QUALIFIED','PROPOSAL','NEGOTIATING','WON'].map(stage => ({ stage, count: 0 }))); }
});

app.get('/api/analytics/mrr-trend', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT month, COALESCE(SUM(i.amount), 0)::float AS amount
            FROM generate_series(date_trunc('month', CURRENT_DATE) - INTERVAL '11 months', date_trunc('month', CURRENT_DATE), INTERVAL '1 month') AS month
            LEFT JOIN invoices i ON date_trunc('month', i.created_at) = month AND i.status IN ('paid', 'Paid')
            GROUP BY month ORDER BY month
        `);
        res.json(result.rows.map((row) => row.amount));
    } catch (error) { res.json(Array.from({ length: 12 }, () => 0)); }
});

app.get('/api/analytics/close-rate-trend', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT month,
                   COUNT(*) FILTER (WHERE stage IN ('WON', 'CLOSED_WON'))::float AS won,
                   NULLIF(COUNT(*) FILTER (WHERE stage IN ('WON', 'CLOSED_WON', 'LOST', 'CLOSED_LOST')), 0)::float AS closed
            FROM generate_series(date_trunc('month', CURRENT_DATE) - INTERVAL '5 months', date_trunc('month', CURRENT_DATE), INTERVAL '1 month') AS month
            LEFT JOIN leads l ON date_trunc('month', l.created_at) = month
            GROUP BY month ORDER BY month
        `);
        res.json(result.rows.map((row) => row.closed ? Math.round((row.won / row.closed) * 100) : 0));
    } catch (error) { res.json([0,0,0,0,0,0]); }
});

app.get('/api/leads/geo', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT company AS company, contact_name AS contact, COALESCE(deal_value, deal_value, 0) AS deal_value, stage, lat, lng
            FROM leads WHERE lat IS NOT NULL AND lng IS NOT NULL
        `);
        res.json(result.rows);
    } catch (error) { res.json([]); }
});

// Screen Monitoring
app.post('/api/screen-monitor/start-session', authenticateToken, async (req, res) => {
    const freelancerId = req.body.freelancerId || req.userId;
    try {
        const result = await pool.query(`INSERT INTO screen_sessions (freelancer_id, start_time, status) VALUES ($1, NOW(), 'active') RETURNING *`, [freelancerId]);
        res.status(201).json({ success: true, session: result.rows[0] });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

app.post('/api/screen-monitor/stop-session/:id', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `UPDATE screen_sessions SET end_time = NOW(), duration_seconds = EXTRACT(EPOCH FROM (NOW() - start_time))::int, status = 'completed' WHERE id = $1 RETURNING *`,
            [req.params.id]
        );
        if (!result.rows.length) return res.status(404).json({ message: 'Session not found' });
        res.json({ success: true, session: result.rows[0] });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

app.get('/api/screen-monitor/sessions/:freelancerId', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM screen_sessions WHERE freelancer_id = $1 ORDER BY start_time DESC', [req.params.freelancerId]);
        res.json(result.rows);
    } catch (error) { res.status(500).json({ message: error.message }); }
});

// Call Recording
app.post('/api/call-recording/start-call', authenticateToken, async (req, res) => {
    const { to, callerId, leadId } = req.body;
    try {
        const callSid = `CA${Date.now()}`;
        const result = await pool.query(
            `INSERT INTO calls (caller_id, lead_id, company_called, call_time, start_time, duration, outcome, twilio_call_sid, status)
             VALUES ($1, $2, $3, NOW(), NOW(), 0, 'initiated', $4, 'initiated') RETURNING *`,
            [callerId || req.userId, leadId || null, to || 'Unknown', callSid]
        );
        res.status(201).json({ success: true, callSid, callId: result.rows[0].id });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

app.get('/api/call-recording/calls/:callerId', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT c.*, l.company, l.contact_name FROM calls c
            LEFT JOIN leads l ON l.id = c.lead_id
            WHERE c.caller_id = $1 ORDER BY COALESCE(c.start_time, c.call_time) DESC
        `, [req.params.callerId]);
        res.json(result.rows);
    } catch (error) { res.status(500).json({ message: error.message }); }
});

app.get('/api/call-recording/download/:callId', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT recording_url FROM calls WHERE id = $1', [req.params.callId]);
        if (!result.rows.length || !result.rows[0].recording_url) return res.status(404).json({ message: 'Recording not found' });
        res.redirect(result.rows[0].recording_url);
    } catch (error) { res.status(500).json({ message: error.message }); }
});

app.post('/api/messages', authenticateToken, async (req, res) => {
    res.status(201).json({ success: true, id: Date.now().toString(), ...req.body });
});

app.post('/api/calls/schedule', authenticateToken, async (req, res) => {
    res.status(201).json({ success: true, id: Date.now().toString(), ...req.body });
});

// Auth/Me
app.get('/api/auth/me', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT id, full_name as name, email, role FROM users WHERE id = $1', [req.userId]);
        if (result.rows.length === 0) return res.status(404).json({ message: 'User not found' });
        res.json(result.rows[0]);
    } catch (error) { res.status(500).json({ message: error.message }); }
});

// ============================================================
// WEBSOCKET & SERVER START
// ============================================================
const http = require('http');
const socketIo = require('socket.io');

const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: "*" } });

io.on('connection', (socket) => {
    console.log('🟢 Client connected:', socket.id);
    socket.on('join-project', (projectId) => socket.join(`project-${projectId}`));
    socket.on('task-update', (data) => io.to(`project-${data.projectId}`).emit('task-changed', data));
    socket.on('disconnect', () => console.log('🔴 Client disconnected'));
});

server.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log('✅ All API routes loaded successfully');
});

module.exports = app;

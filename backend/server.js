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
// AUTHENTICATION MIDDLEWARE (À mettre ici, avant toutes les routes)
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
        // Backward compatibility with old base64 demo tokens.
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

// Health check (public)
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
        console.error('Register error:', error);
        res.status(500).json({ success: false, message: 'Registration failed. Please try again.' });
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
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// ============================================================
// ROUTES PROTÉGÉES (avec authenticateToken)
// ============================================================

// Dashboard
app.get('/api/dashboard', authenticateToken, async (req, res) => {
    try {
        const [calls, meetings, wonDeals, pipeline, revenue, expenses] = await Promise.all([
            pool.query("SELECT COUNT(*) FROM calls WHERE DATE(COALESCE(call_time, NOW())) = CURRENT_DATE"),
            pool.query("SELECT COUNT(*) FROM calls WHERE outcome ILIKE '%meeting%'"),
            pool.query("SELECT COUNT(*) FROM leads WHERE stage IN ('WON', 'CLOSED_WON')"),
            pool.query("SELECT COALESCE(SUM(COALESCE(deal_value, estimated_value, 0)), 0) AS total FROM leads"),
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
        const result = await pool.query("SELECT * FROM clients ORDER BY id DESC");
        res.json(result.rows);
    } catch (error) { 
        res.status(500).json({ message: error.message }); 
    }
});

// Projects
app.get('/api/projects', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM projects ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (error) { 
        res.status(500).json({ message: error.message }); 
    }
});

// Tasks
app.get('/api/tasks', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM tasks ORDER BY deadline ASC, created_at DESC');
        res.json(result.rows);
    } catch (error) { 
        res.status(500).json({ message: error.message }); 
    }
});

// Finance
app.get('/api/finance/invoices', authenticateToken, async (req, res) => {
    try { 
        const r = await pool.query('SELECT * FROM invoices ORDER BY created_at DESC'); 
        res.json(r.rows); 
    } catch(e) { 
        res.json([]); 
    }
});

app.get('/api/finance/expenses', authenticateToken, async (req, res) => {
    try { 
        const r = await pool.query('SELECT * FROM expenses ORDER BY expense_date DESC'); 
        res.json(r.rows); 
    } catch(e) { 
        res.json([]); 
    }
});

// Pipeline & Kanban
app.get('/api/pipeline', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM leads ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.get('/api/kanban', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM leads ORDER BY stage, created_at DESC');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Cold Callers, Outreachers, Freelancers
app.get('/api/cold-callers', authenticateToken, async (req, res) => {
    try { 
        const r = await pool.query("SELECT * FROM users WHERE role = 'caller' ORDER BY created_at DESC"); 
        res.json(r.rows); 
    } catch(e) { 
        res.json([]); 
    }
});

app.get('/api/outreachers', authenticateToken, async (req, res) => {
    try { 
        const r = await pool.query("SELECT * FROM users WHERE role = 'outreacher' ORDER BY created_at DESC"); 
        res.json(r.rows); 
    } catch(e) { 
        res.json([]); 
    }
});

app.get('/api/freelancers', authenticateToken, async (req, res) => {
    try { 
        const r = await pool.query("SELECT * FROM users WHERE role = 'freelancer' ORDER BY created_at DESC"); 
        res.json(r.rows); 
    } catch(e) { 
        res.json([]); 
    }
});

// Staffing
app.get('/api/staffing/requests', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM staffing_requests ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (error) { 
        res.json([]); 
    }
});

app.get('/api/staffing/placements', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM placements ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (error) { 
        res.json([]); 
    }
});

// Notifications
app.get('/api/notifications', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20', [req.userId]);
        res.json(result.rows);
    } catch (error) {
        res.json([]);
    }
});

// Time Tracking
app.get('/api/time-tracking', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM time_tracking WHERE user_id = $1 ORDER BY start_time DESC LIMIT 10', [req.userId]);
        res.json(result.rows);
    } catch (error) {
        res.json([]);
    }
});

// Automation
app.get('/api/automation', authenticateToken, async (req, res) => {
    try {
        const tasks = await pool.query('SELECT COUNT(*) FROM tasks WHERE status != $1 AND deadline < NOW()', ['Done']);
        const invoices = await pool.query('SELECT COUNT(*) FROM invoices WHERE status = $1 AND due_date < NOW()', ['Pending']);
        res.json({
            overdueTasks: parseInt(tasks.rows[0]?.count || 0),
            overdueInvoices: parseInt(invoices.rows[0]?.count || 0),
            alerts: (parseInt(tasks.rows[0]?.count || 0) + parseInt(invoices.rows[0]?.count || 0))
        });
    } catch (error) {
        res.json({ overdueTasks: 0, overdueInvoices: 0, alerts: 0 });
    }
});

// Analytics (certaines sont publiques, d'autres protégées)
app.get('/api/analytics/revenue-trend', authenticateToken, async (req, res) => {
    res.json(Array.from({ length: 30 }, () => 0));
});

app.get('/api/analytics/calls-trend', authenticateToken, async (req, res) => {
    res.json({ calls: [0, 0, 0, 0, 0, 0, 0], meetings: [0, 0, 0, 0, 0, 0, 0] });
});

app.get('/api/analytics/conversion-funnel', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT stage, COUNT(*)::int AS count
            FROM leads
            GROUP BY stage
        `);
        const counts = Object.fromEntries(result.rows.map(row => [row.stage, row.count]));
        const stages = ['LEAD', 'CONTACTED', 'MEETING', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATING', 'WON'];
        res.json(stages.map(stage => ({ stage, count: counts[stage] || 0 })));
    } catch (error) {
        res.json(['LEAD', 'CONTACTED', 'MEETING', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATING', 'WON'].map(stage => ({ stage, count: 0 })));
    }
});

app.get('/api/analytics/mrr-trend', authenticateToken, async (req, res) => {
    res.json(Array.from({ length: 12 }, () => 0));
});

app.get('/api/leads/geo', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT company_name AS company, contact_name AS contact, COALESCE(deal_value, estimated_value, 0) AS value, stage, lat, lng
            FROM leads
            WHERE lat IS NOT NULL AND lng IS NOT NULL
        `);
        res.json(result.rows);
    } catch (error) {
        res.json([]);
    }
});

// Screen Monitoring
const ensureScreenSessionsTable = async () => {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS screen_sessions (
            id SERIAL PRIMARY KEY,
            freelancer_id INTEGER,
            project_id INTEGER,
            status VARCHAR(50) DEFAULT 'Active',
            start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            end_time TIMESTAMP,
            lines_written INTEGER DEFAULT 0,
            ide_used VARCHAR(100),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
};

app.post('/api/screen-monitor/start-session', authenticateToken, async (req, res) => {
    const freelancerId = req.userId;
    const projectId = Number.isInteger(Number(req.body.projectId)) ? Number(req.body.projectId) : null;

    try {
        await ensureScreenSessionsTable();
        const result = await pool.query(
            `INSERT INTO screen_sessions (freelancer_id, project_id, status, start_time)
             VALUES ($1, $2, $3, NOW())
             RETURNING id, freelancer_id, project_id, status, start_time, end_time`,
            [freelancerId, projectId, 'Active']
        );

        res.status(201).json({ success: true, sessionId: result.rows[0].id, session: result.rows[0] });
    } catch (error) {
        console.error('Start screen session error:', error);
        res.status(500).json({ success: false, message: 'Failed to start screen monitoring session' });
    }
});

app.put('/api/screen-monitor/sessions/:sessionId/end', authenticateToken, async (req, res) => {
    const sessionId = Number(req.params.sessionId);

    if (!Number.isInteger(sessionId)) {
        return res.status(400).json({ success: false, message: 'Invalid session id' });
    }

    try {
        await ensureScreenSessionsTable();
        const result = await pool.query(
            `UPDATE screen_sessions
             SET end_time = NOW(),
                 status = $1,
                 lines_written = COALESCE($2, lines_written),
                 ide_used = COALESCE($3, ide_used)
             WHERE id = $4
             RETURNING id, freelancer_id, project_id, status, start_time, end_time, lines_written, ide_used`,
            ['Completed', req.body.linesWritten ?? null, req.body.ideUsed || null, sessionId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Session not found' });
        }

        res.json({ success: true, session: result.rows[0] });
    } catch (error) {
        console.error('End screen session error:', error);
        res.status(500).json({ success: false, message: 'Failed to end screen monitoring session' });
    }
});

app.get('/api/screen-monitor/sessions/:freelancerId', authenticateToken, async (req, res) => {
    try {
        await ensureScreenSessionsTable();
        const result = await pool.query('SELECT * FROM screen_sessions WHERE freelancer_id = $1 ORDER BY start_time DESC', [req.userId]);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Call Recording
app.get('/api/call-recording/calls/:callerId', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM calls WHERE caller_id = $1 ORDER BY start_time DESC', [req.params.callerId]);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Auth/Me (protégée)
app.get('/api/auth/me', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT id, full_name as name, email, role FROM users WHERE id = $1', [req.userId]);
        if (result.rows.length === 0) return res.status(404).json({ message: 'User not found' });
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
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

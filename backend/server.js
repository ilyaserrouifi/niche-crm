const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');
const multer = require('multer');
const bcrypt = require('bcrypt');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

const upload = multer();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..')));
app.use('/page', express.static(path.join(__dirname, '..', 'page')));
app.use('/assets', express.static(path.join(__dirname, '..', 'assets')));

// ============================================================
// AUTHENTICATION MIDDLEWARE (À mettre ici, avant toutes les routes)
// ============================================================
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ message: 'Access denied. No token provided.' });
    }
    
    try {
        const decoded = Buffer.from(token, 'base64').toString();
        const userId = decoded.split(':')[0];
        req.userId = parseInt(userId);
        next();
    } catch (error) {
        return res.status(403).json({ message: 'Invalid token.' });
    }
};

// Health check (public)
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'API is running', timestamp: new Date().toISOString() });
});

// ============================================================
// AUTH ROUTES (PUBLIC)
// ============================================================
app.post('/api/auth/register', upload.none(), async (req, res) => {
    // ... code existant ...
    res.json({ success: true });
});

app.post('/api/auth/login', async (req, res) => {
    // ... code existant ...
    res.json({ success: true, token });
});

// ============================================================
// ROUTES PROTÉGÉES (avec authenticateToken)
// ============================================================

// Dashboard
app.get('/api/dashboard', authenticateToken, async (req, res) => {
    // ... code existant ...
});

// Users
app.get('/api/users/me', authenticateToken, async (req, res) => {
    // ... code existant ...
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
    // ... code existant ...
});

app.get('/api/analytics/conversion-funnel', authenticateToken, async (req, res) => {
    // ... code existant ...
});

// Screen Monitoring
app.get('/api/screen-monitor/sessions/:freelancerId', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM screen_sessions WHERE freelancer_id = $1 ORDER BY start_time DESC', [req.params.freelancerId]);
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
        const result = await pool.query('SELECT id, full_name as name, email, role, avatar_initials as avatarUrl FROM users WHERE id = $1', [req.userId]);
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
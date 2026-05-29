const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files
app.use(express.static(path.join(__dirname, '..')));
app.use('/page', express.static(path.join(__dirname, '..', 'page')));
app.use('/assets', express.static(path.join(__dirname, '..', 'assets')));

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'API is running', timestamp: new Date().toISOString() });
});

// REGISTER
app.post('/api/auth/register', async (req, res) => {
    const { full_name, email, username, phone, role, password_hash, avatar_initials } = req.body;
    try {
        const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (existing.rows.length > 0) {
            return res.status(400).json({ success: false, message: 'Email already exists' });
        }
        const result = await pool.query(
            `INSERT INTO users (email, password_hash, full_name, username, phone, role, status, avatar_initials) 
             VALUES ($1, $2, $3, $4, $5, $6, 'active', $7) RETURNING id, email, role, full_name`,
            [email, password_hash, full_name, username, phone, role || 'client', avatar_initials || null]
        );
        const token = Buffer.from(`${result.rows[0].id}:${Date.now()}`).toString('base64');
        res.json({ success: true, token: token, user: result.rows[0] });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// LOGIN
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (result.rows.length === 0) {
            return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
        }
        const user = result.rows[0];
        if (password === user.password_hash) {
            const token = Buffer.from(`${user.id}:${Date.now()}`).toString('base64');
            res.json({
                success: true,
                token: token,
                role: user.role,
                name: user.full_name,
                id: user.id,
                email: user.email,
                avatar_initials: user.avatar_initials
            });
        } else {
            res.status(401).json({ message: 'Email ou mot de passe incorrect' });
        }
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// USERS
app.get('/api/users/me', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Unauthorized' });
    try {
        const userId = parseInt(Buffer.from(token, 'base64').toString().split(':')[0]);
        const result = await pool.query('SELECT id, email, full_name, username, phone, role, avatar_initials, created_at FROM users WHERE id = $1', [userId]);
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// LEADS
app.get('/api/leads', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM leads ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// DASHBOARD
app.get('/api/dashboard', async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const pipelineTotal = await pool.query("SELECT COALESCE(SUM(estimated_value), 0) FROM leads WHERE stage NOT IN ('CLOSED_WON', 'CLOSED_LOST')");
        const mrr = await pool.query("SELECT COALESCE(SUM(amount), 0) FROM invoices WHERE status = 'paid' AND EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM CURRENT_DATE)");
        const expenses = await pool.query("SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE EXTRACT(MONTH FROM expense_date) = EXTRACT(MONTH FROM CURRENT_DATE)");
        
        res.json({
            todayCalls: 0,
            todayMeetings: 0,
            todayDeals: 0,
            todayRevenue: 0,
            pipelineTotal: parseFloat(pipelineTotal.rows[0].coalesce) || 0,
            pipelineMonth: 0,
            pipelineAtRisk: 0,
            topPerformer: '—',
            needsAttention: '—',
            mrr: parseFloat(mrr.rows[0].coalesce) || 0,
            expenses: parseFloat(expenses.rows[0].coalesce) || 0,
            netProfit: (parseFloat(mrr.rows[0].coalesce) || 0) - (parseFloat(expenses.rows[0].coalesce) || 0)
        });
    } catch (error) {
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// CLIENTS
app.get('/api/clients', async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM users WHERE role = 'client' ORDER BY created_at DESC");
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// PROJECTS
app.get('/api/projects', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM projects ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// ANALYTICS - LEADERBOARD
app.get('/api/analytics/leaderboard', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT u.id, u.full_name, u.role, COUNT(DISTINCT l.id) as leads_count, COALESCE(SUM(i.amount), 0) as revenue
            FROM users u
            LEFT JOIN leads l ON l.assigned_to = u.id
            LEFT JOIN invoices i ON i.client_id = u.id
            WHERE u.role IN ('caller', 'outreacher', 'admin')
            GROUP BY u.id, u.full_name, u.role
            ORDER BY revenue DESC LIMIT 10
        `);
        res.json(result.rows);
    } catch (error) {
        res.json([]);
    }
});

// ANALYTICS - FUNNEL
app.get('/api/analytics/conversion-funnel', async (req, res) => {
    try {
        const stages = ['LEAD', 'CONTACTED', 'MEETING_BOOKED', 'QUALIFIED', 'PROPOSAL_SENT', 'NEGOTIATING', 'CLOSED_WON', 'CLOSED_LOST'];
        const result = [];
        for (const stage of stages) {
            const count = await pool.query('SELECT COUNT(*) FROM leads WHERE stage = $1', [stage]);
            result.push({ stage: stage, count: parseInt(count.rows[0].count) });
        }
        res.json(result);
    } catch (error) {
        res.json([]);
    }
});

// FINANCE
app.get('/api/finance/invoices', async (req, res) => {
    try { const r = await pool.query('SELECT * FROM invoices ORDER BY created_at DESC'); res.json(r.rows); } 
    catch(e) { res.json([]); }
});

app.get('/api/finance/expenses', async (req, res) => {
    try { const r = await pool.query('SELECT * FROM expenses ORDER BY expense_date DESC'); res.json(r.rows); } 
    catch(e) { res.json([]); }
});

app.get('/api/cold-callers', async (req, res) => {
    try { const r = await pool.query("SELECT * FROM users WHERE role = 'caller'"); res.json(r.rows); } 
    catch(e) { res.json([]); }
});

app.get('/api/outreachers', async (req, res) => {
    try { const r = await pool.query("SELECT * FROM users WHERE role = 'outreacher'"); res.json(r.rows); } 
    catch(e) { res.json([]); }
});

app.get('/api/freelancers', async (req, res) => {
    try { const r = await pool.query("SELECT * FROM users WHERE role = 'freelancer'"); res.json(r.rows); } 
    catch(e) { res.json([]); }
});

if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
}

module.exports = app;
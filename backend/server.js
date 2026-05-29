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

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'API is running', timestamp: new Date().toISOString() });
});

// ============================================================
// AUTH ROUTES
// ============================================================
app.post('/api/auth/register', upload.none(), async (req, res) => {
    const { full_name, email, username, phone, role, password, avatar_initials } = req.body;
    try {
        const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (existing.rows.length > 0) {
            return res.status(400).json({ success: false, message: 'Email already exists' });
        }
        const password_hash = await bcrypt.hash(password || 'defaultpass', 10);
        const result = await pool.query(
            `INSERT INTO users (email, password_hash, full_name, username, phone, role, status, avatar_initials) 
             VALUES ($1, $2, $3, $4, $5, $6, 'active', $7) 
             RETURNING id, email, role, full_name`,
            [email, password_hash, full_name, username, phone, role || 'client', avatar_initials || null]
        );
        const token = Buffer.from(`${result.rows[0].id}:${Date.now()}`).toString('base64');
        res.json({ success: true, token: token, user: result.rows[0] });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (result.rows.length === 0) {
            return res.status(401).json({ success: false, message: 'Email ou mot de passe incorrect' });
        }
        const user = result.rows[0];
        const match = await bcrypt.compare(password, user.password_hash);
        if (match) {
            const token = Buffer.from(`${user.id}:${Date.now()}`).toString('base64');
            res.json({ success: true, token, role: user.role, name: user.full_name, id: user.id, email: user.email, avatar_initials: user.avatar_initials });
        } else {
            res.status(401).json({ success: false, message: 'Email ou mot de passe incorrect' });
        }
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: 'Erreur serveur', error: error.message });
    }
});

// ============================================================
// USERS ROUTES
// ============================================================
app.get('/api/users/me', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Unauthorized' });
    try {
        const userId = parseInt(Buffer.from(token, 'base64').toString().split(':')[0]);
        const result = await pool.query('SELECT id, email, full_name, username, phone, role, country, city, address, specialization, bio, avatar_initials, created_at FROM users WHERE id = $1', [userId]);
        if (result.rows.length === 0) return res.status(404).json({ message: 'User not found' });
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

app.put('/api/users/me', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Unauthorized' });
    try {
        const userId = parseInt(Buffer.from(token, 'base64').toString().split(':')[0]);
        const { full_name, username, phone, country, city, address, specialization, bio } = req.body;
        const result = await pool.query(
            `UPDATE users SET full_name = COALESCE($1, full_name), username = COALESCE($2, username), phone = COALESCE($3, phone), country = COALESCE($4, country), city = COALESCE($5, city), address = COALESCE($6, address), specialization = COALESCE($7, specialization), bio = COALESCE($8, bio), updated_at = CURRENT_TIMESTAMP WHERE id = $9 RETURNING id, email, full_name, username, phone, role, country, city, address, specialization, bio`,
            [full_name, username, phone, country, city, address, specialization, bio, userId]
        );
        if (result.rows.length === 0) return res.status(404).json({ message: 'User not found' });
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// ============================================================
// LEADS
// ============================================================
app.get('/api/leads', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM leads ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// ============================================================
// DASHBOARD
// ============================================================
app.get('/api/dashboard', async (req, res) => {
    try {
        const pipelineTotal = await pool.query("SELECT COALESCE(SUM(estimated_value), 0) FROM leads WHERE stage NOT IN ('CLOSED_WON', 'CLOSED_LOST')");
        const mrr = await pool.query("SELECT COALESCE(SUM(amount), 0) FROM invoices WHERE status = 'paid' AND EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM CURRENT_DATE)");
        const expenses = await pool.query("SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE EXTRACT(MONTH FROM expense_date) = EXTRACT(MONTH FROM CURRENT_DATE)");
        res.json({
            todayCalls: 0, todayMeetings: 0, todayDeals: 0, todayRevenue: 0,
            pipelineTotal: parseFloat(pipelineTotal.rows[0].coalesce) || 0,
            pipelineMonth: 0, pipelineAtRisk: 0,
            topPerformer: '—', needsAttention: '—',
            mrr: parseFloat(mrr.rows[0].coalesce) || 0,
            expenses: parseFloat(expenses.rows[0].coalesce) || 0,
            netProfit: (parseFloat(mrr.rows[0].coalesce) || 0) - (parseFloat(expenses.rows[0].coalesce) || 0)
        });
    } catch (error) {
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// ============================================================
// CLIENTS & PROJECTS
// ============================================================
app.get('/api/clients', async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM users WHERE role = 'client' ORDER BY created_at DESC");
        res.json(result.rows);
    } catch (error) { res.status(500).json({ message: error.message }); }
});

app.get('/api/projects', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM projects ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (error) { res.status(500).json({ message: error.message }); }
});

// ============================================================
// ANALYTICS ROUTES
// ============================================================
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
    } catch (error) { res.json([]); }
});

app.get('/api/analytics/conversion-funnel', async (req, res) => {
    try {
        const stages = ['LEAD', 'CONTACTED', 'MEETING_BOOKED', 'QUALIFIED', 'PROPOSAL_SENT', 'NEGOTIATING', 'CLOSED_WON', 'CLOSED_LOST'];
        const result = [];
        for (const stage of stages) {
            const count = await pool.query('SELECT COUNT(*) FROM leads WHERE stage = $1', [stage]);
            result.push({ stage, count: parseInt(count.rows[0].count) });
        }
        res.json(result);
    } catch (error) { res.json([]); }
});

// ============================================================
// ANALYTICS - NEW ENDPOINTS FOR CHARTS
// ============================================================

// Calls trend (7 days)
app.get('/api/analytics/calls-trend', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT DATE(call_time) as day, COUNT(*) as count
            FROM calls
            WHERE call_time > NOW() - INTERVAL '7 days'
            GROUP BY DATE(call_time)
            ORDER BY day ASC
        `);
        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        const data = days.map(() => 0);
        result.rows.forEach(row => {
            const dayIndex = new Date(row.day).getDay();
            if (dayIndex >= 1 && dayIndex <= 7) data[dayIndex - 1] = parseInt(row.count);
        });
        res.json(data);
    } catch (error) {
        console.error('Calls trend error:', error);
        res.json([0,0,0,0,0,0,0]);
    }
});

// Revenue trend (30 days)
app.get('/api/analytics/revenue-trend', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT DATE(created_at) as day, SUM(amount) as revenue
            FROM invoices
            WHERE created_at > NOW() - INTERVAL '30 days' AND status = 'paid'
            GROUP BY DATE(created_at)
            ORDER BY day ASC
        `);
        const data = Array(30).fill(0);
        result.rows.forEach((row, index) => {
            if (index < 30) data[index] = parseFloat(row.revenue) || 0;
        });
        res.json(data);
    } catch (error) {
        console.error('Revenue trend error:', error);
        res.json(Array(30).fill(0));
    }
});

// MRR growth (12 months)
app.get('/api/analytics/mrr-growth', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT DATE_TRUNC('month', created_at) as month, SUM(amount) as mrr
            FROM invoices
            WHERE created_at > NOW() - INTERVAL '12 months' AND status = 'paid'
            GROUP BY DATE_TRUNC('month', created_at)
            ORDER BY month ASC
        `);
        const data = Array(12).fill(0);
        result.rows.forEach((row, index) => {
            if (index < 12) data[index] = parseFloat(row.mrr) || 0;
        });
        res.json(data);
    } catch (error) {
        console.error('MRR growth error:', error);
        res.json(Array(12).fill(0));
    }
});

// Revenue by niche
app.get('/api/analytics/revenue-by-niche', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT niche, SUM(estimated_value) as revenue
            FROM leads
            WHERE niche IS NOT NULL
            GROUP BY niche
        `);
        const niches = ['SaaS', 'E-commerce', 'HealthTech', 'Energy', 'Other'];
        const data = niches.map(niche => {
            const row = result.rows.find(r => r.niche === niche);
            return row ? parseFloat(row.revenue) : 0;
        });
        res.json(data);
    } catch (error) {
        console.error('Revenue by niche error:', error);
        res.json([0,0,0,0,0]);
    }
});

// Revenue by service
app.get('/api/analytics/revenue-by-service', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT project_name as service, SUM(budget) as revenue
            FROM projects
            GROUP BY project_name
        `);
        const services = ['SEO', 'Ads', 'Design', 'Development', 'Consulting'];
        const data = services.map(service => {
            const row = result.rows.find(r => r.service === service);
            return row ? parseFloat(row.revenue) : 0;
        });
        res.json(data);
    } catch (error) {
        console.error('Revenue by service error:', error);
        res.json([0,0,0,0,0]);
    }
});

// ============================================================
// FINANCE ROUTES
// ============================================================
app.get('/api/finance/invoices', async (req, res) => {
    try { const r = await pool.query('SELECT * FROM invoices ORDER BY created_at DESC'); res.json(r.rows); } 
    catch(e) { res.json([]); }
});

app.get('/api/finance/expenses', async (req, res) => {
    try { const r = await pool.query('SELECT * FROM expenses ORDER BY expense_date DESC'); res.json(r.rows); } 
    catch(e) { res.json([]); }
});

// ============================================================
// PEOPLE ROUTES
// ============================================================
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

// ============================================================
// START SERVER
// ============================================================
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
}

module.exports = app;
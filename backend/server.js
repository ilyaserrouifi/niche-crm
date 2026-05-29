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
    res.json({ status: 'ok', message: 'API is running' });
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
                email: user.email
            });
        } else {
            res.status(401).json({ message: 'Email ou mot de passe incorrect' });
        }
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Erreur serveur', error: error.message });
    }
});

// REGISTER
app.post('/api/auth/register', async (req, res) => {
    const { full_name, email, username, phone, role, password_hash } = req.body;
    try {
        const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (existing.rows.length > 0) {
            return res.status(400).json({ success: false, message: 'Email already exists' });
        }
        const result = await pool.query(
            `INSERT INTO users (email, password_hash, full_name, username, phone, role, status) 
             VALUES ($1, $2, $3, $4, $5, $6, 'active') RETURNING id, email, role`,
            [email, password_hash, full_name, username, phone, role || 'client']
        );
        res.json({ success: true, user: result.rows[0] });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
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
            mrr: 0,
            expenses: 0,
            netProfit: 0
        });
    } catch (error) {
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// ANALYTICS LEADERBOARD
app.get('/api/analytics/leaderboard', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT u.id, u.full_name, u.role, COUNT(l.id) as leads_count
            FROM users u
            LEFT JOIN leads l ON l.assigned_to = u.id
            WHERE u.role IN ('caller', 'outreacher', 'admin')
            GROUP BY u.id, u.full_name, u.role
            LIMIT 10
        `);
        res.json(result.rows);
    } catch (error) {
        res.json([]);
    }
});

// Start server
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;
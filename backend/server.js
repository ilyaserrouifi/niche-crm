const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const { pool } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('db', pool);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..')));
app.use('/page', express.static(path.join(__dirname, '..', 'page')));
app.use('/pages', express.static(path.join(__dirname, '..', 'page')));

// ⬇️⬇️⬇️ هاد السطر الجديد باش تخدم الصور من مجلد assets ⬇️⬇️⬇️
app.use('/assets', express.static(path.join(__dirname, '..', 'assets')));
// ⬆️⬆️⬆️ ⬆️⬆️⬆️

// ============================================================
// ROUTES API
// ============================================================
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/pipeline', require('./routes/pipeline'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/finance', require('./routes/finance'));
app.use('/api/analytics', require('./routes/analytics'));

// ============================================================
// API - REGISTRATION (INSCRIPTION)
// ============================================================
app.post('/api/auth/register', async (req, res) => {
    const { full_name, email, username, phone, role, password_hash } = req.body;
    try {
        // Vérifier si l'email existe déjà
        const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (existing.rows.length > 0) {
            return res.status(400).json({ success: false, message: 'Email already exists' });
        }
        
        // Insérer le nouvel utilisateur
        const result = await pool.query(
            `INSERT INTO users (email, password_hash, full_name, username, phone, role, status) 
             VALUES ($1, $2, $3, $4, $5, $6, 'active') RETURNING id, email, role`,
            [email, password_hash, full_name, username, phone, role]
        );
        
        res.json({ success: true, user: result.rows[0] });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ============================================================
// API - LOGIN (CONNEXION)
// ============================================================
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
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// ============================================================
// API - DASHBOARD
// ============================================================
app.get('/api/dashboard', async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const callsToday = await pool.query('SELECT COUNT(*) FROM calls WHERE DATE(call_time) = $1', [today]);
        const meetingsToday = await pool.query("SELECT COUNT(*) FROM leads WHERE stage = 'MEETING_BOOKED'");
        const dealsToday = await pool.query("SELECT COUNT(*) FROM leads WHERE stage = 'CLOSED_WON' AND DATE(updated_at) = $1", [today]);
        const revenueToday = await pool.query("SELECT COALESCE(SUM(amount), 0) FROM invoices WHERE DATE(created_at) = $1 AND status = 'paid'", [today]);
        const pipelineTotal = await pool.query("SELECT COALESCE(SUM(estimated_value), 0) FROM leads WHERE stage NOT IN ('CLOSED_WON', 'CLOSED_LOST')");
        const mrr = await pool.query("SELECT COALESCE(SUM(amount), 0) FROM invoices WHERE status = 'paid' AND EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM CURRENT_DATE)");
        const expenses = await pool.query("SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE EXTRACT(MONTH FROM expense_date) = EXTRACT(MONTH FROM CURRENT_DATE)");
        
        res.json({
            todayCalls: parseInt(callsToday.rows[0].count) || 0,
            todayMeetings: parseInt(meetingsToday.rows[0].count) || 0,
            todayDeals: parseInt(dealsToday.rows[0].count) || 0,
            todayRevenue: parseFloat(revenueToday.rows[0].coalesce) || 0,
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
        console.error('Dashboard error:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// ============================================================
// API - REQUEST ACCESS (DEMANDE D'ACCÈS)
// ============================================================
app.post('/api/auth/request-access', async (req, res) => {
    const { name, email, company, role, message } = req.body;
    try {
        // Ici tu peux envoyer un email ou stocker dans une table "access_requests"
        console.log('Demande d\'accès reçue:', { name, email, company, role, message });
        res.json({ success: true, message: 'Request sent successfully' });
    } catch (error) {
        console.error('Request access error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ============================================================
// API - COLD CALLERS
// ============================================================
app.get('/api/cold-callers', async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM users WHERE role = 'caller' ORDER BY created_at DESC");
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.post('/api/cold-callers', async (req, res) => {
    const { full_name, email, phone, salary, niche } = req.body;
    try {
        const result = await pool.query(
            `INSERT INTO users (full_name, email, phone, role, salary, niche, password_hash, status) 
             VALUES ($1, $2, $3, $4, $5, $6, 'temp123', 'active') RETURNING *`,
            [full_name, email, phone, 'caller', salary, niche]
        );
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// ============================================================
// API - OUTREACHERS
// ============================================================
app.get('/api/outreachers', async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM users WHERE role = 'outreacher' ORDER BY created_at DESC");
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// ============================================================
// API - FREELANCERS
// ============================================================
app.get('/api/freelancers', async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM users WHERE role = 'freelancer' ORDER BY created_at DESC");
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// ============================================================
// API - CLIENTS
// ============================================================
app.get('/api/clients', async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM users WHERE role = 'client' ORDER BY created_at DESC");
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// ============================================================
// API - PROJECTS
// ============================================================
app.get('/api/projects', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM projects ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// ============================================================
// API - EXPORT (CSV)
// ============================================================
app.get('/api/export/:type', async (req, res) => {
    const { type } = req.params;
    try {
        let data = [];
        let filename = '';
        if (type === 'leads') {
            data = await pool.query('SELECT * FROM leads');
            filename = 'leads_export.csv';
        } else if (type === 'tasks') {
            data = await pool.query('SELECT * FROM tasks');
            filename = 'tasks_export.csv';
        } else if (type === 'invoices') {
            data = await pool.query('SELECT * FROM invoices');
            filename = 'invoices_export.csv';
        } else {
            return res.status(400).json({ message: 'Type non supporté' });
        }
        
        if (data.rows.length === 0) {
            return res.status(404).json({ message: 'No data to export' });
        }
        
        let csv = Object.keys(data.rows[0]).join(',') + '\n';
        data.rows.forEach(row => {
            csv += Object.values(row).join(',') + '\n';
        });
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
        res.send(csv);
    } catch (error) {
        console.error('Export error:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// ============================================================
// DÉMARRAGE DU SERVEUR
// ============================================================
app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║   🚀 NICHE CRM API - SERVEUR DÉMARRÉ                    ║
║                                                          ║
║   📍 URL: http://localhost:${PORT}                       ║
║   📊 Dashboard: http://localhost:${PORT}/index.html      ║
║   🔑 Login: http://localhost:${PORT}/login.html          ║
║   📝 Register: http://localhost:${PORT}/register.html    ║
║   🔌 API Ready: /api/*                                   ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
    `);
});
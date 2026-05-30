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
    const { full_name, email, username, phone, role, password, avatar_initials, country, city, address, specialization, bio } = req.body;
    try {
        const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (existing.rows.length > 0) {
            return res.status(400).json({ success: false, message: 'Email already exists' });
        }
        const password_hash = await bcrypt.hash(password || 'defaultpass', 10);
        const result = await pool.query(
            `INSERT INTO users (email, password_hash, full_name, username, phone, role, status, avatar_initials, country, city, address, specialization, bio) 
             VALUES ($1, $2, $3, $4, $5, $6, 'active', $7, $8, $9, $10, $11, $12) 
             RETURNING id, email, role, full_name, username, phone, country, city, address, specialization, bio`,
            [email, password_hash, full_name, username, phone, role || 'client', avatar_initials || null, country || null, city || null, address || null, specialization || null, bio || null]
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

app.post('/api/users/avatar', upload.single('avatar'), async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Unauthorized' });
    try {
        const userId = parseInt(Buffer.from(token, 'base64').toString().split(':')[0]);
        // Stocker l'URL de l'avatar (ici on simule, dans la réalité on uploaderait vers S3)
        const avatarUrl = req.file ? `/uploads/avatars/${userId}.jpg` : null;
        if (avatarUrl) {
            await pool.query('UPDATE users SET avatar_url = $1 WHERE id = $2', [avatarUrl, userId]);
        }
        res.json({ success: true, avatar_url: avatarUrl });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// ============================================================
// CLIENTS ROUTES (COMPLET)
// ============================================================
app.get('/api/clients', async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM users WHERE role = 'client' ORDER BY created_at DESC");
        res.json(result.rows);
    } catch (error) { 
        res.status(500).json({ message: error.message }); 
    }
});

app.get('/api/clients/:id', async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM users WHERE id = $1 AND role = 'client'", [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ message: 'Client not found' });
        res.json(result.rows[0]);
    } catch (error) { 
        res.status(500).json({ message: error.message }); 
    }
});

app.post('/api/clients', async (req, res) => {
    const { company, contact, email, phone, niche, budget, status, address } = req.body;
    try {
        const result = await pool.query(
            `INSERT INTO clients (company, contact, email, phone, niche, budget, status, address) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [company, contact, email, phone, niche, budget || 0, status || 'active', address]
        );
        res.json(result.rows[0]);
    } catch (error) { 
        res.status(500).json({ message: error.message }); 
    }
});

app.put('/api/clients/:id', async (req, res) => {
    const { company, contact, email, phone, niche, budget, status, address } = req.body;
    try {
        const result = await pool.query(
            `UPDATE clients SET company = COALESCE($1, company), contact = COALESCE($2, contact), email = COALESCE($3, email), phone = COALESCE($4, phone), niche = COALESCE($5, niche), budget = COALESCE($6, budget), status = COALESCE($7, status), address = COALESCE($8, address) WHERE id = $9 RETURNING *`,
            [company, contact, email, phone, niche, budget, status, address, req.params.id]
        );
        res.json(result.rows[0]);
    } catch (error) { 
        res.status(500).json({ message: error.message }); 
    }
});

app.delete('/api/clients/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM clients WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (error) { 
        res.status(500).json({ message: error.message }); 
    }
});

// ============================================================
// PROJECTS ROUTES (COMPLET)
// ============================================================
app.get('/api/projects', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM projects ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (error) { 
        res.status(500).json({ message: error.message }); 
    }
});

app.get('/api/projects/:id', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM projects WHERE id = $1', [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ message: 'Project not found' });
        res.json(result.rows[0]);
    } catch (error) { 
        res.status(500).json({ message: error.message }); 
    }
});

app.get('/api/clients/:clientId/projects', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM projects WHERE client_id = $1 ORDER BY created_at DESC', [req.params.clientId]);
        res.json(result.rows);
    } catch (error) { 
        res.json([]); 
    }
});

app.post('/api/projects', async (req, res) => {
    const { name, client_id, description, services, budget, status, start_date, end_date } = req.body;
    try {
        const result = await pool.query(
            `INSERT INTO projects (name, client_id, description, services, budget, status, start_date, end_date) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [name, client_id, description, services, budget || 0, status || 'active', start_date, end_date]
        );
        res.json(result.rows[0]);
    } catch (error) { 
        res.status(500).json({ message: error.message }); 
    }
});

app.put('/api/projects/:id', async (req, res) => {
    const { name, client_id, description, services, budget, status, progress, start_date, end_date } = req.body;
    try {
        const result = await pool.query(
            `UPDATE projects SET name = COALESCE($1, name), client_id = COALESCE($2, client_id), description = COALESCE($3, description), services = COALESCE($4, services), budget = COALESCE($5, budget), status = COALESCE($6, status), progress = COALESCE($7, progress), start_date = COALESCE($8, start_date), end_date = COALESCE($9, end_date) WHERE id = $10 RETURNING *`,
            [name, client_id, description, services, budget, status, progress, start_date, end_date, req.params.id]
        );
        res.json(result.rows[0]);
    } catch (error) { 
        res.status(500).json({ message: error.message }); 
    }
});

app.delete('/api/projects/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM projects WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (error) { 
        res.status(500).json({ message: error.message }); 
    }
});

// ============================================================
// TASKS ROUTES (COMPLET)
// ============================================================
app.get('/api/tasks', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM tasks ORDER BY deadline ASC, created_at DESC');
        res.json(result.rows);
    } catch (error) { 
        res.status(500).json({ message: error.message }); 
    }
});

app.get('/api/projects/:projectId/tasks', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM tasks WHERE project_id = $1 ORDER BY deadline ASC', [req.params.projectId]);
        res.json(result.rows);
    } catch (error) { 
        res.json([]); 
    }
});

app.post('/api/tasks', async (req, res) => {
    const { name, project_id, assigned_to, description, priority, status, deadline, visible_to_client } = req.body;
    try {
        const result = await pool.query(
            `INSERT INTO tasks (name, project_id, assigned_to, description, priority, status, deadline, visible_to_client) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [name, project_id, assigned_to, description, priority || 'Medium', status || 'To Do', deadline, visible_to_client || false]
        );
        res.json(result.rows[0]);
    } catch (error) { 
        res.status(500).json({ message: error.message }); 
    }
});

app.put('/api/tasks/:id', async (req, res) => {
    const { name, assigned_to, description, priority, status, deadline, visible_to_client } = req.body;
    try {
        const result = await pool.query(
            `UPDATE tasks SET name = COALESCE($1, name), assigned_to = COALESCE($2, assigned_to), description = COALESCE($3, description), priority = COALESCE($4, priority), status = COALESCE($5, status), deadline = COALESCE($6, deadline), visible_to_client = COALESCE($7, visible_to_client) WHERE id = $8 RETURNING *`,
            [name, assigned_to, description, priority, status, deadline, visible_to_client, req.params.id]
        );
        res.json(result.rows[0]);
    } catch (error) { 
        res.status(500).json({ message: error.message }); 
    }
});

app.delete('/api/tasks/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM tasks WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (error) { 
        res.status(500).json({ message: error.message }); 
    }
});

// ============================================================
// FINANCE ROUTES (COMPLET)
// ============================================================
app.get('/api/finance/invoices', async (req, res) => {
    try { 
        const r = await pool.query('SELECT * FROM invoices ORDER BY created_at DESC'); 
        res.json(r.rows); 
    } catch(e) { 
        res.json([]); 
    }
});

app.post('/api/finance/invoices', async (req, res) => {
    const { client_name, amount, date, service, recurring, status } = req.body;
    try {
        const result = await pool.query(
            `INSERT INTO invoices (client_name, amount, invoice_date, service, recurring, status) 
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [client_name, amount, date, service, recurring || 'One-time', status || 'Pending']
        );
        res.json(result.rows[0]);
    } catch (error) { 
        res.status(500).json({ message: error.message }); 
    }
});

app.get('/api/finance/expenses', async (req, res) => {
    try { 
        const r = await pool.query('SELECT * FROM expenses ORDER BY expense_date DESC'); 
        res.json(r.rows); 
    } catch(e) { 
        res.json([]); 
    }
});

app.post('/api/finance/expenses', async (req, res) => {
    const { category, amount, vendor, date, recurring } = req.body;
    try {
        const result = await pool.query(
            `INSERT INTO expenses (category, amount, vendor, expense_date, recurring) 
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [category, amount, vendor, date, recurring || 'No']
        );
        res.json(result.rows[0]);
    } catch (error) { 
        res.status(500).json({ message: error.message }); 
    }
});

// ============================================================
// PIPELINE / DEALS ROUTES
// ============================================================
app.get('/api/pipeline/deals', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM leads ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (error) { 
        res.json([]); 
    }
});

app.post('/api/pipeline/deals', async (req, res) => {
    const { company, contact, email, phone, value, source, niche, assigned_to, expected_close, pain_notes, next_action } = req.body;
    try {
        const result = await pool.query(
            `INSERT INTO leads (company_name, contact_name, contact_email, contact_phone, estimated_value, source, niche, assigned_to, expected_close_date, pain_notes, next_action, stage) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'LEAD') RETURNING *`,
            [company, contact, email, phone, value, source, niche, assigned_to, expected_close, pain_notes, next_action]
        );
        res.json(result.rows[0]);
    } catch (error) { 
        res.status(500).json({ message: error.message }); 
    }
});

app.put('/api/pipeline/deals/:id', async (req, res) => {
    const { stage, value, expected_close, next_action } = req.body;
    try {
        const result = await pool.query(
            `UPDATE leads SET stage = COALESCE($1, stage), estimated_value = COALESCE($2, estimated_value), expected_close_date = COALESCE($3, expected_close_date), next_action = COALESCE($4, next_action), updated_at = CURRENT_TIMESTAMP WHERE id = $5 RETURNING *`,
            [stage, value, expected_close, next_action, req.params.id]
        );
        res.json(result.rows[0]);
    } catch (error) { 
        res.status(500).json({ message: error.message }); 
    }
});

// ============================================================
// COLD CALLERS ROUTES
// ============================================================
app.get('/api/cold-callers', async (req, res) => {
    try { 
        const r = await pool.query("SELECT * FROM users WHERE role = 'caller' ORDER BY created_at DESC"); 
        res.json(r.rows); 
    } catch(e) { 
        res.json([]); 
    }
});

app.get('/api/cold-callers/:id', async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM users WHERE id = $1 AND role = 'caller'", [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ message: 'Caller not found' });
        res.json(result.rows[0]);
    } catch (error) { 
        res.status(500).json({ message: error.message }); 
    }
});

app.post('/api/cold-callers', async (req, res) => {
    const { name, username, phone, email, niche, salary, commission, bonus } = req.body;
    try {
        const result = await pool.query(
            `INSERT INTO users (full_name, username, phone, email, niche, salary, commission_per_meeting, bonus_per_close, role, status) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'caller', 'active') RETURNING *`,
            [name, username, phone, email, niche, salary || 0, commission || 0, bonus || 0]
        );
        res.json(result.rows[0]);
    } catch (error) { 
        res.status(500).json({ message: error.message }); 
    }
});

// ============================================================
// OUTREACHERS ROUTES
// ============================================================
app.get('/api/outreachers', async (req, res) => {
    try { 
        const r = await pool.query("SELECT * FROM users WHERE role = 'outreacher' ORDER BY created_at DESC"); 
        res.json(r.rows); 
    } catch(e) { 
        res.json([]); 
    }
});

app.post('/api/outreachers', async (req, res) => {
    const { name, username, phone, email, channels, salary, commission } = req.body;
    try {
        const result = await pool.query(
            `INSERT INTO users (full_name, username, phone, email, channels, salary, commission_per_meeting, role, status) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'outreacher', 'active') RETURNING *`,
            [name, username, phone, email, channels, salary || 0, commission || 0]
        );
        res.json(result.rows[0]);
    } catch (error) { 
        res.status(500).json({ message: error.message }); 
    }
});

// ============================================================
// FREELANCERS ROUTES
// ============================================================
app.get('/api/freelancers', async (req, res) => {
    try { 
        const r = await pool.query("SELECT * FROM users WHERE role = 'freelancer' ORDER BY created_at DESC"); 
        res.json(r.rows); 
    } catch(e) { 
        res.json([]); 
    }
});

app.post('/api/freelancers', async (req, res) => {
    const { name, skills, hourly_rate, project_rate, experience, timezone, rating } = req.body;
    try {
        const result = await pool.query(
            `INSERT INTO users (full_name, skills, hourly_rate, project_rate, experience, timezone, rating, role, status) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'freelancer', 'available') RETURNING *`,
            [name, skills, hourly_rate || 0, project_rate || 0, experience, timezone, rating || 0]
        );
        res.json(result.rows[0]);
    } catch (error) { 
        res.status(500).json({ message: error.message }); 
    }
});

// ============================================================
// STAFFING ROUTES
// ============================================================
app.get('/api/staffing/requests', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM staffing_requests ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (error) { 
        res.json([]); 
    }
});

app.post('/api/staffing/requests', async (req, res) => {
    const { company_name, skill, budget, timeline, description } = req.body;
    try {
        const result = await pool.query(
            `INSERT INTO staffing_requests (company_name, skill, budget, timeline, description, status) 
             VALUES ($1, $2, $3, $4, $5, 'Open') RETURNING *`,
            [company_name, skill, budget, timeline, description]
        );
        res.json(result.rows[0]);
    } catch (error) { 
        res.status(500).json({ message: error.message }); 
    }
});

app.get('/api/staffing/placements', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM placements ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (error) { 
        res.json([]); 
    }
});

app.post('/api/staffing/placements', async (req, res) => {
    const { freelancer_id, freelancer_name, request_id, company_name, budget, freelancer_earn, our_profit, start_date } = req.body;
    try {
        const result = await pool.query(
            `INSERT INTO placements (freelancer_id, freelancer_name, request_id, company_name, budget, freelancer_earn, our_profit, start_date, status) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Active') RETURNING *`,
            [freelancer_id, freelancer_name, request_id, company_name, budget, freelancer_earn, our_profit, start_date]
        );
        res.json(result.rows[0]);
    } catch (error) { 
        res.status(500).json({ message: error.message }); 
    }
});

// ============================================================
// LEADS ROUTES
// ============================================================
app.get('/api/leads', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM leads ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.get('/api/leads/geo', async (req, res) => {
    try {
        // Simuler des leads avec coordonnées géographiques
        const mockLeads = [
            { id: 1, company: 'TechCorp USA', contact: 'John Doe', value: 50000, stage: 'LEAD', lat: 40.7128, lng: -74.0060, country: 'USA' },
            { id: 2, company: 'FinTech UK', contact: 'Jane Smith', value: 75000, stage: 'MEETING', lat: 51.5074, lng: -0.1278, country: 'UK' },
            { id: 3, company: 'SaaS France', contact: 'Pierre Martin', value: 45000, stage: 'QUALIFIED', lat: 48.8566, lng: 2.3522, country: 'France' },
            { id: 4, company: 'E-commerce DE', contact: 'Hans Mueller', value: 62000, stage: 'PROPOSAL', lat: 52.5200, lng: 13.4050, country: 'Germany' },
            { id: 5, company: 'HealthTech ES', contact: 'Maria Garcia', value: 38000, stage: 'CONTACTED', lat: 40.4168, lng: -3.7038, country: 'Spain' },
            { id: 6, company: 'Energy CA', contact: 'David Lee', value: 89000, stage: 'NEGOTIATION', lat: 43.6532, lng: -79.3832, country: 'Canada' },
            { id: 7, company: 'AI Startup MA', contact: 'Youssef Alaoui', value: 55000, stage: 'LEAD', lat: 33.5731, lng: -7.5898, country: 'Morocco' },
            { id: 8, company: 'Cloud IT AE', contact: 'Ahmed Mansouri', value: 120000, stage: 'MEETING', lat: 25.2048, lng: 55.2708, country: 'UAE' }
        ];
        res.json(mockLeads);
    } catch (error) {
        res.json([]);
    }
});

// ============================================================
// DASHBOARD STATS
// ============================================================
app.get('/api/dashboard/stats', async (req, res) => {
    try {
        const [totalLeads, totalDeals, totalRevenue, totalClients, totalProjects] = await Promise.all([
            pool.query("SELECT COUNT(*) FROM leads"),
            pool.query("SELECT COUNT(*) FROM leads WHERE stage = 'CLOSED_WON'"),
            pool.query("SELECT COALESCE(SUM(estimated_value), 0) FROM leads WHERE stage = 'CLOSED_WON'"),
            pool.query("SELECT COUNT(*) FROM users WHERE role = 'client'"),
            pool.query("SELECT COUNT(*) FROM projects")
        ]);
        
        res.json({
            totalLeads: parseInt(totalLeads.rows[0]?.count || 0),
            totalDeals: parseInt(totalDeals.rows[0]?.count || 0),
            totalRevenue: parseFloat(totalRevenue.rows[0]?.coalesce || 0),
            totalClients: parseInt(totalClients.rows[0]?.count || 0),
            totalProjects: parseInt(totalProjects.rows[0]?.count || 0)
        });
    } catch (error) {
        res.json({ totalLeads: 0, totalDeals: 0, totalRevenue: 0, totalClients: 0, totalProjects: 0 });
    }
});

app.get('/api/dashboard', async (req, res) => {
    try {
        const pipelineTotal = await pool.query("SELECT COALESCE(SUM(estimated_value), 0) FROM leads WHERE stage NOT IN ('CLOSED_WON', 'CLOSED_LOST')");
        const mrr = await pool.query("SELECT COALESCE(SUM(amount), 0) FROM invoices WHERE status = 'paid' AND EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM CURRENT_DATE)");
        const expenses = await pool.query("SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE EXTRACT(MONTH FROM expense_date) = EXTRACT(MONTH FROM CURRENT_DATE)");
        const totalLeads = await pool.query("SELECT COUNT(*) FROM leads");
        const meetingsBooked = await pool.query("SELECT COUNT(*) FROM leads WHERE stage = 'MEETING_BOOKED'");
        
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
            netProfit: (parseFloat(mrr.rows[0].coalesce) || 0) - (parseFloat(expenses.rows[0].coalesce) || 0),
            totalLeads: parseInt(totalLeads.rows[0].count) || 0,
            meetingsBooked: parseInt(meetingsBooked.rows[0].count) || 0
        });
    } catch (error) {
        res.status(500).json({ message: 'Erreur serveur' });
    }
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
    } catch (error) { 
        res.json([]); 
    }
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
    } catch (error) { 
        res.json([]); 
    }
});

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
        res.json({ calls: data, meetings: data.map(v => Math.floor(v * 0.1)) });
    } catch (error) { 
        res.json({ calls: [0,0,0,0,0,0,0], meetings: [0,0,0,0,0,0,0] }); 
    }
});

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
        res.json(Array(30).fill(0)); 
    }
});

app.get('/api/analytics/mrr-trend', async (req, res) => {
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
        res.json(Array(12).fill(0)); 
    }
});

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
        res.json([0,0,0,0,0]); 
    }
});

app.get('/api/analytics/revenue-by-service', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT service, SUM(amount) as revenue
            FROM invoices
            WHERE service IS NOT NULL
            GROUP BY service
        `);
        const services = ['SEO', 'Ads', 'Design', 'Development', 'Consulting'];
        const data = services.map(service => {
            const row = result.rows.find(r => r.service === service);
            return row ? parseFloat(row.revenue) : 0;
        });
        res.json(data);
    } catch (error) { 
        res.json([0,0,0,0,0]); 
    }
});

app.get('/api/analytics/close-rate-trend', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT DATE(created_at) as day, 
                   COUNT(CASE WHEN stage = 'CLOSED_WON' THEN 1 END) as wins,
                   COUNT(*) as total
            FROM leads
            WHERE created_at > NOW() - INTERVAL '30 days'
            GROUP BY DATE(created_at)
            ORDER BY day ASC
        `);
        const data = result.rows.map(r => r.total > 0 ? parseFloat(((r.wins / r.total) * 100).toFixed(1)) : 0);
        res.json(data);
    } catch (error) { 
        res.json(Array(30).fill(0)); 
    }
});

// ============================================================
// AI ROUTES
// ============================================================
app.post('/api/ai/match-freelancers', async (req, res) => {
    const { skill, budget, timeline } = req.body;
    try {
        let query = `
            SELECT id, full_name, skills, rating, salary, specialization, created_at
            FROM users 
            WHERE role = 'freelancer' 
            AND status = 'active'
        `;
        const params = [];
        
        if (skill) {
            query += ` AND (skills ILIKE $${params.length + 1} OR specialization ILIKE $${params.length + 1})`;
            params.push(`%${skill}%`);
        }
        
        if (budget) {
            query += ` AND (salary <= $${params.length + 1} OR salary IS NULL)`;
            params.push(budget);
        }
        
        query += ` ORDER BY rating DESC NULLS LAST LIMIT 10`;
        
        const result = await pool.query(query, params);
        
        const recommendations = result.rows.map(f => {
            let score = 'D';
            if (f.rating >= 4.5) score = 'A';
            else if (f.rating >= 3.5) score = 'B';
            else if (f.rating >= 2.5) score = 'C';
            
            return {
                id: f.id,
                name: f.full_name,
                skills: f.skills,
                specialization: f.specialization,
                rating: f.rating || 0,
                rate: f.salary || 'Negotiable',
                score: score,
                experience: Math.ceil((new Date() - new Date(f.created_at)) / (1000 * 60 * 60 * 24 * 365)) || 0
            };
        });
        
        res.json({ success: true, recommendations });
    } catch (error) {
        console.error('AI Matching error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/api/ai/calculate-score', async (req, res) => {
    const { userId } = req.body;
    try {
        const result = await pool.query(`
            SELECT u.*, 
                   COUNT(DISTINCT c.id) as total_calls,
                   COUNT(DISTINCT CASE WHEN c.outcome = 'Meeting Booked' THEN c.id END) as meetings_booked
            FROM users u
            LEFT JOIN calls c ON c.caller_id = u.id
            WHERE u.id = $1
            GROUP BY u.id
        `, [userId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        
        const user = result.rows[0];
        const totalCalls = parseInt(user.total_calls) || 0;
        const meetingsBooked = parseInt(user.meetings_booked) || 0;
        const rating = user.rating || 0;
        
        const targetCalls = 50;
        const targetMeetings = 2;
        const targetRating = 5;
        
        const callScore = Math.min(100, (totalCalls / targetCalls) * 100);
        const meetingScore = Math.min(100, (meetingsBooked / targetMeetings) * 100);
        const ratingScore = (rating / targetRating) * 100;
        
        const avgScore = (callScore + meetingScore + ratingScore) / 3;
        
        let score = 'D';
        let color = '#ef4444';
        if (avgScore >= 90) { score = 'A'; color = '#10b981'; }
        else if (avgScore >= 70) { score = 'B'; color = '#60a5fa'; }
        else if (avgScore >= 50) { score = 'C'; color = '#f59e0b'; }
        
        res.json({ 
            success: true, 
            score, 
            color,
            details: {
                totalCalls,
                meetingsBooked,
                rating,
                callScore: Math.round(callScore),
                meetingScore: Math.round(meetingScore),
                ratingScore: Math.round(ratingScore),
                overallScore: Math.round(avgScore)
            }
        });
    } catch (error) {
        console.error('AI Scoring error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.get('/api/ai/revenue-prediction', async (req, res) => {
    try {
        const invoices = await pool.query(`
            SELECT DATE_TRUNC('month', created_at) as month, COALESCE(SUM(amount), 0) as revenue
            FROM invoices 
            WHERE status = 'paid'
            GROUP BY month 
            ORDER BY month ASC
            LIMIT 12
        `);
        
        const revenueData = invoices.rows.map(r => parseFloat(r.revenue));
        
        let prediction = { month1: 0, month2: 0, month3: 0, trend: 'stable', growthRate: 0 };
        
        if (revenueData.length >= 3) {
            const last3Months = revenueData.slice(-3);
            const avgGrowth = (last3Months[2] - last3Months[0]) / 2;
            
            prediction.month1 = Math.max(0, Math.round(last3Months[2] + avgGrowth));
            prediction.month2 = Math.max(0, Math.round(last3Months[2] + (avgGrowth * 2)));
            prediction.month3 = Math.max(0, Math.round(last3Months[2] + (avgGrowth * 3)));
            
            if (avgGrowth > 500) prediction.trend = 'growing';
            else if (avgGrowth < -500) prediction.trend = 'declining';
            
            if (last3Months[2] > 0) {
                prediction.growthRate = ((prediction.month1 / last3Months[2]) * 100 - 100).toFixed(1);
            }
        }
        
        const clients = await pool.query("SELECT status FROM users WHERE role = 'client'");
        const inactiveClients = clients.rows.filter(c => c.status === 'inactive').length;
        const churnRisk = clients.rows.length > 0 ? (inactiveClients / clients.rows.length) * 100 : 0;
        
        res.json({ 
            success: true, 
            prediction,
            churnRisk: churnRisk.toFixed(1),
            historicalData: revenueData,
            totalRevenue: revenueData.reduce((a,b) => a + b, 0)
        });
    } catch (error) {
        console.error('Revenue prediction error:', error);
        res.json({ 
            success: true, 
            prediction: { month1: 0, month2: 0, month3: 0, trend: 'stable', growthRate: 0 },
            churnRisk: 0,
            historicalData: [],
            totalRevenue: 0
        });
    }
});

app.post('/api/ai/recommend-talent', async (req, res) => {
    const { skill, maxRate, minRating } = req.body;
    try {
        let query = `
            SELECT id, full_name, skills, rating, salary, specialization, created_at
            FROM users 
            WHERE role = 'freelancer' 
            AND status = 'active'
        `;
        const params = [];
        
        if (skill) {
            query += ` AND (skills ILIKE $${params.length + 1} OR specialization ILIKE $${params.length + 1})`;
            params.push(`%${skill}%`);
        }
        
        if (maxRate) {
            query += ` AND (salary <= $${params.length + 1} OR salary IS NULL)`;
            params.push(maxRate);
        }
        
        if (minRating) {
            query += ` AND rating >= $${params.length + 1}`;
            params.push(minRating);
        }
        
        query += ` ORDER BY rating DESC NULLS LAST LIMIT 20`;
        
        const result = await pool.query(query, params);
        
        const recommendations = result.rows.map(f => ({
            id: f.id,
            name: f.full_name,
            skills: f.skills,
            specialization: f.specialization,
            rating: f.rating || 0,
            rate: f.salary || 'Negotiable',
            experience: Math.ceil((new Date() - new Date(f.created_at)) / (1000 * 60 * 60 * 24 * 365))
        }));
        
        res.json({ success: true, recommendations, count: recommendations.length });
    } catch (error) {
        console.error('Talent recommendation error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ============================================================
// MESSAGES ROUTES
// ============================================================
app.post('/api/messages', async (req, res) => {
    const { clientId, subject, content, type } = req.body;
    try {
        const result = await pool.query(
            `INSERT INTO messages (client_id, subject, content, type, created_at) 
             VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP) RETURNING *`,
            [clientId, subject, content, type || 'client_message']
        );
        res.json({ success: true, message: result.rows[0] });
    } catch (error) {
        res.json({ success: true, message: { id: Date.now(), subject, content } });
    }
});

app.post('/api/calls/schedule', async (req, res) => {
    const { clientId, datetime, topic, notes } = req.body;
    try {
        const result = await pool.query(
            `INSERT INTO scheduled_calls (client_id, scheduled_at, topic, notes, status) 
             VALUES ($1, $2, $3, $4, 'scheduled') RETURNING *`,
            [clientId, datetime, topic, notes]
        );
        res.json({ success: true, call: result.rows[0] });
    } catch (error) {
        res.json({ success: true, call: { id: Date.now(), scheduled_at: datetime, topic } });
    }
});

// ============================================================
// START SERVER
// ============================================================
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`🚀 Server running on http://localhost:${PORT}`);
        console.log(`📊 API endpoints ready:`);
        console.log(`   - GET  /api/health`);
        console.log(`   - POST /api/auth/login`);
        console.log(`   - POST /api/auth/register`);
        console.log(`   - GET  /api/dashboard`);
        console.log(`   - CRUD /api/clients`);
        console.log(`   - CRUD /api/projects`);
        console.log(`   - CRUD /api/tasks`);
        console.log(`   - CRUD /api/finance/*`);
        console.log(`   - GET  /api/analytics/*`);
        console.log(`   - GET  /api/cold-callers`);
        console.log(`   - GET  /api/outreachers`);
        console.log(`   - GET  /api/freelancers`);
        console.log(`   - CRUD /api/staffing/*`);
        console.log(`   - POST /api/ai/match-freelancers`);
    });
}

module.exports = app;
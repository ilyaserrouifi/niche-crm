const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');

router.post('/register', async (req, res) => {
    const pool = req.app.get('db');
    const { full_name, username, email, phone, password, role } = req.body;
    try {
        const exists = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (exists.rows.length > 0) {
            return res.status(400).json({ success: false, message: 'Email already exists' });
        }
        const password_hash = await bcrypt.hash(password, 10);
        const result = await pool.query(
            'INSERT INTO users (full_name, username, email, phone, password_hash, role) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, full_name, email, role',
            [full_name, username, email, phone, password_hash, role || 'client']
        );
        res.json({ success: true, user: result.rows[0] });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
});

router.post('/login', async (req, res) => {
    const pool = req.app.get('db');
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
            res.json({ success: true, token, role: user.role, name: user.full_name, id: user.id, email: user.email });
        } else {
            res.status(401).json({ success: false, message: 'Email ou mot de passe incorrect' });
        }
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

module.exports = router;
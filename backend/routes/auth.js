const express = require('express');
const router = express.Router();

router.post('/login', async (req, res) => {
    const pool = req.app.get('db');
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

module.exports = router;
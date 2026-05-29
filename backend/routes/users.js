const express = require('express');
const router = express.Router();

router.get('/', async (req, res) => {
    const pool = req.app.get('db');
    try {
        const result = await pool.query('SELECT id, email, full_name, username, phone, role, status, salary, rating, created_at FROM users ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.get('/:id', async (req, res) => {
    const pool = req.app.get('db');
    try {
        const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ message: 'User non trouvé' });
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
const express = require('express');
const router = express.Router();

router.get('/invoices', async (req, res) => {
    const pool = req.app.get('db');
    try {
        const result = await pool.query('SELECT * FROM invoices ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.get('/expenses', async (req, res) => {
    const pool = req.app.get('db');
    try {
        const result = await pool.query('SELECT * FROM expenses ORDER BY expense_date DESC');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
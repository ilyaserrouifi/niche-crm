const express = require('express');
const router = express.Router();

router.get('/leaderboard', async (req, res) => {
    const pool = req.app.get('db');
    try {
        const result = await pool.query(`
            SELECT u.full_name, u.role, COUNT(l.id) as meetings 
            FROM users u 
            LEFT JOIN leads l ON u.id = l.assigned_to AND l.stage = 'CLOSED_WON' 
            WHERE u.role IN ('caller', 'outreacher')
            GROUP BY u.id 
            ORDER BY meetings DESC 
            LIMIT 10
        `);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
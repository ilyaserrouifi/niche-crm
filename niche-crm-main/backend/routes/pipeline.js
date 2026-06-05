const express = require('express');
const router = express.Router();

router.get('/leads', async (req, res) => {
    const pool = req.app.get('db');
    try {
        const result = await pool.query('SELECT * FROM leads ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.post('/leads', async (req, res) => {
    const pool = req.app.get('db');
    const { company_name, contact_name, contact_email, contact_phone, source, niche, estimated_value, pain_notes, assigned_to } = req.body;
    try {
        const result = await pool.query(
            `INSERT INTO leads (company_name, contact_name, contact_email, contact_phone, source, niche, estimated_value, pain_notes, assigned_to, stage) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'LEAD') RETURNING *`,
            [company_name, contact_name, contact_email, contact_phone, source, niche, estimated_value, pain_notes, assigned_to]
        );
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.put('/leads/:id/stage', async (req, res) => {
    const pool = req.app.get('db');
    const { stage } = req.body;
    try {
        const result = await pool.query('UPDATE leads SET stage = $1, updated_at = NOW() WHERE id = $2 RETURNING *', [stage, req.params.id]);
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
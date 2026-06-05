const express = require('express');
const router = express.Router();

router.post('/start-call', async (req, res) => {
    const { to, from, callerId, leadId } = req.body;
    try {
        const pool = req.app.get('db');
        const callSid = 'CA' + Date.now();
        const result = await pool.query(
            `INSERT INTO calls (caller_id, lead_id, twilio_call_sid, status, start_time)
             VALUES ($1, $2, $3, 'initiated', NOW())
             RETURNING *`,
            [callerId, leadId, callSid]
        );
        res.json({ success: true, callSid: callSid, callId: result.rows[0].id });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.get('/calls/:callerId', async (req, res) => {
    const { callerId } = req.params;
    try {
        const pool = req.app.get('db');
        const result = await pool.query(
            `SELECT c.*, l.company_name, l.contact_name 
             FROM calls c
             LEFT JOIN leads l ON c.lead_id = l.id
             WHERE c.caller_id = $1
             ORDER BY c.start_time DESC`,
            [callerId]
        );
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.get('/download/:callId', async (req, res) => {
    const { callId } = req.params;
    try {
        const pool = req.app.get('db');
        const result = await pool.query('SELECT recording_url FROM calls WHERE id = $1', [callId]);
        if (result.rows.length === 0 || !result.rows[0].recording_url) {
            return res.status(404).json({ message: 'Recording not found' });
        }
        res.redirect(result.rows[0].recording_url);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.get('/token', async (req, res) => {
    const { identity } = req.query;
    try {
        const token = Buffer.from((identity || 'user') + ':' + Date.now()).toString('base64');
        res.json({ token: token });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;

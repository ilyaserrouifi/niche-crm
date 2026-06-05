const express = require('express');
const router = express.Router();

router.get('/', async (req, res) => {
    const pool = req.app.get('db');
    try {
        const result = await pool.query('SELECT * FROM tasks ORDER BY due_date ASC');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.post('/', async (req, res) => {
    const pool = req.app.get('db');
    const { task_name, project_id, assigned_to, description, priority, status, due_date, visible_to_client } = req.body;
    try {
        const result = await pool.query(
            `INSERT INTO tasks (task_name, project_id, assigned_to, description, priority, status, due_date, visible_to_client) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [task_name, project_id, assigned_to, description, priority, status || 'todo', due_date, visible_to_client || false]
        );
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.put('/:id/status', async (req, res) => {
    const pool = req.app.get('db');
    const { status } = req.body;
    try {
        const result = await pool.query('UPDATE tasks SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *', [status, req.params.id]);
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
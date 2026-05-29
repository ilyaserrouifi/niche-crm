const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'p@ssword123',
    database: process.env.DB_NAME || 'crm_niche',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

pool.connect((err) => {
    if (err) {
        console.error('❌ Erreur connexion PostgreSQL:', err.stack);
    } else {
        console.log('✅ PostgreSQL connecté');
    }
});

async function query(text, params) {
    const start = Date.now();
    try {
        const res = await pool.query(text, params);
        const duration = Date.now() - start;
        console.log('📊 Requête:', { text: text.substring(0, 50), duration, rows: res.rowCount });
        return res;
    } catch (error) {
        console.error('❌ Erreur:', error);
        throw error;
    }
}

module.exports = { query, pool };
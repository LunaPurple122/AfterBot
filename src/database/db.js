const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function testDatabaseConnection() {
    try {
        const result = await pool.query('SELECT NOW()');
        console.log(`🗄️ PostgreSQL connecté : ${result.rows[0].now}`);
    } catch (error) {
        console.error('❌ Erreur PostgreSQL :', error.message);
    }
}

module.exports = {
    pool,
    testDatabaseConnection,
};
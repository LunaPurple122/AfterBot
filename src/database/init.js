const { pool } = require('./db');

async function initDatabase() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS serveurs (
            id SERIAL PRIMARY KEY,

            serveur_id VARCHAR(32) UNIQUE NOT NULL,
            nom VARCHAR(255),

            salon_logs_id VARCHAR(32),
            salon_bienvenue_id VARCHAR(32),
            salon_radio_id VARCHAR(32),

            automod_active BOOLEAN DEFAULT false,
            captcha_actif BOOLEAN DEFAULT false,

            cree_le TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            modifie_le TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `);

    console.log('✅ Table serveurs prête');
}

module.exports = {
    initDatabase,
};
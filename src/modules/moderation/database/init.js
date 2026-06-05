const { pool } =
    require('../../../database/db');

async function initModerationTables() {

    await pool.query(`

        CREATE TABLE IF NOT EXISTS warns (

            id SERIAL PRIMARY KEY,

            serveur_id VARCHAR(32)
                NOT NULL,

            utilisateur_id VARCHAR(32)
                NOT NULL,

            moderateur_id VARCHAR(32)
                NOT NULL,

            raison TEXT,

            cree_le TIMESTAMP
                DEFAULT CURRENT_TIMESTAMP
        );
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_warns_serveur_utilisateur
        ON warns (serveur_id, utilisateur_id);
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_warns_serveur_created
        ON warns (serveur_id, cree_le DESC);
    `);

    console.log(
        '✅ Table warns prête'
    );
}

module.exports = {
    initModerationTables
};

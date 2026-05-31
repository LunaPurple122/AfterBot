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

    console.log(
        '✅ Table warns prête'
    );
}

module.exports = {
    initModerationTables
};
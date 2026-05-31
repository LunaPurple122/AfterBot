const { pool } =
    require('../../../database/db');

async function initAutorolesTables() {

    await pool.query(`

        CREATE TABLE IF NOT EXISTS autoroles (

            id SERIAL PRIMARY KEY,

            serveur_id VARCHAR(32)
                NOT NULL,

            role_id VARCHAR(32)
                NOT NULL
        );
    `);

    console.log(
        '✅ Table autoroles prête'
    );
}

module.exports = {
    initAutorolesTables
};
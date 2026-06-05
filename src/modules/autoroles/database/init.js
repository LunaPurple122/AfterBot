const { pool } =
    require('../../../database/db');

const {
    createUniqueIndexIfNoDuplicates
} = require('../../../database/init');

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

    await createUniqueIndexIfNoDuplicates({
        tableName: 'autoroles',
        indexName: 'idx_autoroles_unique_serveur_role',
        columns: ['serveur_id', 'role_id']
    });

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_autoroles_serveur
        ON autoroles (serveur_id);
    `);

    console.log(
        '✅ Table autoroles prête'
    );
}

module.exports = {
    initAutorolesTables
};

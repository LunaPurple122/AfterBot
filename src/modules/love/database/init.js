const { pool } =
    require('../../../database/db');

async function initLoveTables() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS love_messages (
            id SERIAL PRIMARY KEY,
            auteur_id TEXT NOT NULL,
            titre TEXT NOT NULL,
            contenu TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        );
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_love_messages_auteur_id
        ON love_messages (auteur_id);
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_love_messages_created_at
        ON love_messages (created_at);
    `);

    console.log(
        'Table love_messages prete'
    );
}

module.exports = {
    initLoveTables
};

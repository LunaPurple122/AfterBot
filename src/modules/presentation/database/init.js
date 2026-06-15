const { pool } =
    require('../../../database/db');

async function initPresentationTables() {
    await pool.query(`
        ALTER TABLE IF EXISTS serveurs
        ADD COLUMN IF NOT EXISTS presentation_channel_id VARCHAR(32);
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS presentations (
            guild_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            channel_id TEXT NOT NULL,
            message_id TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (guild_id, user_id)
        );
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_presentations_guild
        ON presentations (guild_id, updated_at DESC);
    `);

    console.log(
        'Table presentations prete'
    );
}

module.exports = {
    initPresentationTables
};

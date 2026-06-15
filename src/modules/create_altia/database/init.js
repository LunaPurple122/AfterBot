const { pool } =
    require('../../../database/db');

async function initCreateAltiaTables() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS create_imports (
            id SERIAL PRIMARY KEY,
            guild_id VARCHAR(32) NOT NULL,
            owner_id VARCHAR(32) NOT NULL,
            imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            mode VARCHAR(16) NOT NULL DEFAULT 'append',
            source_type VARCHAR(16) NOT NULL,
            json_content JSONB NOT NULL,
            applied BOOLEAN DEFAULT false,
            applied_at TIMESTAMP
        );
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_create_imports_guild_latest
        ON create_imports (guild_id, imported_at DESC);
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS create_created_objects (
            id SERIAL PRIMARY KEY,
            import_id INTEGER NOT NULL
                REFERENCES create_imports(id)
                ON DELETE CASCADE,
            guild_id VARCHAR(32) NOT NULL,
            discord_id VARCHAR(32) NOT NULL,
            type VARCHAR(32) NOT NULL,
            name VARCHAR(255) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_create_created_objects_import
        ON create_created_objects (import_id, guild_id);
    `);

    await pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_create_created_objects_unique
        ON create_created_objects (import_id, discord_id, type);
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS create_nuke_history (
            id SERIAL PRIMARY KEY,
            guild_id VARCHAR(32) NOT NULL,
            owner_id VARCHAR(32) NOT NULL,
            executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            deleted_channels INTEGER NOT NULL DEFAULT 0,
            deleted_categories INTEGER NOT NULL DEFAULT 0,
            deleted_roles INTEGER NOT NULL DEFAULT 0
        );
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_create_nuke_history_guild_latest
        ON create_nuke_history (guild_id, executed_at DESC);
    `);

    console.log(
        'Table create_altia prete'
    );
}

module.exports = {
    initCreateAltiaTables
};

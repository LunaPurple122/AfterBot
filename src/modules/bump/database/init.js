const { pool } =
    require('../../../database/db');

async function initBumpTables() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS bump_config (
            guild_id VARCHAR(32) PRIMARY KEY,
            channel_id VARCHAR(32),
            message_2h TEXT,
            message_4h TEXT,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS bump_allowed_roles (
            guild_id VARCHAR(32) NOT NULL,
            role_id VARCHAR(32) NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            PRIMARY KEY (guild_id, role_id)
        );
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS bump_ping_roles (
            guild_id VARCHAR(32) NOT NULL,
            role_id VARCHAR(32) NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            PRIMARY KEY (guild_id, role_id)
        );
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS bump_reminders (
            guild_id VARCHAR(32) NOT NULL,
            reminder_type VARCHAR(8) NOT NULL,
            due_at TIMESTAMPTZ NOT NULL,
            created_by VARCHAR(32),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            PRIMARY KEY (guild_id, reminder_type)
        );
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_bump_reminders_due
        ON bump_reminders (due_at);
    `);

    console.log(
        '✅ Tables bump prêtes'
    );
}

module.exports = {
    initBumpTables
};

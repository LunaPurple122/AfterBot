const { pool } =
    require('../../../database/db');

async function initRodTables() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS rod_config (
            guild_id VARCHAR(32) PRIMARY KEY,
            trigger_role_id VARCHAR(32) NOT NULL,
            category_id VARCHAR(32) NOT NULL,
            alert_channel_id VARCHAR(32) NOT NULL,
            archive_channel_id VARCHAR(32) NOT NULL,
            alert_message TEXT,
            request_message TEXT,
            staff_message TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS rod_ping_roles (
            guild_id VARCHAR(32) NOT NULL,
            role_id VARCHAR(32) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (guild_id, role_id)
        );
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS rod_requests (
            id SERIAL PRIMARY KEY,
            guild_id VARCHAR(32) NOT NULL,
            requester_user_id VARCHAR(32) NOT NULL,
            trigger_role_id VARCHAR(32) NOT NULL,
            request_channel_id VARCHAR(32),
            staff_channel_id VARCHAR(32),
            voice_channel_id VARCHAR(32),
            alert_message_id VARCHAR(32),
            status VARCHAR(16) DEFAULT 'open',
            first_message_received BOOLEAN DEFAULT false,
            close_reason TEXT,
            closed_by VARCHAR(32),
            closed_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `);

    await pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_rod_one_open_request
        ON rod_requests (guild_id, requester_user_id)
        WHERE status = 'open';
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_rod_requests_channel
        ON rod_requests (request_channel_id, status);
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_rod_requests_guild_status
        ON rod_requests (guild_id, status);
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS rod_request_access (
            request_id INTEGER NOT NULL REFERENCES rod_requests(id) ON DELETE CASCADE,
            target_type VARCHAR(16) NOT NULL,
            target_id VARCHAR(32) NOT NULL,
            added_by VARCHAR(32),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (request_id, target_type, target_id)
        );
    `);

    console.log('Tables role_on_demande pretes');
}

module.exports = {
    initRodTables
};

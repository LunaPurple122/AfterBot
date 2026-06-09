const { pool } =
    require('../../../database/db');

async function initStatsTables() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS member_stats (
            guild_id VARCHAR(32) NOT NULL,
            user_id VARCHAR(32) NOT NULL,
            voice_seconds BIGINT NOT NULL DEFAULT 0,
            message_count BIGINT NOT NULL DEFAULT 0,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            PRIMARY KEY (guild_id, user_id)
        );
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_member_stats_voice
        ON member_stats (guild_id, voice_seconds DESC);
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_member_stats_messages
        ON member_stats (guild_id, message_count DESC);
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS voice_sessions (
            guild_id VARCHAR(32) NOT NULL,
            user_id VARCHAR(32) NOT NULL,
            channel_id VARCHAR(32) NOT NULL,
            started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            is_counting BOOLEAN NOT NULL DEFAULT false,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            PRIMARY KEY (guild_id, user_id)
        );
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_voice_sessions_counting
        ON voice_sessions (guild_id, is_counting);
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS stats_admin_roles (
            guild_id VARCHAR(32) NOT NULL,
            role_id VARCHAR(32) NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            PRIMARY KEY (guild_id, role_id)
        );
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS stats_config (
            guild_id BIGINT PRIMARY KEY,
            enabled BOOLEAN NOT NULL DEFAULT TRUE,
            leaderboard_channel_id BIGINT,
            daily_send_time VARCHAR(5) NOT NULL DEFAULT '20:00',
            last_daily_sent_at TIMESTAMP NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
    `);

    await pool.query(`
        ALTER TABLE IF EXISTS stats_config
        ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT TRUE,
        ADD COLUMN IF NOT EXISTS leaderboard_channel_id BIGINT,
        ADD COLUMN IF NOT EXISTS daily_send_time VARCHAR(5) NOT NULL DEFAULT '20:00',
        ADD COLUMN IF NOT EXISTS last_daily_sent_at TIMESTAMP NULL,
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_stats_config_daily_enabled
        ON stats_config (enabled, daily_send_time);
    `);

    console.log(
        '✅ Tables stats prêtes'
    );
}

module.exports = {
    initStatsTables
};

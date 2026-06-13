const { pool } =
    require('../../../database/db');

async function initInviteTrackerTables() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS invite_tracker_config (
            guild_id TEXT PRIMARY KEY,
            enabled BOOLEAN DEFAULT true,
            log_channel_id TEXT,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        );
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS invite_tracker_invites (
            id SERIAL PRIMARY KEY,
            guild_id TEXT NOT NULL,
            invite_code TEXT NOT NULL,
            invite_url TEXT,
            inviter_id TEXT,
            inviter_username TEXT,
            uses INTEGER DEFAULT 0,
            max_uses INTEGER,
            expires_at TIMESTAMP NULL,
            discord_created_at TIMESTAMP NULL,
            deleted_at TIMESTAMP NULL,
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW(),
            UNIQUE(guild_id, invite_code)
        );
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS invite_tracker_joins (
            id SERIAL PRIMARY KEY,
            guild_id TEXT NOT NULL,
            invited_user_id TEXT NOT NULL,
            invited_username TEXT,
            invite_code TEXT,
            inviter_id TEXT,
            joined_at TIMESTAMP DEFAULT NOW(),
            left_at TIMESTAMP NULL,
            is_present BOOLEAN DEFAULT true,
            detection_status TEXT DEFAULT 'detected',
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW(),
            UNIQUE(guild_id, invited_user_id)
        );
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS invite_tracker_rewards (
            id SERIAL PRIMARY KEY,
            guild_id TEXT NOT NULL,
            invite_count INTEGER NOT NULL,
            role_id TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT NOW(),
            UNIQUE(guild_id, invite_count)
        );
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_invite_tracker_invites_guild
        ON invite_tracker_invites (guild_id);
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_invite_tracker_joins_inviter
        ON invite_tracker_joins (guild_id, inviter_id);
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_invite_tracker_joins_code
        ON invite_tracker_joins (guild_id, invite_code);
    `);

    console.log(
        'Tables invit_tracker pretes'
    );
}

module.exports = {
    initInviteTrackerTables
};

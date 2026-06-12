CREATE TABLE IF NOT EXISTS mineur_roles (
    guild_id TEXT NOT NULL,
    role_id TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (guild_id, role_id)
);

CREATE TABLE IF NOT EXISTS mineur_config (
    guild_id TEXT PRIMARY KEY,
    dm_message TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS mineur_bans (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    username TEXT,
    banned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ban_reason TEXT,
    PRIMARY KEY (guild_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_mineur_bans_guild_banned_at
ON mineur_bans (guild_id, banned_at DESC);

CREATE TABLE IF NOT EXISTS create_nuke_history (
    id SERIAL PRIMARY KEY,
    guild_id VARCHAR(32) NOT NULL,
    owner_id VARCHAR(32) NOT NULL,
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_channels INTEGER NOT NULL DEFAULT 0,
    deleted_categories INTEGER NOT NULL DEFAULT 0,
    deleted_roles INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_create_nuke_history_guild_latest
ON create_nuke_history (guild_id, executed_at DESC);

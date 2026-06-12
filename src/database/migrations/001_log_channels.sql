CREATE TABLE IF NOT EXISTS log_channels (
    id SERIAL PRIMARY KEY,
    guild_id VARCHAR(32) NOT NULL,
    log_type VARCHAR(32) NOT NULL,
    channel_id VARCHAR(32) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (guild_id, log_type)
);

CREATE INDEX IF NOT EXISTS idx_log_channels_guild
ON log_channels (guild_id);

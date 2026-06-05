const { pool } =
    require('../../../database/db');

async function initAutomodTables() {

    // CONFIG
    await pool.query(

        `
        CREATE TABLE IF NOT EXISTS automod_config (

            serveur_id TEXT PRIMARY KEY,

            anti_spam_enabled BOOLEAN DEFAULT TRUE,

            spam_message_limit INTEGER DEFAULT 5,

            spam_interval INTEGER DEFAULT 5,

            spam_timeout_minutes INTEGER DEFAULT 5,

            anti_mass_mention_enabled BOOLEAN DEFAULT TRUE,

            mass_mention_limit INTEGER DEFAULT 5,

            mass_mention_timeout_minutes INTEGER DEFAULT 5,

            anti_scam_links_enabled BOOLEAN DEFAULT TRUE,

            anti_raid_join_enabled BOOLEAN DEFAULT TRUE,

            raid_join_limit INTEGER DEFAULT 10,

            raid_join_interval INTEGER DEFAULT 10,

            raid_join_action TEXT DEFAULT 'lockdown',

            raid_lockdown_minutes INTEGER DEFAULT 10,

            logs_channel_id TEXT
        )
        `
    );

    await pool.query(`
        ALTER TABLE IF EXISTS automod_config
        ADD COLUMN IF NOT EXISTS anti_spam_enabled BOOLEAN DEFAULT TRUE,
        ADD COLUMN IF NOT EXISTS spam_message_limit INTEGER DEFAULT 5,
        ADD COLUMN IF NOT EXISTS spam_interval INTEGER DEFAULT 5,
        ADD COLUMN IF NOT EXISTS spam_timeout_minutes INTEGER DEFAULT 5,
        ADD COLUMN IF NOT EXISTS anti_mass_mention_enabled BOOLEAN DEFAULT TRUE,
        ADD COLUMN IF NOT EXISTS mass_mention_limit INTEGER DEFAULT 5,
        ADD COLUMN IF NOT EXISTS mass_mention_timeout_minutes INTEGER DEFAULT 5,
        ADD COLUMN IF NOT EXISTS anti_scam_links_enabled BOOLEAN DEFAULT TRUE,
        ADD COLUMN IF NOT EXISTS anti_raid_join_enabled BOOLEAN DEFAULT TRUE,
        ADD COLUMN IF NOT EXISTS raid_join_limit INTEGER DEFAULT 10,
        ADD COLUMN IF NOT EXISTS raid_join_interval INTEGER DEFAULT 10,
        ADD COLUMN IF NOT EXISTS raid_join_action TEXT DEFAULT 'lockdown',
        ADD COLUMN IF NOT EXISTS raid_lockdown_minutes INTEGER DEFAULT 10,
        ADD COLUMN IF NOT EXISTS logs_channel_id TEXT;
    `);

    console.log(
        '✅ Table automod_config prête'
    );
}

module.exports = {
    initAutomodTables
};

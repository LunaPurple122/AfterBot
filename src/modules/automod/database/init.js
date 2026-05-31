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

            logs_channel_id TEXT
        )
        `
    );

    console.log(
        '✅ Table automod_config prête'
    );
}

module.exports = {
    initAutomodTables
};
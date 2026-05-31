const { pool } =
    require('../../../database/db');

async function initTicketsTables() {

    // CONFIG
    await pool.query(`

        CREATE TABLE IF NOT EXISTS ticket_config (

            serveur_id VARCHAR(32)
                PRIMARY KEY,

            panel_channel_id VARCHAR(32),

            staff_role_id VARCHAR(32),

            category_id VARCHAR(32),

            logs_channel_id VARCHAR(32),

            alert_channel_id VARCHAR(32),

            alert_message TEXT
        );
    `);

    console.log(
        '✅ Table ticket_config prête'
    );

    // TICKETS
    await pool.query(`

        CREATE TABLE IF NOT EXISTS tickets (

            id SERIAL PRIMARY KEY,

            serveur_id VARCHAR(32)
                NOT NULL,

            membre_id VARCHAR(32)
                NOT NULL,

            ticket_channel_id VARCHAR(32)
                NOT NULL,

            staff_channel_id VARCHAR(32),

            vocal_channel_id VARCHAR(32),

            close_reason TEXT,

            ouvert BOOLEAN
                DEFAULT TRUE,

            cree_le TIMESTAMP
                DEFAULT CURRENT_TIMESTAMP
        );
    `);

    console.log(
        '✅ Table tickets prête'
    );
}

module.exports = {
    initTicketsTables
};
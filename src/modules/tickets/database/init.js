const { pool } =
    require('../../../database/db');

const {
    createUniqueIndexIfNoDuplicates
} = require('../../../database/init');

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

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_ticket_config_alert_channel
        ON ticket_config (alert_channel_id);
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

    await createUniqueIndexIfNoDuplicates({
        tableName: 'tickets',
        indexName: 'idx_tickets_one_open_per_member',
        columns: ['serveur_id', 'membre_id'],
        whereClause: 'WHERE ouvert = TRUE'
    });

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_tickets_ticket_channel_open
        ON tickets (ticket_channel_id, ouvert);
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_tickets_staff_channel_open
        ON tickets (staff_channel_id, ouvert);
    `);

    console.log(
        '✅ Table tickets prête'
    );

    // ROLES PING TICKETS
    await pool.query(`

        CREATE TABLE IF NOT EXISTS ticket_ping_roles (

            id SERIAL PRIMARY KEY,

            serveur_id VARCHAR(32)
                NOT NULL,

            role_id VARCHAR(32)
                NOT NULL,

            UNIQUE (serveur_id, role_id)
        );
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_ticket_ping_roles_serveur
        ON ticket_ping_roles (serveur_id);
    `);

    console.log(
        '✅ Table ticket_ping_roles prête'
    );
}

module.exports = {
    initTicketsTables
};

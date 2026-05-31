const {
    Events,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');

const { pool } =
    require('../../../database/db');

module.exports = {

    ticketMessageEvent: {

        name: Events.MessageCreate,

        async execute(message) {

            if (!message.guild) return;

            if (message.author.bot) return;

            // CONFIG
            const configResult =
                await pool.query(

                    `
                    SELECT *
                    FROM ticket_config
                    WHERE serveur_id = $1
                    `,

                    [
                        message.guild.id
                    ]
                );

            const config =
                configResult.rows[0];

            if (!config) return;

            // TICKET
            const ticketResult =
                await pool.query(

                    `
                    SELECT *
                    FROM tickets

                    WHERE ticket_channel_id = $1
                    AND ouvert = TRUE
                    `,

                    [
                        message.channel.id
                    ]
                );

            const ticket =
                ticketResult.rows[0];

            if (!ticket) return;

            // UNIQUEMENT LE MEMBRE
            if (
                message.author.id !==
                ticket.membre_id
            ) return;

            // DÉJÀ TRAITÉ
            if (
                ticket.staff_channel_id
            ) return;

            const alertChannel =
                message.guild.channels.cache.get(
                    config.alert_channel_id
                );

            const staffRole =
                message.guild.roles.cache.get(
                    config.staff_role_id
                );

            if (
                !alertChannel ||
                !staffRole
            ) return;

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

            const pingRolesResult =
                await pool.query(

                    `
                    SELECT role_id
                    FROM ticket_ping_roles
                    WHERE serveur_id = $1
                    ORDER BY id ASC
                    `,

                    [
                        message.guild.id
                    ]
                );

            const staffPings =
                pingRolesResult.rows.length > 0

                    ? pingRolesResult.rows
                        .map(row =>
                            `<@&${row.role_id}>`
                        )
                        .join(' ')

                    : `${staffRole}`;

            // ALERT EMBED
            const embed =
                new EmbedBuilder()

                    .setColor(0xFEE75C)

                    .setTitle(
                        '🚨 Nouveau ticket'
                    )

                    .setDescription(
`${config.alert_message}

👤 Membre :
${message.author}

🎫 Ticket :
${message.channel}

📝 Message :
${message.content}`
                    );

            // BUTTONS
            const row =
                new ActionRowBuilder()

                    .addComponents(

                        new ButtonBuilder()

                            .setCustomId(
`join_ticket_${ticket.id}`
                            )

                            .setLabel(
                                'Rejoindre ticket'
                            )

                            .setStyle(
                                ButtonStyle.Primary
                            ),

                        new ButtonBuilder()

                            .setCustomId(
`join_staff_${ticket.id}`
                            )

                            .setLabel(
                                'Salon staff'
                            )

                            .setStyle(
                                ButtonStyle.Secondary
                            ),

                        new ButtonBuilder()

                            .setCustomId(
`close_ticket_${ticket.id}`
                            )

                            .setLabel(
                                'Clôturer'
                            )

                            .setStyle(
                                ButtonStyle.Danger
                            )
                    );

            await alertChannel.send({

                content:
staffPings,

                embeds: [embed],

                components: [row]
            });
        }
    }
};
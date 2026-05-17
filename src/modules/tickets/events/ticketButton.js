const {
    Events,
    ChannelType,
    PermissionsBitField,
    EmbedBuilder
} = require('discord.js');

const { pool } =
    require('../../../database/db');

module.exports = {

    ticketButtonEvent: {

        name: Events.InteractionCreate,

        async execute(interaction) {

            console.log('ticket button clicked');

            if (!interaction.isButton()) return;

            if (
                interaction.customId !==
                'create_ticket'
            ) return;

            console.log('checking config');

            const result =
                await pool.query(

                    `
                    SELECT *
                    FROM ticket_config
                    WHERE serveur_id = $1
                    `,

                    [
                        interaction.guild.id
                    ]
                );

            console.log('config fetched');

            const config =
                result.rows[0];

            if (!config) {

                return interaction.reply({

                    content:
                        '❌ Le système ticket n’est pas configuré.',

                    ephemeral: true
                });
            }

            console.log('checking existing ticket');

            // TICKET DÉJÀ OUVERT
            const existingTicket =
                await pool.query(

                    `
                    SELECT *
                    FROM tickets

                    WHERE serveur_id = $1
                    AND membre_id = $2
                    AND ouvert = TRUE
                    `,

                    [
                        interaction.guild.id,
                        interaction.user.id
                    ]
                );

            console.log('existing checked');

            if (
                existingTicket.rows.length > 0
            ) {

                const existingChannel =
                    interaction.guild.channels.cache.get(

                        existingTicket.rows[0]
                            .ticket_channel_id
                    );

                return interaction.reply({

                    content:
`❌ Tu possèdes déjà un ticket ouvert :

${existingChannel}`,

                    ephemeral: true
                });
            }

            console.log('fetching category and role');

            const category =
                interaction.guild.channels.cache.get(
                    config.category_id
                );

            const staffRole =
                interaction.guild.roles.cache.get(
                    config.staff_role_id
                );

            console.log('category and role fetched');

            if (
                !category ||
                !staffRole
            ) {

                return interaction.reply({

                    content:
                        '❌ Configuration ticket invalide.',

                    ephemeral: true
                });
            }

            console.log('creating channel');

            // CREATE CHANNEL
            const ticketChannel =
                await interaction.guild.channels.create({

                    name:
`ticket-${interaction.user.username}`,

                    type:
                        ChannelType.GuildText,

                    parent:
                        category.id,

                    permissionOverwrites: [

                        {
                            id:
                                interaction.guild.id,

                            deny: [
                                PermissionsBitField
                                    .Flags
                                    .ViewChannel
                            ]
                        },

                        {
                            id:
                                interaction.user.id,

                            allow: [

                                PermissionsBitField
                                    .Flags
                                    .ViewChannel,

                                PermissionsBitField
                                    .Flags
                                    .SendMessages,

                                PermissionsBitField
                                    .Flags
                                    .ReadMessageHistory
                            ]
                        },

                        {
                            id:
                                staffRole.id,

                            allow: [

                                PermissionsBitField
                                    .Flags
                                    .ViewChannel,

                                PermissionsBitField
                                    .Flags
                                    .SendMessages,

                                PermissionsBitField
                                    .Flags
                                    .ReadMessageHistory
                            ]
                        }
                    ]
                });

            console.log('channel created');

            console.log('saving db');

            // SAVE DB
            await pool.query(

                `
                INSERT INTO tickets (

                    serveur_id,
                    membre_id,
                    ticket_channel_id

                )

                VALUES (
                    $1, $2, $3
                )
                `,

                [
                    interaction.guild.id,
                    interaction.user.id,
                    ticketChannel.id
                ]
            );

            console.log('db saved');

            const embed =
                new EmbedBuilder()

                    .setColor(0x5865F2)

                    .setTitle(
                        '🎫 Ticket ouvert'
                    )

                    .setDescription(
`Bonjour ${interaction.user},

Merci de décrire ton problème en détail.

🛡️ Le staff sera averti dès ton premier message.`
                    );

            console.log('sending message');

            await ticketChannel.send({

                content:
`${interaction.user}`,

                embeds: [embed]
            });

            console.log('message sent');

            await interaction.reply({

                content:
`✅ Ticket créé :
${ticketChannel}`,

                ephemeral: true
            });

            console.log('interaction replied');
        }
    }
};
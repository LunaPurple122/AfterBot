const {
    Events,
    ChannelType,
    PermissionsBitField,
    PermissionFlagsBits,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    EmbedBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');

const { pool } =
    require('../../../database/db');

const {
    requireBotPermission
} = require('../../../core/permissions');

module.exports = {

    ticketActionsEvent: {

        name: Events.InteractionCreate,

        async execute(interaction) {

            if (!interaction.isButton()) return;

            const customId =
                interaction.customId;

            // JOIN TICKET
            if (
                customId.startsWith(
                    'join_ticket_'
                )
            ) {

                const ticketId =
                    customId.replace(
                        'join_ticket_',
                        ''
                    );

                const result =
                    await pool.query(

                        `
                        SELECT *
                        FROM tickets
                        WHERE id = $1
                        AND ouvert = TRUE
                        `,

                        [
                            ticketId
                        ]
                    );

                const ticket =
                    result.rows[0];

                if (!ticket) {

                    return interaction.reply({

                        content:
                            '❌ Ce ticket est fermé ou introuvable.',

                        ephemeral: true
                    });
                }

                const channel =
                    interaction.guild.channels.cache.get(
                        ticket.ticket_channel_id
                    );

                if (!channel) {

                    return interaction.reply({

                        content:
                            '❌ Salon ticket introuvable.',

                        ephemeral: true
                    });
                }

                return interaction.reply({

                    content:
`${channel}`,

                    ephemeral: true
                });
            }

            // JOIN STAFF
            if (
                customId.startsWith(
                    'join_staff_'
                )
            ) {

                const ticketId =
                    customId.replace(
                        'join_staff_',
                        ''
                    );

                const result =
                    await pool.query(

                        `
                        SELECT *
                        FROM tickets
                        WHERE id = $1
                        AND ouvert = TRUE
                        `,

                        [
                            ticketId
                        ]
                    );

                const ticket =
                    result.rows[0];

                if (!ticket) {

                    return interaction.reply({

                        content:
                            '❌ Ce ticket est fermé ou introuvable.',

                        ephemeral: true
                    });
                }

                const configResult =
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

                const config =
                    configResult.rows[0];

                if (!config) {

                    return interaction.reply({

                        content:
                            '❌ Le système ticket n’est pas configuré.',

                        ephemeral: true
                    });
                }

                const staffRole =
                    interaction.guild.roles.cache.get(
                        config.staff_role_id
                    );

                if (!staffRole) {

                    return interaction.reply({

                        content:
                            '❌ Rôle staff introuvable.',

                        ephemeral: true
                    });
                }

                let staffChannel =
                    interaction.guild.channels.cache.get(
                        ticket.staff_channel_id
                    );

                // CREATE STAFF CHANNEL
                if (!staffChannel) {

                    if (!await requireBotPermission(
                        interaction,
                        PermissionFlagsBits.ManageChannels,
                        'ManageChannels'
                    )) return;

                    const member =
                        await interaction.guild.members.fetch(
                            ticket.membre_id
                        );

                    staffChannel =
                        await interaction.guild.channels.create({

                            name:
`staff-${member.user.username}`,

                            type:
                                ChannelType.GuildText,

                            parent:
                                config.category_id,

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

                    // SAVE DB
                    await pool.query(

                        `
                        UPDATE tickets

                        SET staff_channel_id = $1

                        WHERE id = $2
                        `,

                        [
                            staffChannel.id,
                            ticket.id
                        ]
                    );

                    // STAFF MESSAGE
                    const staffEmbed =
                        new EmbedBuilder()

                            .setColor(0x5865F2)

                            .setTitle(
                                '🛡️ Discussion staff'
                            )

                            .setDescription(
`Ticket :
<#${ticket.ticket_channel_id}>

Membre :
<@${ticket.membre_id}>`
                            );

                    const staffRow =
                        new ActionRowBuilder()

                            .addComponents(

                                new ButtonBuilder()

                                    .setCustomId(
`create_voice_${ticket.id}`
                                    )

                                    .setLabel(
                                        'Créer vocal'
                                    )

                                    .setEmoji(
                                        '🎤'
                                    )

                                    .setStyle(
                                        ButtonStyle.Success
                                    )
                            );

                    await staffChannel.send({

                        embeds: [staffEmbed],

                        components: [staffRow]
                    });
                }

                return interaction.reply({

                    content:
`${staffChannel}`,

                    ephemeral: true
                });
            }

            // CREATE VOICE
            if (
                customId.startsWith(
                    'create_voice_'
                )
            ) {

                const ticketId =
                    customId.replace(
                        'create_voice_',
                        ''
                    );

                const result =
                    await pool.query(

                        `
                        SELECT *
                        FROM tickets
                        WHERE id = $1
                        AND ouvert = TRUE
                        `,

                        [
                            ticketId
                        ]
                    );

                const ticket =
                    result.rows[0];

                if (!ticket) {

                    return interaction.reply({

                        content:
                            '❌ Ce ticket est fermé ou introuvable.',

                        ephemeral: true
                    });
                }

                // DÉJÀ EXISTANT
                if (
                    ticket.vocal_channel_id
                ) {

                    const existingVoice =
                        interaction.guild.channels.cache.get(

                            ticket.vocal_channel_id
                        );

                    if (existingVoice) {

                        return interaction.reply({

                            content:
`🎤 Vocal déjà créé :
${existingVoice}`,

                            ephemeral: true
                        });
                    }
                }

                const configResult =
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

                const config =
                    configResult.rows[0];

                if (!config) {

                    return interaction.reply({

                        content:
                            '❌ Le système ticket n’est pas configuré.',

                        ephemeral: true
                    });
                }

                const member =
                    await interaction.guild.members.fetch(
                        ticket.membre_id
                    );

                const staffRole =
                    interaction.guild.roles.cache.get(
                        config.staff_role_id
                    );

                if (!staffRole) {

                    return interaction.reply({

                        content:
                            '❌ Rôle staff introuvable.',

                        ephemeral: true
                    });
                }

                if (!await requireBotPermission(
                    interaction,
                    PermissionFlagsBits.ManageChannels,
                    'ManageChannels'
                )) return;

                const voice =
                    await interaction.guild.channels.create({

                        name:
`vocal-${member.user.username}`,

                        type:
                            ChannelType.GuildVoice,

                        parent:
                            config.category_id,

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
                                    member.id,

                                allow: [

                                    PermissionsBitField
                                        .Flags
                                        .ViewChannel,

                                    PermissionsBitField
                                        .Flags
                                        .Connect,

                                    PermissionsBitField
                                        .Flags
                                        .Speak
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
                                        .Connect,

                                    PermissionsBitField
                                        .Flags
                                        .Speak
                                ]
                            }
                        ]
                    });

                // SAVE DB
                await pool.query(

                    `
                    UPDATE tickets

                    SET vocal_channel_id = $1

                    WHERE id = $2
                    `,

                    [
                        voice.id,
                        ticket.id
                    ]
                );

                return interaction.reply({

                    content:
`✅ Vocal créé :
${voice}`,

                    ephemeral: true
                });
            }

            // CLOSE
            if (
                customId.startsWith(
                    'close_ticket_'
                )
            ) {

                const ticketId =
                    customId.replace(
                        'close_ticket_',
                        ''
                    );

                const result =
                    await pool.query(

                        `
                        SELECT *
                        FROM tickets
                        WHERE id = $1
                        AND ouvert = TRUE
                        `,

                        [
                            ticketId
                        ]
                    );

                const ticket =
                    result.rows[0];

                if (!ticket) {

                    return interaction.reply({

                        content:
                            '❌ Ce ticket est fermé ou introuvable.',

                        ephemeral: true
                    });
                }

                const modal =
                    new ModalBuilder()

                        .setCustomId(
`close_modal_${ticketId}`
                        )

                        .setTitle(
                            'Fermeture ticket'
                        );

                const reasonInput =
                    new TextInputBuilder()

                        .setCustomId(
                            'close_reason'
                        )

                        .setLabel(
                            'Raison de fermeture'
                        )

                        .setStyle(
                            TextInputStyle.Paragraph
                        )

                        .setRequired(true)

                        .setMaxLength(1000);

                const row =
                    new ActionRowBuilder()

                        .addComponents(
                            reasonInput
                        );

                modal.addComponents(row);

                return interaction.showModal(
                    modal
                );
            }
        }
    }
};

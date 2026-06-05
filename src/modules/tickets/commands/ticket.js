const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    PermissionsBitField
} = require('discord.js');

const { pool } =
    require('../../../database/db');

const {
    requireBotPermission
} = require('../../../core/permissions');

module.exports = {

    data: new SlashCommandBuilder()

        .setName('ticket')

        .setDescription(
            'Gestion des tickets.'
        )

        // CLOSE
        .addSubcommand(subcommand =>
            subcommand

                .setName('close')

                .setDescription(
                    'Fermer un ticket.'
                )
        )

        // ADD
        .addSubcommand(subcommand =>
            subcommand

                .setName('add')

                .setDescription(
                    'Ajouter un membre.'
                )

                .addUserOption(option =>
                    option

                        .setName('membre')

                        .setDescription(
                            'Membre à ajouter'
                        )

                        .setRequired(true)
                )
        )

        // REMOVE
        .addSubcommand(subcommand =>
            subcommand

                .setName('remove')

                .setDescription(
                    'Retirer un membre.'
                )

                .addUserOption(option =>
                    option

                        .setName('membre')

                        .setDescription(
                            'Membre à retirer'
                        )

                        .setRequired(true)
                )
        )

        .setDefaultMemberPermissions(
            PermissionFlagsBits.ManageChannels
        ),

    async execute(interaction) {

        const subcommand =
            interaction.options.getSubcommand();

        // TICKET
        const result =
            await pool.query(

                `
                SELECT *
                FROM tickets

                WHERE (
                    ticket_channel_id = $1
                    OR staff_channel_id = $1
                )

                AND ouvert = TRUE
                `,

                [
                    interaction.channel.id
                ]
            );

        const ticket =
            result.rows[0];

        if (!ticket) {

            return interaction.reply({

                content:
                    '❌ Cette commande doit être utilisée dans un ticket.',

                ephemeral: true
            });
        }

        // CLOSE
        if (subcommand === 'close') {

            if (!await requireBotPermission(
                interaction,
                PermissionFlagsBits.ManageChannels,
                'ManageChannels'
            )) return;

            await pool.query(

                `
                UPDATE tickets

                SET ouvert = FALSE

                WHERE id = $1
                `,

                [
                    ticket.id
                ]
            );

            const ticketChannel =
                interaction.guild.channels.cache.get(
                    ticket.ticket_channel_id
                );

            const staffChannel =
                interaction.guild.channels.cache.get(
                    ticket.staff_channel_id
                );

            const voiceChannel =
                interaction.guild.channels.cache.get(
                    ticket.vocal_channel_id
                );

            await interaction.reply({

                content:
                    '🗑️ Fermeture du ticket...'
            });

            // DELETE
            if (ticketChannel) {

                await ticketChannel.delete()
                    .catch(error => {
                        console.error(`Impossible de supprimer le salon ticket ${ticketChannel.id} :`, error);
                    });
            }

            if (staffChannel) {

                await staffChannel.delete()
                    .catch(error => {
                        console.error(`Impossible de supprimer le salon staff ${staffChannel.id} :`, error);
                    });
            }

            if (voiceChannel) {

                await voiceChannel.delete()
                    .catch(error => {
                        console.error(`Impossible de supprimer le salon vocal ${voiceChannel.id} :`, error);
                    });
            }

            return;
        }

        const membre =
            interaction.options.getMember(
                'membre'
            );

        if (!membre) {

            return interaction.reply({

                content:
                    '❌ Membre introuvable.',

                ephemeral: true
            });
        }

        const ticketChannel =
            interaction.guild.channels.cache.get(
                ticket.ticket_channel_id
            );

        if (!ticketChannel) {

            return interaction.reply({

                content:
                    '❌ Salon ticket introuvable.',

                ephemeral: true
            });
        }

        // ADD
        if (subcommand === 'add') {

            if (!await requireBotPermission(
                interaction,
                PermissionFlagsBits.ManageChannels,
                'ManageChannels'
            )) return;

            await ticketChannel.permissionOverwrites.edit(

                membre.id,

                {

                    ViewChannel: true,
                    SendMessages: true,
                    ReadMessageHistory: true
                }
            );

            return interaction.reply({

                content:
`✅ ${membre} a été ajouté au ticket.`
            });
        }

        // REMOVE
        if (subcommand === 'remove') {

            if (!await requireBotPermission(
                interaction,
                PermissionFlagsBits.ManageChannels,
                'ManageChannels'
            )) return;

            await ticketChannel.permissionOverwrites.edit(

                membre.id,

                {

                    ViewChannel: false
                }
            );

            return interaction.reply({

                content:
`✅ ${membre} a été retiré du ticket.`
            });
        }
    }
};

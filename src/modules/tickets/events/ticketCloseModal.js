const {
    Events,
    PermissionFlagsBits,
    AttachmentBuilder
} = require('discord.js');

const { pool } =
    require('../../../database/db');

const {
    genererTranscript
} = require(
    '../helpers/transcript'
);

const {
    requireBotPermission
} = require('../../../core/permissions');

const {
    safeDeferReply,
    safeReply
} = require('../../../core/interactions');

module.exports = {

    ticketCloseModalEvent: {

        name: Events.InteractionCreate,

        async execute(interaction) {

            if (!interaction.isModalSubmit()) return;

            if (
                !interaction.customId.startsWith(
                    'close_modal_'
                )
            ) return;

            const ticketId =
                interaction.customId.replace(
                    'close_modal_',
                    ''
                );

            const reason =
                interaction.fields.getTextInputValue(
                    'close_reason'
                );

            const deferred =
                await safeDeferReply(interaction, {
                    ephemeral: true
                });

            if (!deferred) return;

            const result =
                await pool.query(

                    `
                    SELECT *
                    FROM tickets
                    WHERE id = $1
                    `,

                    [
                        ticketId
                    ]
                );

            const ticket =
                result.rows[0];

            if (!ticket) {

                return safeReply(interaction, {

                    content:
                        '❌ Ticket introuvable.',

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

            const logsChannel =
                config?.logs_channel_id
                    ? interaction.guild.channels.cache.get(
                        config.logs_channel_id
                    )
                    : null;

            if (!await requireBotPermission(
                interaction,
                PermissionFlagsBits.ManageChannels,
                'ManageChannels'
            )) return;

            // SAVE CLOSE
            await pool.query(

                `
                UPDATE tickets

                SET
                    ouvert = FALSE,
                    close_reason = $1

                WHERE id = $2
                `,

                [
                    reason,
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

            // TRANSCRIPTS
            if (logsChannel) {

                // MEMBER TRANSCRIPT
                if (ticketChannel) {

                    const transcript =
                        await genererTranscript(
                            ticketChannel
                        );

                    const file =
                        new AttachmentBuilder(

                            Buffer.from(
                                transcript,
                                'utf-8'
                            ),

                            {
                                name:
`ticket-${ticket.id}.txt`
                            }
                        );

                    await logsChannel.send({

                        content:
`🎫 Transcript ticket
ID : ${ticket.id}

📝 Raison :
${reason}

🛡️ Fermé par :
${interaction.user}`,

                        files: [file]
                    });
                }

                // STAFF TRANSCRIPT
                if (staffChannel) {

                    const transcript =
                        await genererTranscript(
                            staffChannel
                        );

                    const file =
                        new AttachmentBuilder(

                            Buffer.from(
                                transcript,
                                'utf-8'
                            ),

                            {
                                name:
`staff-${ticket.id}.txt`
                            }
                        );

                    await logsChannel.send({

                        content:
`🛡️ Transcript staff
ID : ${ticket.id}

📝 Raison :
${reason}

🛡️ Fermé par :
${interaction.user}`,

                        files: [file]
                    });
                }
            }

            await safeReply(interaction, {

                content:
`🗑️ Ticket fermé.

📝 Raison :
${reason}`,

                ephemeral: true
            });

            // DELETE CHANNELS
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
        }
    }
};

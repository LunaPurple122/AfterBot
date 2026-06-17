const {
    ActionRowBuilder,
    Events,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} = require('discord.js');

const {
    canManageRod,
    closeRequest,
    createStaffChannel,
    createVoiceChannel,
    getRequestById
} = require('../services/rodService');

const {
    safeDeferReply,
    safeReply
} = require('../../../core/interactions');

function buildCloseModal(requestId) {
    return new ModalBuilder()
        .setCustomId(`rod_close_modal:${requestId}`)
        .setTitle('Cloturer la demande')
        .addComponents(
            new ActionRowBuilder()
                .addComponents(
                    new TextInputBuilder()
                        .setCustomId('reason')
                        .setLabel('Raison de cloture')
                        .setStyle(TextInputStyle.Paragraph)
                        .setRequired(true)
                        .setMaxLength(1000)
                )
        );
}

module.exports = {
    name: Events.InteractionCreate,

    async execute(interaction) {
        try {
            if (
                interaction.isButton() &&
                interaction.customId.startsWith('rod_staff:')
            ) {
                const requestId =
                    interaction.customId.split(':')[1];

                const request =
                    await getRequestById(
                        interaction.guild.id,
                        requestId
                    );

                if (!request || request.status !== 'open') {
                    return safeReply(interaction, {
                        content: 'Demande introuvable ou deja fermee.',
                        ephemeral: true
                    });
                }

                if (!await canManageRod(interaction.member, request)) {
                    return safeReply(interaction, {
                        content: 'Tu n as pas l autorisation de gerer cette demande.',
                        ephemeral: true
                    });
                }

                const deferred =
                    await safeDeferReply(interaction, {
                        ephemeral: true
                    });

                if (!deferred) return;

                const channel =
                    await createStaffChannel(
                        interaction.guild,
                        request
                    );

                return safeReply(interaction, {
                    content: channel
                        ? `Salon staff pret : ${channel}`
                        : 'Impossible de creer le salon staff.'
                });
            }

            if (
                interaction.isButton() &&
                interaction.customId.startsWith('rod_voice:')
            ) {
                const requestId =
                    interaction.customId.split(':')[1];

                const request =
                    await getRequestById(
                        interaction.guild.id,
                        requestId
                    );

                if (!request || request.status !== 'open') {
                    return safeReply(interaction, {
                        content: 'Demande introuvable ou deja fermee.',
                        ephemeral: true
                    });
                }

                if (!await canManageRod(interaction.member, request)) {
                    return safeReply(interaction, {
                        content: 'Tu n as pas l autorisation de gerer cette demande.',
                        ephemeral: true
                    });
                }

                const deferred =
                    await safeDeferReply(interaction, {
                        ephemeral: true
                    });

                if (!deferred) return;

                const channel =
                    await createVoiceChannel(
                        interaction.guild,
                        request
                    );

                return safeReply(interaction, {
                    content: channel
                        ? `Vocal pret : ${channel}`
                        : 'Impossible de creer le vocal.'
                });
            }

            if (
                interaction.isButton() &&
                interaction.customId.startsWith('rod_close:')
            ) {
                const requestId =
                    interaction.customId.split(':')[1];

                const request =
                    await getRequestById(
                        interaction.guild.id,
                        requestId
                    );

                if (!request || request.status !== 'open') {
                    return safeReply(interaction, {
                        content: 'Demande introuvable ou deja fermee.',
                        ephemeral: true
                    });
                }

                if (!await canManageRod(interaction.member, request)) {
                    return safeReply(interaction, {
                        content: 'Tu n as pas l autorisation de gerer cette demande.',
                        ephemeral: true
                    });
                }

                return interaction.showModal(
                    buildCloseModal(request.id)
                );
            }

            if (
                interaction.isModalSubmit() &&
                interaction.customId.startsWith('rod_close_modal:')
            ) {
                const requestId =
                    interaction.customId.split(':')[1];

                const request =
                    await getRequestById(
                        interaction.guild.id,
                        requestId
                    );

                if (!request || request.status !== 'open') {
                    return safeReply(interaction, {
                        content: 'Demande introuvable ou deja fermee.',
                        ephemeral: true
                    });
                }

                if (!await canManageRod(interaction.member, request)) {
                    return safeReply(interaction, {
                        content: 'Tu n as pas l autorisation de gerer cette demande.',
                        ephemeral: true
                    });
                }

                const deferred =
                    await safeDeferReply(interaction, {
                        ephemeral: true
                    });

                if (!deferred) return;

                const reason =
                    interaction.fields.getTextInputValue('reason');

                await closeRequest({
                    guild: interaction.guild,
                    request,
                    reason,
                    closedBy: interaction.user,
                    status: 'closed'
                });

                return safeReply(interaction, {
                    content: 'Demande cloturee et archivee.'
                });
            }

        } catch (error) {
            console.error(
                'Erreur interaction ROD :',
                error
            );

            return safeReply(interaction, {
                content: 'Impossible de traiter cette interaction ROD.',
                ephemeral: true
            });
        }
    }
};

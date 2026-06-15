const {
    Events,
    MessageFlags
} = require('discord.js');

const {
    safeDeferReply,
    safeReply
} = require('../../../core/interactions');

const {
    PRESENTATION_CREATE_MODAL_PREFIX,
    PRESENTATION_EDIT_MODAL_PREFIX
} = require('../commands/presentation');

const {
    MAX_PRESENTATION_LENGTH,
    MEMBER_REQUIRED_MESSAGE,
    buildPresentationEmbed,
    createPresentation,
    deletePresentation,
    getPresentation,
    getPresentationSettings,
    memberHasRequiredRole,
    updatePresentation
} = require('../services/presentationService');

function isPresentationModal(interaction) {
    return (
        interaction.isModalSubmit() &&
        (
            interaction.customId.startsWith(PRESENTATION_CREATE_MODAL_PREFIX) ||
            interaction.customId.startsWith(PRESENTATION_EDIT_MODAL_PREFIX)
        )
    );
}

function isEditModal(interaction) {
    return interaction.customId.startsWith(
        PRESENTATION_EDIT_MODAL_PREFIX
    );
}

async function getConfiguredChannel(interaction) {
    const settings =
        await getPresentationSettings(interaction.guild.id);

    if (!settings?.presentation_channel_id) {
        return null;
    }

    return interaction.guild.channels.cache.get(
        settings.presentation_channel_id
    ) || null;
}

async function fetchPresentationMessage(interaction, presentation) {
    const channel =
        interaction.guild.channels.cache.get(
            presentation.channel_id
        );

    if (!channel?.isTextBased?.()) {
        return {
            missing: true
        };
    }

    try {
        const message =
            await channel.messages.fetch(
                presentation.message_id
            );

        return {
            channel,
            message
        };
    } catch (error) {
        console.error(
            `Presentation introuvable ${presentation.message_id}:`,
            error.message || error
        );

        return {
            missing: true
        };
    }
}

module.exports = {
    name: Events.InteractionCreate,

    async execute(interaction) {
        if (!isPresentationModal(interaction)) {
            return;
        }

        if (!interaction.inGuild() || !interaction.guild) {
            return safeReply(interaction, {
                content:
                    'Cette action doit être faite dans un serveur.',
                flags:
                    MessageFlags.Ephemeral
            });
        }

        const [, expectedUserId] =
            interaction.customId.split(':');

        if (expectedUserId !== interaction.user.id) {
            return safeReply(interaction, {
                content:
                    'Ce modal ne correspond pas à votre session.',
                flags:
                    MessageFlags.Ephemeral
            });
        }

        const content =
            interaction.fields
                .getTextInputValue('content')
                .trim();

        if (!content) {
            return safeReply(interaction, {
                content:
                    'Le contenu de la présentation ne peut pas être vide.',
                flags:
                    MessageFlags.Ephemeral
            });
        }

        if (content.length > MAX_PRESENTATION_LENGTH) {
            return safeReply(interaction, {
                content:
                    'La présentation ne peut pas dépasser 4096 caractères.',
                flags:
                    MessageFlags.Ephemeral
            });
        }

        const deferred =
            await safeDeferReply(interaction, {
                flags:
                    MessageFlags.Ephemeral
            });

        if (!deferred) return;

        if (!await memberHasRequiredRole(interaction.member)) {
            return safeReply(interaction, {
                content:
                    MEMBER_REQUIRED_MESSAGE,
                flags:
                    MessageFlags.Ephemeral
            });
        }

        const edit =
            isEditModal(interaction);

        if (edit) {
            const presentation =
                await getPresentation(
                    interaction.guild.id,
                    interaction.user.id
                );

            if (!presentation) {
                return safeReply(interaction, {
                    content:
                        "Vous n'avez pas encore créé de présentation.",
                    flags:
                        MessageFlags.Ephemeral
                });
            }

            const fetched =
                await fetchPresentationMessage(
                    interaction,
                    presentation
                );

            if (fetched.missing) {
                await deletePresentation(
                    interaction.guild.id,
                    interaction.user.id
                );

                return safeReply(interaction, {
                    content:
                        'Votre ancienne présentation est introuvable. Veuillez refaire une présentation avec /presentation.',
                    flags:
                        MessageFlags.Ephemeral
                });
            }

            try {
                await fetched.message.edit({
                    content:
                        `${interaction.user}`,
                    embeds:
                        [
                            buildPresentationEmbed({
                                member:
                                    interaction.member,
                                content,
                                updated:
                                    true
                            })
                        ]
                });
            } catch (error) {
                console.error(
                    `Impossible de modifier la presentation ${presentation.message_id}:`,
                    error
                );

                return safeReply(interaction, {
                    content:
                        'Impossible de modifier le message de présentation.',
                    flags:
                        MessageFlags.Ephemeral
                });
            }

            await updatePresentation({
                guildId:
                    interaction.guild.id,
                userId:
                    interaction.user.id,
                content
            });

            return safeReply(interaction, {
                content:
                    'Votre présentation a été mise à jour avec succès.',
                flags:
                    MessageFlags.Ephemeral
            });
        }

        const existing =
            await getPresentation(
                interaction.guild.id,
                interaction.user.id
            );

        if (existing) {
            return safeReply(interaction, {
                content:
                    'Vous avez déjà une présentation. Utilisez /presentation modif pour la modifier.',
                flags:
                    MessageFlags.Ephemeral
            });
        }

        const channel =
            await getConfiguredChannel(interaction);

        if (!channel?.isTextBased?.()) {
            return safeReply(interaction, {
                content:
                    'Aucun salon de présentation configuré.',
                flags:
                    MessageFlags.Ephemeral
            });
        }

        let message;

        try {
            message =
                await channel.send({
                    content:
                        `${interaction.user}`,
                    embeds:
                        [
                            buildPresentationEmbed({
                                member:
                                    interaction.member,
                                content,
                                updated:
                                    false
                            })
                        ]
                });
        } catch (error) {
            console.error(
                `Impossible de publier une presentation dans ${channel.id}:`,
                error
            );

            return safeReply(interaction, {
                content:
                    'Impossible de publier la présentation dans le salon configuré.',
                flags:
                    MessageFlags.Ephemeral
            });
        }

        await createPresentation({
            guildId:
                interaction.guild.id,
            userId:
                interaction.user.id,
            channelId:
                channel.id,
            messageId:
                message.id,
            content
        });

        return safeReply(interaction, {
            content:
                'Votre présentation a été publiée avec succès.',
            flags:
                MessageFlags.Ephemeral
        });
    }
};

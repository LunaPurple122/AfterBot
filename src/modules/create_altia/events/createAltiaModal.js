const {
    ActionRowBuilder,
    Events,
    MessageFlags,
    ModalBuilder,
    PermissionFlagsBits,
    TextInputBuilder,
    TextInputStyle
} = require('discord.js');

const {
    safeDeferReply,
    safeReply
} = require('../../../core/interactions');

const {
    CUSTOM_ID_PREFIX,
    NUKE_BUTTON_PREFIX,
    NUKE_CONFIRM_TEXT,
    NUKE_MODAL_PREFIX,
    importProject
} = require('../commands/create');

const {
    ensureGuildOwner
} = require('../services/createAltiaService');

const {
    runCreateAltiaNuke
} = require('../services/createAltiaNukeService');

function botCanNuke(interaction) {
    const botMember =
        interaction.guild?.members?.me;

    if (!botMember) {
        return 'Membre bot introuvable dans ce serveur.';
    }

    const missing = [];

    if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
        missing.push('ManageRoles');
    }

    if (!botMember.permissions.has(PermissionFlagsBits.ManageChannels)) {
        missing.push('ManageChannels');
    }

    if (missing.length > 0) {
        return `Permissions bot manquantes : ${missing.join(', ')}.`;
    }

    return null;
}

function buildNukeModal(userId) {
    return new ModalBuilder()
        .setCustomId(`${NUKE_MODAL_PREFIX}${userId}:${Date.now()}`)
        .setTitle('Confirmation finale')
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('confirmation')
                    .setLabel(`Tapez exactement : ${NUKE_CONFIRM_TEXT}`)
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
                    .setMaxLength(64)
            )
        );
}

function isNukeReplyError(error) {
    const code =
        error?.code || error?.rawError?.code;

    const message =
        String(error?.message || error?.rawError?.message || '');

    return (
        code === 10003 ||
        code === 10062 ||
        message.includes('Unknown Channel') ||
        message.includes('Unknown interaction')
    );
}

async function safeNukeEditReply(interaction, content) {
    try {
        const editReply =
            interaction.__safeOriginalResponses?.editReply ||
            interaction.editReply?.bind(interaction);

        if (typeof editReply !== 'function') {
            return false;
        }

        await editReply({
            content
        });

        return true;
    } catch (error) {
        if (isNukeReplyError(error)) {
            console.warn(
                `Progression nuke impossible a mettre a jour : ${error.message}`
            );
            return false;
        }

        console.error(
            'Progression nuke ignoree:',
            error
        );

        return false;
    }
}

module.exports = {
    name: Events.InteractionCreate,

    async execute(interaction) {
        if (
            interaction.isButton() &&
            interaction.customId.startsWith(NUKE_BUTTON_PREFIX)
        ) {
            const ownerCheck =
                ensureGuildOwner(interaction);

            if (!ownerCheck.ok) {
                return safeReply(interaction, {
                    content:
                        ownerCheck.message,
                    flags:
                        MessageFlags.Ephemeral
                });
            }

            const [, expectedUserId] =
                interaction.customId.split(':');

            if (expectedUserId !== interaction.user.id) {
                return safeReply(interaction, {
                    content:
                        'Ce bouton ne correspond pas a votre session.',
                    flags:
                        MessageFlags.Ephemeral
                });
            }

            return interaction.showModal(
                buildNukeModal(interaction.user.id)
            );
        }

        if (!interaction.isModalSubmit()) {
            return;
        }

        if (interaction.customId.startsWith(NUKE_MODAL_PREFIX)) {
            const ownerCheck =
                ensureGuildOwner(interaction);

            if (!ownerCheck.ok) {
                return safeReply(interaction, {
                    content:
                        ownerCheck.message,
                    flags:
                        MessageFlags.Ephemeral
                });
            }

            const [, expectedUserId] =
                interaction.customId.split(':');

            if (expectedUserId !== interaction.user.id) {
                return safeReply(interaction, {
                    content:
                        'Ce modal ne correspond pas a votre session.',
                    flags:
                        MessageFlags.Ephemeral
                });
            }

            const confirmation =
                interaction.fields
                    .getTextInputValue('confirmation')
                    .trim();

            if (confirmation !== NUKE_CONFIRM_TEXT) {
                return safeReply(interaction, {
                    content:
                        'Confirmation incorrecte. Reset annule.',
                    flags:
                        MessageFlags.Ephemeral
                });
            }

            const permissionError =
                botCanNuke(interaction);

            if (permissionError) {
                return safeReply(interaction, {
                    content:
                        permissionError,
                    flags:
                        MessageFlags.Ephemeral
                });
            }

            await safeDeferReply(interaction, {
                flags:
                    MessageFlags.Ephemeral
            });

            await safeNukeEditReply(
                interaction,
                'Nuke Create Altia en cours...'
            );

            try {
                const result =
                    await runCreateAltiaNuke({
                        guild:
                            interaction.guild,
                        ownerId:
                            interaction.user.id,
                        protectedChannelIds:
                            [
                                interaction.channelId,
                                interaction.channel?.id
                            ],
                        onProgress:
                            content =>
                                safeNukeEditReply(
                                    interaction,
                                    content
                                )
                    });

                const replied =
                    await safeNukeEditReply(
                        interaction,
                        result.message
                    );

                if (!replied) {
                    console.log(
                        `Create Altia nuke termine guild=${interaction.guild.id} roles=${result.deletedRoles} salons=${result.deletedChannels} categories=${result.deletedCategories} ignores=${result.ignoredChannels.length} erreurs=${result.errors.length}`
                    );
                }

                return;
            } catch (error) {
                console.error(
                    'Erreur fatale Create Altia nuke:',
                    error
                );

                const replied =
                    await safeNukeEditReply(
                        interaction,
                        `Reset interrompu : ${error.message || error}`
                    );

                if (!replied) {
                    console.log(
                        `Create Altia nuke interrompu guild=${interaction.guild.id}: ${error.message || error}`
                    );
                }

                return;
            }
        }

        if (!interaction.customId.startsWith(CUSTOM_ID_PREFIX)) {
            return;
        }

        const ownerCheck =
            ensureGuildOwner(interaction);

        if (!ownerCheck.ok) {
            return safeReply(interaction, {
                content:
                    ownerCheck.message,
                flags:
                    MessageFlags.Ephemeral
            });
        }

        const [, expectedUserId] =
            interaction.customId.split(':');

        if (expectedUserId !== interaction.user.id) {
            return safeReply(interaction, {
                content:
                    'Ce modal ne correspond pas a votre session.',
                flags:
                    MessageFlags.Ephemeral
            });
        }

        const rawContent =
            interaction.fields
                .getTextInputValue('json_content')
                .trim();

        await safeDeferReply(interaction, {
            flags:
                MessageFlags.Ephemeral
        });

        return importProject({
            interaction,
            sourceType:
                'modal',
            rawContent
        });
    }
};

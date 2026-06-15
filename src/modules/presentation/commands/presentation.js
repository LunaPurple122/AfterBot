const {
    ActionRowBuilder,
    ChannelType,
    MessageFlags,
    ModalBuilder,
    PermissionFlagsBits,
    SlashCommandBuilder,
    TextInputBuilder,
    TextInputStyle
} = require('discord.js');

const {
    safeReply
} = require('../../../core/interactions');

const {
    MAX_PRESENTATION_LENGTH,
    MEMBER_REQUIRED_MESSAGE,
    getPresentation,
    getPresentationTemplate,
    memberHasRequiredRole,
    presentationExists,
    setPresentationChannel
} = require('../services/presentationService');

const PRESENTATION_CREATE_MODAL_PREFIX =
    'presentation_create:';

const PRESENTATION_EDIT_MODAL_PREFIX =
    'presentation_edit:';

function buildPresentationModal({
    customId,
    title,
    value
}) {
    return new ModalBuilder()
        .setCustomId(customId)
        .setTitle(title)
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('content')
                    .setLabel('Présentation')
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(true)
                    .setMaxLength(4000)
                    .setValue(value.slice(0, 4000))
            )
        );
}

async function requireMemberRole(interaction) {
    const hasRole =
        await memberHasRequiredRole(interaction.member);

    if (hasRole) return true;

    await safeReply(interaction, {
        content:
            MEMBER_REQUIRED_MESSAGE,
        flags:
            MessageFlags.Ephemeral
    });

    return false;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('presentation')
        .setDescription('Créer ou modifier votre présentation.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('create')
                .setDescription('Créer ma présentation.')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('modif')
                .setDescription('Modifier ma présentation.')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('channel')
                .setDescription('Configurer le salon des présentations.')
                .addChannelOption(option =>
                    option
                        .setName('salon')
                        .setDescription('Salon des présentations')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true)
                )
        ),

    async execute(interaction) {
        if (!interaction.inGuild() || !interaction.guild) {
            return safeReply(interaction, {
                content:
                    'Cette commande doit être utilisée dans un serveur.',
                flags:
                    MessageFlags.Ephemeral
            });
        }

        const subcommand =
            interaction.options.getSubcommand();

        if (subcommand === 'channel') {
            if (
                !interaction.memberPermissions?.has(
                    PermissionFlagsBits.Administrator
                )
            ) {
                return safeReply(interaction, {
                    content:
                        'Permission requise : Administrateur.',
                    flags:
                        MessageFlags.Ephemeral
                });
            }

            const channel =
                interaction.options.getChannel('salon');

            await setPresentationChannel(
                interaction.guild,
                channel.id
            );

            return safeReply(interaction, {
                content:
                    'Le salon des présentations a été configuré avec succès.',
                flags:
                    MessageFlags.Ephemeral
            });
        }

        if (!await requireMemberRole(interaction)) {
            return;
        }

        if (subcommand === 'create') {
            const exists =
                await presentationExists(
                    interaction.guild.id,
                    interaction.user.id
                );

            if (exists) {
                return safeReply(interaction, {
                    content:
                        'Vous avez déjà une présentation. Utilisez /presentation modif pour la modifier.',
                    flags:
                        MessageFlags.Ephemeral
                });
            }

            return interaction.showModal(
                buildPresentationModal({
                    customId:
                        `${PRESENTATION_CREATE_MODAL_PREFIX}${interaction.user.id}:${Date.now()}`,
                    title:
                        'Créer ma présentation',
                    value:
                        getPresentationTemplate(interaction.guild.name)
                })
            );
        }

        if (subcommand === 'modif') {
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

            return interaction.showModal(
                buildPresentationModal({
                    customId:
                        `${PRESENTATION_EDIT_MODAL_PREFIX}${interaction.user.id}:${Date.now()}`,
                    title:
                        'Créer ma présentation',
                    value:
                        presentation.content.slice(
                            0,
                            MAX_PRESENTATION_LENGTH
                        )
                })
            );
        }

        return safeReply(interaction, {
            content:
                'Sous-commande inconnue.',
            flags:
                MessageFlags.Ephemeral
        });
    },

    PRESENTATION_CREATE_MODAL_PREFIX,
    PRESENTATION_EDIT_MODAL_PREFIX
};

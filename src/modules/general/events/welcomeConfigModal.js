const {
    Events,
    MessageFlags,
    PermissionFlagsBits
} = require('discord.js');

const {
    safeReply
} = require('../../../core/interactions');

const {
    LEAVE_MODAL_PREFIX,
    WELCOME_MODAL_PREFIX
} = require('../commands/config');

const {
    normalizeLeaveEmbed,
    normalizeWelcomeEmbed,
    saveLeaveConfig,
    saveWelcomeConfig
} = require('../services/welcomeService');

module.exports = {
    name: Events.InteractionCreate,

    async execute(interaction) {
        if (
            !interaction.isModalSubmit() ||
            (
                !interaction.customId.startsWith(WELCOME_MODAL_PREFIX) &&
                !interaction.customId.startsWith(LEAVE_MODAL_PREFIX)
            )
        ) {
            return;
        }

        const isLeaveConfig =
            interaction.customId.startsWith(LEAVE_MODAL_PREFIX);

        if (!interaction.inGuild() || !interaction.guild) {
            return safeReply(interaction, {
                content:
                    'Cette configuration doit etre faite dans un serveur.',
                flags:
                    MessageFlags.Ephemeral
            });
        }

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

        const [, expectedUserId, channelId] =
            interaction.customId.split(':');

        if (expectedUserId !== interaction.user.id) {
            return safeReply(interaction, {
                content:
                    'Ce modal ne correspond pas a votre session.',
                flags:
                    MessageFlags.Ephemeral
            });
        }

        const channel =
            interaction.guild.channels.cache.get(channelId);

        if (!channel) {
            return safeReply(interaction, {
                content:
                    isLeaveConfig
                        ? 'Salon de depart introuvable.'
                        : 'Salon de bienvenue introuvable.',
                flags:
                    MessageFlags.Ephemeral
            });
        }

        const validation =
            (isLeaveConfig ? normalizeLeaveEmbed : normalizeWelcomeEmbed)({
                title:
                    interaction.fields.getTextInputValue('title'),
                description:
                    interaction.fields.getTextInputValue('description'),
                color:
                    interaction.fields.getTextInputValue('color'),
                footer:
                    interaction.fields.getTextInputValue('footer'),
                content:
                    interaction.fields.getTextInputValue('content')
            });

        if (validation.error) {
            return safeReply(interaction, {
                content:
                    validation.error,
                flags:
                    MessageFlags.Ephemeral
            });
        }

        const saveConfig =
            isLeaveConfig
                ? saveLeaveConfig
                : saveWelcomeConfig;

        await saveConfig({
            guildId:
                interaction.guild.id,
            guildName:
                interaction.guild.name,
            channelId:
                channel.id,
            embedConfig:
                validation.value
        });

        return safeReply(interaction, {
            content:
                isLeaveConfig
                    ? `Configuration de depart enregistree pour ${channel}.`
                    : `Configuration de bienvenue enregistree pour ${channel}.`,
            flags:
                MessageFlags.Ephemeral
        });
    }
};

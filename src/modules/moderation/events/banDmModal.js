const {
    Events,
    MessageFlags,
    PermissionFlagsBits
} = require('discord.js');

const {
    safeReply
} = require('../../../core/interactions');

const {
    BAN_DM_MODAL_PREFIX
} = require('../classique/commands/ban');

const {
    normalizeBanDmInput,
    saveBanDmConfig
} = require('../services/banDmService');

module.exports = {
    name: Events.InteractionCreate,

    async execute(interaction) {
        if (
            !interaction.isModalSubmit() ||
            !interaction.customId.startsWith(BAN_DM_MODAL_PREFIX)
        ) {
            return;
        }

        if (!interaction.inGuild() || !interaction.guild) {
            return safeReply(interaction, {
                content:
                    'Cette configuration doit être faite dans un serveur.',
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

        const validation =
            normalizeBanDmInput({
                title:
                    interaction.fields.getTextInputValue('title'),
                description:
                    interaction.fields.getTextInputValue('description')
            });

        if (validation.error) {
            return safeReply(interaction, {
                content:
                    validation.error,
                flags:
                    MessageFlags.Ephemeral
            });
        }

        await saveBanDmConfig({
            guildId:
                interaction.guild.id,
            ...validation.value
        });

        return safeReply(interaction, {
            content:
                'Le message privé de ban a été enregistré.',
            flags:
                MessageFlags.Ephemeral
        });
    }
};

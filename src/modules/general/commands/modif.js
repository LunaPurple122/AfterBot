const {
    MessageFlags,
    PermissionFlagsBits,
    SlashCommandBuilder
} = require('discord.js');

const {
    safeReply
} = require('../../../core/interactions');

const {
    buildLeaveModal,
    buildWelcomeModal
} = require('./config');

const {
    getLeaveConfig,
    getWelcomeConfig
} = require('../services/welcomeService');

function getTextChannel(guild, channelId) {
    if (!channelId) return null;

    const channel =
        guild.channels.cache.get(channelId);

    if (!channel?.isTextBased?.()) {
        return null;
    }

    return channel;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('modif')
        .setDescription('Modifier des messages configures.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('bienvenue')
                .setDescription('Modifier le message de bienvenue.')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('depart')
                .setDescription('Modifier le message de depart.')
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        if (!interaction.inGuild() || !interaction.guild) {
            return safeReply(interaction, {
                content:
                    'Cette commande doit etre utilisee dans un serveur.',
                flags:
                    MessageFlags.Ephemeral
            });
        }

        const subcommand =
            interaction.options.getSubcommand();

        if (subcommand === 'bienvenue') {
            const config =
                await getWelcomeConfig(interaction.guild.id);

            const channel =
                getTextChannel(
                    interaction.guild,
                    config?.salon_bienvenue_id
                );

            if (!channel) {
                return safeReply(interaction, {
                    content:
                        'Aucun salon de bienvenue configure. Utilise /config bienvenue d\'abord.',
                    flags:
                        MessageFlags.Ephemeral
                });
            }

            return interaction.showModal(
                buildWelcomeModal(
                    interaction.user.id,
                    channel.id,
                    config?.bienvenue_embed
                )
            );
        }

        if (subcommand === 'depart') {
            const config =
                await getLeaveConfig(interaction.guild.id);

            const channel =
                getTextChannel(
                    interaction.guild,
                    config?.salon_depart_id
                );

            if (!channel) {
                return safeReply(interaction, {
                    content:
                        'Aucun salon de depart configure. Utilise /config depart d\'abord.',
                    flags:
                        MessageFlags.Ephemeral
                });
            }

            return interaction.showModal(
                buildLeaveModal(
                    interaction.user.id,
                    channel.id,
                    config?.depart_embed
                )
            );
        }

        return safeReply(interaction, {
            content:
                'Sous-commande inconnue.',
            flags:
                MessageFlags.Ephemeral
        });
    }
};

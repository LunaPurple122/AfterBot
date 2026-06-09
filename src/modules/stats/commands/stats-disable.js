const {
    EmbedBuilder,
    PermissionFlagsBits,
    SlashCommandBuilder
} = require('discord.js');

const {
    disableStatsConfig
} = require('../services/statsConfigService');

const {
    stopGuildVoiceSessions
} = require('../services/voiceSessionService');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stats-disable')
        .setDescription('Désactiver complètement le module de statistiques.')
        .setDefaultMemberPermissions(
            PermissionFlagsBits.Administrator
        ),

    async execute(interaction) {
        if (!interaction.guild) {
            return interaction.reply({
                content: '❌ Cette commande doit être utilisée sur un serveur.',
                ephemeral: true
            });
        }

        await disableStatsConfig(interaction.guild.id);
        await stopGuildVoiceSessions(interaction.guild.id);

        const embed =
            new EmbedBuilder()
                .setColor(0xED4245)
                .setTitle('Statistiques désactivées')
                .setDescription(
                    'Le comptage vocal, le comptage messages et les publications automatiques sont arrêtés. Les statistiques existantes sont conservées.'
                )
                .setTimestamp();

        return interaction.reply({
            embeds: [embed],
            ephemeral: true
        });
    }
};

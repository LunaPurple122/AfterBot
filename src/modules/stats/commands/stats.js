const {
    EmbedBuilder,
    SlashCommandBuilder
} = require('discord.js');

const {
    formatDuration
} = require('../services/durationService');

const {
    getMemberStats
} = require('../services/statsService');

function formatNumber(value) {
    return Number(value || 0).toLocaleString('fr-FR');
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stats')
        .setDescription('Afficher les statistiques d’un membre.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('vocal')
                .setDescription('Afficher le temps vocal.')
                .addUserOption(option =>
                    option
                        .setName('membre')
                        .setDescription('Membre ciblé')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('messages')
                .setDescription('Afficher le nombre de messages.')
                .addUserOption(option =>
                    option
                        .setName('membre')
                        .setDescription('Membre ciblé')
                        .setRequired(false)
                )
        ),

    async execute(interaction) {
        if (!interaction.guild) {
            return interaction.reply({
                content: '❌ Cette commande doit être utilisée sur un serveur.',
                ephemeral: true
            });
        }

        const subcommand =
            interaction.options.getSubcommand();

        const user =
            interaction.options.getUser('membre') ||
            interaction.user;

        const stats =
            await getMemberStats(
                interaction.guild.id,
                user.id
            );

        const embed =
            new EmbedBuilder()
                .setColor(0x5865F2)
                .setAuthor({
                    name: user.tag,
                    iconURL: user.displayAvatarURL()
                })
                .setTimestamp();

        if (subcommand === 'vocal') {
            embed
                .setTitle('Statistiques vocales')
                .setDescription(
                    `${user} a passé **${formatDuration(stats.voice_seconds)}** en vocal.`
                );
        }

        if (subcommand === 'messages') {
            embed
                .setTitle('Statistiques messages')
                .setDescription(
                    `${user} a envoyé **${formatNumber(stats.message_count)} messages**.`
                );
        }

        return interaction.reply({
            embeds: [embed]
        });
    }
};

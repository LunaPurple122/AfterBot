const {
    EmbedBuilder,
    SlashCommandBuilder
} = require('discord.js');

const {
    formatDuration
} = require('../services/durationService');

const {
    getMessageLeaderboard,
    getVoiceLeaderboard
} = require('../services/statsService');

const medals = [
    '🥇',
    '🥈',
    '🥉'
];

function rankLabel(index) {
    return medals[index] || `#${index + 1}`;
}

function formatNumber(value) {
    return Number(value || 0).toLocaleString('fr-FR');
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('Afficher les classements du serveur.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('vocal')
                .setDescription('Afficher le classement vocal.')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('messages')
                .setDescription('Afficher le classement messages.')
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

        const isVoice =
            subcommand === 'vocal';

        const rows =
            isVoice
                ? await getVoiceLeaderboard(interaction.guild.id)
                : await getMessageLeaderboard(interaction.guild.id);

        const description =
            rows.length > 0
                ? rows.map((row, index) => {
                    const value =
                        isVoice
                            ? formatDuration(row.voice_seconds)
                            : `${formatNumber(row.message_count)} messages`;

                    return `${rankLabel(index)} <@${row.user_id}> — ${value}`;
                }).join('\n')
                : 'Aucune statistique disponible pour le moment.';

        const embed =
            new EmbedBuilder()
                .setColor(isVoice ? 0x57F287 : 0x5865F2)
                .setTitle(
                    isVoice
                        ? 'Classement vocal'
                        : 'Classement messages'
                )
                .setDescription(description)
                .setFooter({
                    text: interaction.guild.name
                })
                .setTimestamp();

        return interaction.reply({
            embeds: [embed]
        });
    }
};

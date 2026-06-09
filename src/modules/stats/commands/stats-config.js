const {
    EmbedBuilder,
    PermissionFlagsBits,
    SlashCommandBuilder
} = require('discord.js');

const {
    formatDuration
} = require('../services/durationService');

const {
    formatNumber
} = require('../services/leaderboardRenderer');

const {
    getStatsConfigSummary
} = require('../services/statsConfigService');

function formatDate(value) {
    if (!value) {
        return 'Jamais';
    }

    return new Date(value).toLocaleString('fr-FR');
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stats-config')
        .setDescription('Afficher la configuration du module stats.')
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

        const config =
            await getStatsConfigSummary(interaction.guild.id);

        const embed =
            new EmbedBuilder()
                .setColor(config?.enabled ? 0x57F287 : 0xED4245)
                .setTitle('Configuration stats')
                .addFields(
                    {
                        name: 'Statut',
                        value: config?.enabled ? 'Activé' : 'Désactivé',
                        inline: true
                    },
                    {
                        name: 'Salon',
                        value: config?.leaderboard_channel_id
                            ? `<#${config.leaderboard_channel_id}>`
                            : 'Non configuré',
                        inline: true
                    },
                    {
                        name: 'Heure d’envoi',
                        value: config?.daily_send_time || '20:00',
                        inline: true
                    },
                    {
                        name: 'Dernier envoi automatique',
                        value: formatDate(config?.last_daily_sent_at),
                        inline: false
                    },
                    {
                        name: 'Membres suivis',
                        value: formatNumber(config?.tracked_members || 0),
                        inline: true
                    },
                    {
                        name: 'Temps vocal cumulé',
                        value: formatDuration(config?.total_voice_seconds || 0),
                        inline: true
                    },
                    {
                        name: 'Messages cumulés',
                        value: formatNumber(config?.total_message_count || 0),
                        inline: true
                    },
                    {
                        name: 'Configuration créée le',
                        value: formatDate(config?.created_at),
                        inline: false
                    }
                )
                .setTimestamp();

        return interaction.reply({
            embeds: [embed],
            ephemeral: true
        });
    }
};

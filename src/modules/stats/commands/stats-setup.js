const {
    ChannelType,
    EmbedBuilder,
    PermissionFlagsBits,
    SlashCommandBuilder
} = require('discord.js');

const {
    isValidDailySendTime,
    upsertStatsConfig
} = require('../services/statsConfigService');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stats-setup')
        .setDescription('Configurer les publications automatiques des stats.')
        .addChannelOption(option =>
            option
                .setName('salon')
                .setDescription('Salon de publication des classements')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('heure')
                .setDescription('Heure quotidienne au format HH:MM')
                .setRequired(false)
        )
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

        const channel =
            interaction.options.getChannel('salon');

        const dailySendTime =
            interaction.options.getString('heure') || '20:00';

        if (!isValidDailySendTime(dailySendTime)) {
            return interaction.reply({
                content:
                    '❌ Heure invalide. Utilisez le format `HH:MM`, par exemple `20:00`.',
                ephemeral: true
            });
        }

        await upsertStatsConfig(
            interaction.guild.id,
            channel.id,
            dailySendTime
        );

        const embed =
            new EmbedBuilder()
                .setColor(0x57F287)
                .setTitle('Configuration stats activée')
                .setDescription(
                    `Les classements automatiques seront envoyés dans ${channel}.`
                )
                .addFields(
                    {
                        name: 'Statut',
                        value: 'Activé',
                        inline: true
                    },
                    {
                        name: 'Heure',
                        value: dailySendTime,
                        inline: true
                    }
                )
                .setTimestamp();

        return interaction.reply({
            embeds: [embed],
            ephemeral: true
        });
    }
};

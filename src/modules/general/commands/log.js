const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType
} = require('discord.js');

const {
    LOG_TYPE_CHOICES,
    LOG_TYPE_LABELS
} = require('../../../core/logTypes');

const {
    getLogChannel,
    setLogChannel,
    removeLogChannel,
    listLogChannels
} = require('../../../core/logChannelService');

function addTypeOption(subcommand) {
    return subcommand.addStringOption(option =>
        option
            .setName('type')
            .setDescription('Type de log')
            .setRequired(true)
            .addChoices(...LOG_TYPE_CHOICES)
    );
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('log')
        .setDescription('Gérer les salons de logs par type.')
        .addSubcommand(subcommand =>
            addTypeOption(
                subcommand
                    .setName('channel')
                    .setDescription('Définir le salon pour un type de log.')
            )
                .addChannelOption(option =>
                    option
                        .setName('salon')
                        .setDescription('Salon de logs')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('Voir la configuration des salons de logs.')
        )
        .addSubcommand(subcommand =>
            addTypeOption(
                subcommand
                    .setName('remove')
                    .setDescription('Retirer le salon spécifique d’un type de log.')
            )
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const subcommand =
            interaction.options.getSubcommand();

        const guildId =
            interaction.guild.id;

        if (subcommand === 'channel') {
            const logType =
                interaction.options.getString('type');

            const channel =
                interaction.options.getChannel('salon');

            await setLogChannel(
                guildId,
                logType,
                channel.id
            );

            return interaction.reply({
                content:
                    `✅ Logs ${LOG_TYPE_LABELS[logType]} définis sur ${channel}.`,
                ephemeral: true
            });
        }

        if (subcommand === 'remove') {
            const logType =
                interaction.options.getString('type');

            const removed =
                await removeLogChannel(
                    guildId,
                    logType
                );

            return interaction.reply({
                content: removed
                    ? `✅ Configuration retirée pour ${LOG_TYPE_LABELS[logType]}. Le fallback général sera utilisé.`
                    : `ℹ️ Aucun salon spécifique configuré pour ${LOG_TYPE_LABELS[logType]}.`,
                ephemeral: true
            });
        }

        if (subcommand === 'list') {
            const configured =
                await listLogChannels(guildId);

            const configuredByType =
                new Map(
                    configured.map(row => [
                        row.log_type,
                        row.channel_id
                    ])
                );

            const lines =
                await Promise.all(
                    Object.entries(LOG_TYPE_LABELS)
                        .map(async ([logType, label]) => {
                            const specificChannelId =
                                configuredByType.get(logType);

                            if (specificChannelId) {
                                return `${logType} (${label}) : <#${specificChannelId}>`;
                            }

                            const fallbackChannelId =
                                await getLogChannel(guildId, logType);

                            return fallbackChannelId
                                ? `${logType} (${label}) : fallback <#${fallbackChannelId}>`
                                : `${logType} (${label}) : non configuré`;
                        })
                );

            return interaction.reply({
                content:
                    `Configuration des logs :\n${lines.join('\n')}`,
                ephemeral: true
            });
        }
    }
};

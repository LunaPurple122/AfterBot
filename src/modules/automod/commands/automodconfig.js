const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType
} = require('discord.js');

const { pool } =
    require('../../../database/db');

module.exports = {

    data: new SlashCommandBuilder()

        .setName('automodconfig')

        .setDescription(
            'Configurer l’automod.'
        )

        // ANTI SPAM
        .addBooleanOption(option =>
            option

                .setName('anti_spam')

                .setDescription(
                    'Activer l’anti spam'
                )

                .setRequired(true)
        )

        .addIntegerOption(option =>
            option

                .setName('message_limit')

                .setDescription(
                    'Nombre max de messages'
                )

                .setMinValue(2)

                .setMaxValue(20)

                .setRequired(true)
        )

        .addIntegerOption(option =>
            option

                .setName('interval')

                .setDescription(
                    'Intervalle en secondes'
                )

                .setMinValue(1)

                .setMaxValue(30)

                .setRequired(true)
        )

        .addIntegerOption(option =>
            option

                .setName('spam_timeout')

                .setDescription(
                    'Timeout spam en minutes'
                )

                .setMinValue(1)

                .setMaxValue(10080)

                .setRequired(true)
        )

        // MASS MENTION
        .addBooleanOption(option =>
            option

                .setName('anti_mass_mention')

                .setDescription(
                    'Activer l’anti mass mention'
                )

                .setRequired(true)
        )

        .addIntegerOption(option =>
            option

                .setName('mention_limit')

                .setDescription(
                    'Nombre max de mentions'
                )

                .setMinValue(2)

                .setMaxValue(50)

                .setRequired(true)
        )

        .addIntegerOption(option =>
            option

                .setName('mention_timeout')

                .setDescription(
                    'Timeout mass mention en minutes'
                )

                .setMinValue(1)

                .setMaxValue(10080)

                .setRequired(true)
        )

        // SCAM LINKS
        .addBooleanOption(option =>
            option

                .setName('anti_scam_links')

                .setDescription(
                    'Activer l’anti liens frauduleux'
                )

                .setRequired(true)
        )

        // RAID JOIN
        .addBooleanOption(option =>
            option

                .setName('anti_raid_join')

                .setDescription(
                    'Activer l’anti raid join'
                )

                .setRequired(true)
        )

        .addIntegerOption(option =>
            option

                .setName('raid_join_limit')

                .setDescription(
                    'Nombre d’arrivées max'
                )

                .setMinValue(2)

                .setMaxValue(100)

                .setRequired(true)
        )

        .addIntegerOption(option =>
            option

                .setName('raid_join_interval')

                .setDescription(
                    'Intervalle anti raid en secondes'
                )

                .setMinValue(1)

                .setMaxValue(300)

                .setRequired(true)
        )

        .addIntegerOption(option =>
            option

                .setName('raid_lockdown')

                .setDescription(
                    'Durée du lockdown en minutes'
                )

                .setMinValue(1)

                .setMaxValue(1440)

                .setRequired(true)
        )

        // LOGS
        .addChannelOption(option =>
            option

                .setName('logs_channel')

                .setDescription(
                    'Salon logs automod'
                )

                .addChannelTypes(
                    ChannelType.GuildText
                )

                .setRequired(true)
        )

        .setDefaultMemberPermissions(
            PermissionFlagsBits.Administrator
        ),

    async execute(interaction) {

        const antiSpam =
            interaction.options.getBoolean(
                'anti_spam'
            );

        const messageLimit =
            interaction.options.getInteger(
                'message_limit'
            );

        const interval =
            interaction.options.getInteger(
                'interval'
            );

        const spamTimeout =
            interaction.options.getInteger(
                'spam_timeout'
            );

        const antiMassMention =
            interaction.options.getBoolean(
                'anti_mass_mention'
            );

        const mentionLimit =
            interaction.options.getInteger(
                'mention_limit'
            );

        const mentionTimeout =
            interaction.options.getInteger(
                'mention_timeout'
            );

        const antiScamLinks =
            interaction.options.getBoolean(
                'anti_scam_links'
            );

        const antiRaidJoin =
            interaction.options.getBoolean(
                'anti_raid_join'
            );

        const raidJoinLimit =
            interaction.options.getInteger(
                'raid_join_limit'
            );

        const raidJoinInterval =
            interaction.options.getInteger(
                'raid_join_interval'
            );

        const raidLockdown =
            interaction.options.getInteger(
                'raid_lockdown'
            );

        const logsChannel =
            interaction.options.getChannel(
                'logs_channel'
            );

        try {

            await pool.query(

                `
                INSERT INTO automod_config (

                    serveur_id,

                    anti_spam_enabled,
                    spam_message_limit,
                    spam_interval,
                    spam_timeout_minutes,

                    anti_mass_mention_enabled,
                    mass_mention_limit,
                    mass_mention_timeout_minutes,

                    anti_scam_links_enabled,

                    anti_raid_join_enabled,
                    raid_join_limit,
                    raid_join_interval,
                    raid_lockdown_minutes,

                    logs_channel_id

                )

                VALUES (
                    $1, $2, $3,
                    $4, $5,
                    $6, $7,
                    $8, $9,
                    $10, $11,
                    $12, $13,
                    $14
                )

                ON CONFLICT (serveur_id)

                DO UPDATE SET

                    anti_spam_enabled =
                        EXCLUDED.anti_spam_enabled,

                    spam_message_limit =
                        EXCLUDED.spam_message_limit,

                    spam_interval =
                        EXCLUDED.spam_interval,

                    spam_timeout_minutes =
                        EXCLUDED.spam_timeout_minutes,

                    anti_mass_mention_enabled =
                        EXCLUDED.anti_mass_mention_enabled,

                    mass_mention_limit =
                        EXCLUDED.mass_mention_limit,

                    mass_mention_timeout_minutes =
                        EXCLUDED.mass_mention_timeout_minutes,

                    anti_scam_links_enabled =
                        EXCLUDED.anti_scam_links_enabled,

                    anti_raid_join_enabled =
                        EXCLUDED.anti_raid_join_enabled,

                    raid_join_limit =
                        EXCLUDED.raid_join_limit,

                    raid_join_interval =
                        EXCLUDED.raid_join_interval,

                    raid_lockdown_minutes =
                        EXCLUDED.raid_lockdown_minutes,

                    logs_channel_id =
                        EXCLUDED.logs_channel_id
                `,

                [
                    interaction.guild.id,

                    antiSpam,
                    messageLimit,
                    interval,
                    spamTimeout,

                    antiMassMention,
                    mentionLimit,
                    mentionTimeout,

                    antiScamLinks,

                    antiRaidJoin,
                    raidJoinLimit,
                    raidJoinInterval,
                    raidLockdown,

                    logsChannel.id
                ]
            );

        } catch (error) {

            console.error(error);

            return interaction.reply({

                content:
                    '❌ Impossible de sauvegarder la configuration.',

                ephemeral: true
            });
        }

        await interaction.reply({

            content:
`✅ Automod configuré.

🛡️ Anti spam :
${antiSpam ? 'Activé' : 'Désactivé'}

📄 Limite spam :
${messageLimit} messages

⏱️ Intervalle :
${interval} secondes

🔨 Timeout spam :
${spamTimeout} minutes

🚨 Anti mass mention :
${antiMassMention ? 'Activé' : 'Désactivé'}

📢 Limite mentions :
${mentionLimit}

🔨 Timeout mentions :
${mentionTimeout} minutes

🔗 Anti scam links :
${antiScamLinks ? 'Activé' : 'Désactivé'}

🛡️ Anti raid join :
${antiRaidJoin ? 'Activé' : 'Désactivé'}

👥 Limite arrivées :
${raidJoinLimit}

⏱️ Intervalle raid :
${raidJoinInterval} secondes

🔒 Lockdown :
${raidLockdown} minutes

📝 Logs :
${logsChannel}`,

            ephemeral: true
        });
    }
};
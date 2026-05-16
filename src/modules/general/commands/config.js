const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType
} = require('discord.js');

const { pool } = require('../../../database/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('config')
        .setDescription('Configuration du serveur.')

        // LOGS
        .addSubcommand(subcommand =>
            subcommand
                .setName('logs')
                .setDescription('Définir le salon des logs.')
                .addChannelOption(option =>
                    option
                        .setName('salon')
                        .setDescription('Salon des logs')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true)
                )
        )

        // BIENVENUE
        .addSubcommand(subcommand =>
            subcommand
                .setName('bienvenue')
                .setDescription('Définir le salon de bienvenue.')
                .addChannelOption(option =>
                    option
                        .setName('salon')
                        .setDescription('Salon de bienvenue')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true)
                )
        )

        // RADIO
        .addSubcommand(subcommand =>
            subcommand
                .setName('radio')
                .setDescription('Définir le salon radio.')
                .addChannelOption(option =>
                    option
                        .setName('salon')
                        .setDescription('Salon radio')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true)
                )
        )

        // AUTOMOD
        .addSubcommand(subcommand =>
            subcommand
                .setName('automod')
                .setDescription('Activer ou désactiver l’automod.')
                .addBooleanOption(option =>
                    option
                        .setName('etat')
                        .setDescription('Activer ou désactiver')
                        .setRequired(true)
                )
        )

        // CAPTCHA
        .addSubcommand(subcommand =>
            subcommand
                .setName('captcha')
                .setDescription('Activer ou désactiver le captcha.')
                .addBooleanOption(option =>
                    option
                        .setName('etat')
                        .setDescription('Activer ou désactiver')
                        .setRequired(true)
                )
        )

        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {

        const subcommand = interaction.options.getSubcommand();
        const serveurId = interaction.guild.id;

        // LOGS
        if (subcommand === 'logs') {

            const salon = interaction.options.getChannel('salon');

            await pool.query(`
                UPDATE serveurs
                SET salon_logs_id = $1
                WHERE serveur_id = $2
            `, [salon.id, serveurId]);

            return interaction.reply({
                content: `✅ Salon des logs défini sur ${salon}.`,
                ephemeral: true
            });
        }

        // BIENVENUE
        if (subcommand === 'bienvenue') {

            const salon = interaction.options.getChannel('salon');

            await pool.query(`
                UPDATE serveurs
                SET salon_bienvenue_id = $1
                WHERE serveur_id = $2
            `, [salon.id, serveurId]);

            return interaction.reply({
                content: `✅ Salon de bienvenue défini sur ${salon}.`,
                ephemeral: true
            });
        }

        // RADIO
        if (subcommand === 'radio') {

            const salon = interaction.options.getChannel('salon');

            await pool.query(`
                UPDATE serveurs
                SET salon_radio_id = $1
                WHERE serveur_id = $2
            `, [salon.id, serveurId]);

            return interaction.reply({
                content: `✅ Salon radio défini sur ${salon}.`,
                ephemeral: true
            });
        }

        // AUTOMOD
        if (subcommand === 'automod') {

            const etat = interaction.options.getBoolean('etat');

            await pool.query(`
                UPDATE serveurs
                SET automod_actif = $1
                WHERE serveur_id = $2
            `, [etat, serveurId]);

            return interaction.reply({
                content: `✅ Automod ${etat ? 'activé' : 'désactivé'}.`,
                ephemeral: true
            });
        }

        // CAPTCHA
        if (subcommand === 'captcha') {

            const etat = interaction.options.getBoolean('etat');

            await pool.query(`
                UPDATE serveurs
                SET captcha_actif = $1
                WHERE serveur_id = $2
            `, [etat, serveurId]);

            return interaction.reply({
                content: `✅ Captcha ${etat ? 'activé' : 'désactivé'}.`,
                ephemeral: true
            });
        }
    }
};
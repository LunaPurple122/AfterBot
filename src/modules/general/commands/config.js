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

        // DEPART
        .addSubcommand(subcommand =>
            subcommand
                .setName('depart')
                .setDescription('Définir le salon de départ.')
                .addChannelOption(option =>
                    option
                        .setName('salon')
                        .setDescription('Salon de départ')
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

        // CAPTCHA ROLE NON VERIFIE
        .addSubcommand(subcommand =>
            subcommand
                .setName('captcha-role-non-verifie')
                .setDescription('Définir le rôle non vérifié.')
                .addRoleOption(option =>
                    option
                        .setName('role')
                        .setDescription('Rôle non vérifié')
                        .setRequired(true)
                )
        )

        // CAPTCHA ROLE MEMBRE
        .addSubcommand(subcommand =>
            subcommand
                .setName('captcha-role-membre')
                .setDescription('Définir le rôle membre.')
                .addRoleOption(option =>
                    option
                        .setName('role')
                        .setDescription('Rôle membre')
                        .setRequired(true)
                )
        )

        // CAPTCHA CATEGORIE
        .addSubcommand(subcommand =>
            subcommand
                .setName('captcha-categorie')
                .setDescription('Définir la catégorie captcha.')
                .addChannelOption(option =>
                    option
                        .setName('categorie')
                        .setDescription('Catégorie captcha')
                        .addChannelTypes(ChannelType.GuildCategory)
                        .setRequired(true)
                )
        )

        // REGLEMENT ROLE
        .addSubcommand(subcommand =>
            subcommand
                .setName('reglement-role')
                .setDescription('Définir le rôle règlement.')
                .addRoleOption(option =>
                    option
                        .setName('role')
                        .setDescription('Rôle règlement')
                        .setRequired(true)
                )
        )

        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {

        const subcommand = interaction.options.getSubcommand();
        const serveurId = interaction.guild.id;

        await pool.query(`
            INSERT INTO serveurs (serveur_id, nom)
            VALUES ($1, $2)
            ON CONFLICT (serveur_id)
            DO NOTHING
        `, [serveurId, interaction.guild.name]);

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

        //DEPART
        if (subcommand === 'depart') {

            const salon = interaction.options.getChannel('salon');

            await pool.query(`
                UPDATE serveurs
                SET salon_depart_id = $1
                WHERE serveur_id = $2
            `, [salon.id, serveurId]);

            return interaction.reply({
                content:
                    `✅ Salon de départ défini sur ${salon}.`,
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

        // CAPTCHA ROLE NON VERIFIE
        if (subcommand === 'captcha-role-non-verifie') {

            const role = interaction.options.getRole('role');

            await pool.query(`
                UPDATE serveurs
                SET role_non_verifie_id = $1
                WHERE serveur_id = $2
            `, [role.id, serveurId]);

            return interaction.reply({
                content: `✅ Rôle non vérifié défini sur ${role}.`,
                ephemeral: true
            });
        }

        // CAPTCHA ROLE MEMBRE
        if (subcommand === 'captcha-role-membre') {

            const role = interaction.options.getRole('role');

            await pool.query(`
                UPDATE serveurs
                SET role_membre_id = $1
                WHERE serveur_id = $2
            `, [role.id, serveurId]);

            return interaction.reply({
                content: `✅ Rôle membre défini sur ${role}.`,
                ephemeral: true
            });
        }

        // CAPTCHA CATEGORIE
        if (subcommand === 'captcha-categorie') {

            const categorie =
                interaction.options.getChannel('categorie');

            await pool.query(`
                UPDATE serveurs
                SET categorie_captcha_id = $1
                WHERE serveur_id = $2
            `, [categorie.id, serveurId]);

            return interaction.reply({
                content: `✅ Catégorie captcha définie sur ${categorie}.`,
                ephemeral: true
            });
        }

        // REGLEMENT ROLE
        if (subcommand === 'reglement-role') {

            const role =
                interaction.options.getRole('role');

            await pool.query(`
                UPDATE serveurs
                SET role_reglement_id = $1
                WHERE serveur_id = $2
            `, [role.id, serveurId]);

            return interaction.reply({

                content:
                    `✅ Rôle règlement défini sur ${role}.`,

                ephemeral: true
            });
        }

    }
};

const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType,
    ActionRowBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} = require('discord.js');

const { pool } = require('../../../database/db');
const {
    DEFAULT_LEAVE_EMBED,
    DEFAULT_WELCOME_EMBED
} = require('../services/welcomeService');

const LEAVE_MODAL_PREFIX = 'config_leave:';
const WELCOME_MODAL_PREFIX = 'config_welcome:';

function setOptionalValue(input, value) {
    const text =
        String(value || '').trim();

    if (text) {
        input.setValue(text);
    } else {
        input.setPlaceholder('Optionnel');
    }

    return input;
}

function buildWelcomeModal(userId, channelId, existingConfig = {}) {
    const config = {
        ...DEFAULT_WELCOME_EMBED,
        ...(existingConfig || {})
    };

    return new ModalBuilder()
        .setCustomId(`${WELCOME_MODAL_PREFIX}${userId}:${channelId}`)
        .setTitle('Message de bienvenue')
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('title')
                    .setLabel('Titre de l\'embed')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
                    .setMaxLength(256)
                    .setValue(config.title)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('description')
                    .setLabel('Description')
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(true)
                    .setMaxLength(4000)
                    .setValue(config.description)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('color')
                    .setLabel('Couleur hexadecimale')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
                    .setMaxLength(7)
                    .setValue(config.color)
            ),
            new ActionRowBuilder().addComponents(
                setOptionalValue(
                    new TextInputBuilder()
                        .setCustomId('footer')
                        .setLabel('Footer')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(false)
                        .setMaxLength(2048),
                    config.footer
                )
            ),
            new ActionRowBuilder().addComponents(
                setOptionalValue(
                    new TextInputBuilder()
                        .setCustomId('content')
                        .setLabel('Message hors embed')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(false)
                        .setMaxLength(2000),
                    config.content
                )
            )
        );
}

function buildLeaveModal(userId, channelId, existingConfig = {}) {
    const config = {
        ...DEFAULT_LEAVE_EMBED,
        ...(existingConfig || {})
    };

    return new ModalBuilder()
        .setCustomId(`${LEAVE_MODAL_PREFIX}${userId}:${channelId}`)
        .setTitle('Message de depart')
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('title')
                    .setLabel('Titre de l\'embed')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
                    .setMaxLength(256)
                    .setValue(config.title)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('description')
                    .setLabel('Description')
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(true)
                    .setMaxLength(4000)
                    .setValue(config.description)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('color')
                    .setLabel('Couleur hexadecimale')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
                    .setMaxLength(7)
                    .setValue(config.color)
            ),
            new ActionRowBuilder().addComponents(
                setOptionalValue(
                    new TextInputBuilder()
                        .setCustomId('footer')
                        .setLabel('Footer')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(false)
                        .setMaxLength(2048),
                    config.footer
                )
            ),
            new ActionRowBuilder().addComponents(
                setOptionalValue(
                    new TextInputBuilder()
                        .setCustomId('content')
                        .setLabel('Message hors embed')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(false)
                        .setMaxLength(2000),
                    config.content
                )
            )
        );
}

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

        // ROLE MEMBRE SERVEUR
        .addSubcommand(subcommand =>
            subcommand
                .setName('member_role')
                .setDescription('Définir le rôle membre du serveur.')
                .addRoleOption(option =>
                    option
                        .setName('role')
                        .setDescription('Rôle membre du serveur')
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

            return interaction.showModal(
                buildWelcomeModal(
                    interaction.user.id,
                    salon.id
                )
            );
        }

        //DEPART
        if (subcommand === 'depart') {

            const salon = interaction.options.getChannel('salon');

            return interaction.showModal(
                buildLeaveModal(
                    interaction.user.id,
                    salon.id
                )
            );
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
        if (
            subcommand === 'captcha-role-membre' ||
            subcommand === 'member_role'
        ) {

            const role = interaction.options.getRole('role');

            await pool.query(`
                UPDATE serveurs
                SET role_membre_id = $1
                WHERE serveur_id = $2
            `, [role.id, serveurId]);

            return interaction.reply({
                content: `✅ Rôle membre du serveur défini sur ${role}.`,
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

    },

    buildLeaveModal,
    buildWelcomeModal,
    LEAVE_MODAL_PREFIX,
    WELCOME_MODAL_PREFIX
};

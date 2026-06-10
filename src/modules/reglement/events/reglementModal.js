const {
    Events,
    PermissionFlagsBits
} = require('discord.js');

const { pool } =
    require('../../../database/db');

const {
    safeDeferReply,
    safeReply
} = require('../../../core/interactions');

const CUSTOM_ID_PREFIX = 'reglement_configurer:';
const MAX_REGLEMENT_LENGTH = 4000;

module.exports = {
    name: Events.InteractionCreate,

    async execute(interaction) {
        if (
            !interaction.isModalSubmit() ||
            !interaction.customId.startsWith(CUSTOM_ID_PREFIX)
        ) {
            return;
        }

        const expectedUserId =
            interaction.customId.replace(
                CUSTOM_ID_PREFIX,
                ''
            );

        if (interaction.user.id !== expectedUserId) {
            return safeReply(interaction, {
                content:
                    'Ce modal ne t est pas destine.',
                ephemeral: true
            });
        }

        if (
            !interaction.member.permissions.has(
                PermissionFlagsBits.Administrator
            )
        ) {
            return safeReply(interaction, {
                content:
                    'Tu n as pas la permission de configurer le reglement.',
                ephemeral: true
            });
        }

        const texteReglement =
            interaction.fields
                .getTextInputValue('texte_reglement')
                .trim();

        if (!texteReglement) {
            return safeReply(interaction, {
                content:
                    'Le texte du reglement ne peut pas etre vide.',
                ephemeral: true
            });
        }

        if (texteReglement.length > MAX_REGLEMENT_LENGTH) {
            return safeReply(interaction, {
                content:
                    `Le texte du reglement est limite a ${MAX_REGLEMENT_LENGTH} caracteres.`,
                ephemeral: true
            });
        }

        try {
            const deferred =
                await safeDeferReply(interaction, {
                    ephemeral: true
                });

            if (!deferred) return;

            await pool.query(
                `INSERT INTO serveurs (
                    serveur_id,
                    nom,
                    texte_reglement
                )
                VALUES ($1, $2, $3)
                ON CONFLICT (serveur_id)
                DO UPDATE SET
                    nom = EXCLUDED.nom,
                    texte_reglement = EXCLUDED.texte_reglement,
                    modifie_le = CURRENT_TIMESTAMP`,
                [
                    interaction.guild.id,
                    interaction.guild.name,
                    texteReglement
                ]
            );

            return safeReply(interaction, {
                content:
                    'Texte du reglement enregistre.',
                ephemeral: true
            });

        } catch (error) {
            console.error(
                'Impossible d enregistrer le texte du reglement :',
                error
            );

            return safeReply(interaction, {
                content:
                    'Impossible d enregistrer le texte du reglement.',
                ephemeral: true
            });
        }
    }
};

const {
    Events,
    PermissionFlagsBits
} = require('discord.js');

const { pool } =
    require('../database/db');

const {
    botHasGuildPermission
} = require('../core/permissions');

const {
    safeDeferReply,
    safeReply
} = require('../core/interactions');

module.exports = {

    reglementButtonEvent: {

        name: Events.InteractionCreate,

        async execute(interaction) {

            if (!interaction.isButton()) return;

            if (
                interaction.customId !==
                'accepter_reglement'
            ) return;

            const deferred =
                await safeDeferReply(interaction, {
                    ephemeral: true
                });

            if (!deferred) return;

            const result =
                await pool.query(
                    `SELECT role_reglement_id
                    FROM serveurs
                    WHERE serveur_id = $1`,
                    [interaction.guild.id]
                );

            const config =
                result.rows[0];

            if (!config) {

                return safeReply(interaction, {

                    content:
                        '❌ Configuration manquante.',

                    ephemeral: true
                });
            }

            const role =
                interaction.guild.roles.cache.get(
                    config.role_reglement_id
                );

            if (!role) {

                return safeReply(interaction, {

                    content:
                        '❌ Rôle introuvable.',

                    ephemeral: true
                });
            }

            if (
                !botHasGuildPermission(
                    interaction.guild,
                    PermissionFlagsBits.ManageRoles
                )
            ) {

                console.error('Permission bot manquante pour donner le rôle règlement : ManageRoles');

                return safeReply(interaction, {

                    content:
                        '❌ Permission bot manquante : ManageRoles.',

                    ephemeral: true
                });
            }

            // DEJA VERIFIE
            if (
                interaction.member.roles.cache.has(
                    role.id
                )
            ) {

                return safeReply(interaction, {

                    content:
                        '✅ Tu as déjà accepté le règlement.',

                    ephemeral: true
                });
            }

            try {

                await interaction.member.roles.add(
                    role
                );

                return safeReply(interaction, {

                    content:
                        '✅ Règlement accepté.',

                    ephemeral: true
                });

            } catch (error) {

                console.error('Impossible de donner le rôle règlement :', error);

                return safeReply(interaction, {

                    content:
                        '❌ Impossible de donner le rôle.',

                    ephemeral: true
                });
            }
        }
    }
};

const {
    Events
} = require('discord.js');

const { pool } =
    require('../database/db');

module.exports = {

    reglementButtonEvent: {

        name: Events.InteractionCreate,

        async execute(interaction) {

            if (!interaction.isButton()) return;

            if (
                interaction.customId !==
                'accepter_reglement'
            ) return;

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

                return interaction.reply({

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

                return interaction.reply({

                    content:
                        '❌ Rôle introuvable.',

                    ephemeral: true
                });
            }

            // DEJA VERIFIE
            if (
                interaction.member.roles.cache.has(
                    role.id
                )
            ) {

                return interaction.reply({

                    content:
                        '✅ Tu as déjà accepté le règlement.',

                    ephemeral: true
                });
            }

            try {

                await interaction.member.roles.add(
                    role
                );

                return interaction.reply({

                    content:
                        '✅ Règlement accepté.',

                    ephemeral: true
                });

            } catch {

                return interaction.reply({

                    content:
                        '❌ Impossible de donner le rôle.',

                    ephemeral: true
                });
            }
        }
    }
};
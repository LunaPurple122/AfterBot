const {
    SlashCommandBuilder,
    PermissionFlagsBits
} = require('discord.js');

const { pool } =
    require('../../../database/db');

const {
    requireBotPermission
} = require('../../../core/permissions');

module.exports = {

    data: new SlashCommandBuilder()

        .setName('autorole')
        .setDescription(
            'Gestion des autorôles.'
        )

        // AJOUTER
        .addSubcommand(subcommand =>
            subcommand

                .setName('ajouter')
                .setDescription(
                    'Ajouter un autorôle.'
                )

                .addRoleOption(option =>
                    option

                        .setName('role')
                        .setDescription(
                            'Rôle à ajouter'
                        )

                        .setRequired(true)
                )
        )

        // SUPPRIMER
        .addSubcommand(subcommand =>
            subcommand

                .setName('supprimer')
                .setDescription(
                    'Supprimer un autorôle.'
                )

                .addRoleOption(option =>
                    option

                        .setName('role')
                        .setDescription(
                            'Rôle à supprimer'
                        )

                        .setRequired(true)
                )
        )

        // LISTE
        .addSubcommand(subcommand =>
            subcommand

                .setName('liste')
                .setDescription(
                    'Afficher les autorôles.'
                )
        )

        // VERIFIER
        .addSubcommand(subcommand =>
            subcommand

                .setName('verifier')
                .setDescription(
                    'Vérifier tous les membres.'
                )
        )

        .setDefaultMemberPermissions(
            PermissionFlagsBits.Administrator
        ),

    async execute(interaction) {

        const subcommand =
            interaction.options.getSubcommand();

        const serveurId =
            interaction.guild.id;

        // AJOUTER
        if (subcommand === 'ajouter') {

            const role =
                interaction.options.getRole(
                    'role'
                );

            const dejaExistant =
                await pool.query(
                    `SELECT *
                    FROM autoroles
                    WHERE serveur_id = $1
                    AND role_id = $2`,
                    [
                        serveurId,
                        role.id
                    ]
                );

            if (
                dejaExistant.rows.length > 0
            ) {

                return interaction.reply({

                    content:
                        '❌ Ce rôle est déjà un autorôle.',

                    ephemeral: true
                });
            }

            await pool.query(
                `INSERT INTO autoroles
                (serveur_id, role_id)
                VALUES ($1, $2)`,
                [
                    serveurId,
                    role.id
                ]
            );

            return interaction.reply({

                content:
                    `✅ Autorôle ajouté :
${role}`,

                ephemeral: true
            });
        }

        // SUPPRIMER
        if (subcommand === 'supprimer') {

            const role =
                interaction.options.getRole(
                    'role'
                );

            await pool.query(
                `DELETE FROM autoroles
                WHERE serveur_id = $1
                AND role_id = $2`,
                [
                    serveurId,
                    role.id
                ]
            );

            return interaction.reply({

                content:
                    `✅ Autorôle supprimé :
${role}`,

                ephemeral: true
            });
        }

        // LISTE
        if (subcommand === 'liste') {

            const result =
                await pool.query(
                    `SELECT *
                    FROM autoroles
                    WHERE serveur_id = $1`,
                    [serveurId]
                );

            if (
                result.rows.length === 0
            ) {

                return interaction.reply({

                    content:
                        '❌ Aucun autorôle.',

                    ephemeral: true
                });
            }

            const roles =
                result.rows.map(row => {

                    return `<@&${row.role_id}>`;

                }).join('\n');

            return interaction.reply({

                content:
`🌃 Autorôles configurés :

${roles}`,

                ephemeral: true
            });
        }

        // VERIFIER
        if (subcommand === 'verifier') {

            if (!await requireBotPermission(
                interaction,
                PermissionFlagsBits.ManageRoles,
                'ManageRoles'
            )) return;

            await interaction.reply({

                content:
                    '⏳ Vérification en cours...',

                ephemeral: true
            });

            const result =
                await pool.query(
                    `SELECT *
                    FROM autoroles
                    WHERE serveur_id = $1`,
                    [serveurId]
                );

            const autoroles =
                result.rows;

            let membresVerifies = 0;

            for (
                const member
                of interaction.guild.members.cache.values()
            ) {

                if (member.user.bot) continue;

                for (
                    const autorole
                    of autoroles
                ) {

                    const role =
                        interaction.guild.roles.cache.get(
                            autorole.role_id
                        );

                    if (!role) continue;

                    if (
                        member.roles.cache.has(
                            role.id
                        )
                    ) continue;

                    try {

                        await member.roles.add(role);

                    } catch (error) {
                        console.error(`Impossible d'ajouter l'autorôle ${autorole.role_id} à ${member.id} :`, error);
                    }

                }

                membresVerifies++;
            }

            return interaction.editReply({

                content:
`✅ Vérification terminée.

👥 Membres vérifiés :
${membresVerifies}`

            });
        }
    }
};

const {
    SlashCommandBuilder,
    PermissionFlagsBits
} = require('discord.js');

const { pool } =
    require('../../../database/db');

module.exports = {

    data: new SlashCommandBuilder()

        .setName('ticketroles')

        .setDescription(
            'Gestion des rôles ping tickets.'
        )

        // ADD
        .addSubcommand(subcommand =>
            subcommand

                .setName('add')

                .setDescription(
                    'Ajouter un rôle à ping pour les tickets.'
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

        // REMOVE
        .addSubcommand(subcommand =>
            subcommand

                .setName('remove')

                .setDescription(
                    'Retirer un rôle à ping pour les tickets.'
                )

                .addRoleOption(option =>
                    option

                        .setName('role')

                        .setDescription(
                            'Rôle à retirer'
                        )

                        .setRequired(true)
                )
        )

        // LIST
        .addSubcommand(subcommand =>
            subcommand

                .setName('list')

                .setDescription(
                    'Afficher les rôles ping tickets.'
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

        // ADD
        if (subcommand === 'add') {

            const role =
                interaction.options.getRole(
                    'role'
                );

            const result =
                await pool.query(

                    `
                    INSERT INTO ticket_ping_roles
                    (
                        serveur_id,
                        role_id
                    )

                    VALUES ($1, $2)

                    ON CONFLICT
                    (
                        serveur_id,
                        role_id
                    )

                    DO NOTHING

                    RETURNING *
                    `,

                    [
                        serveurId,
                        role.id
                    ]
                );

            if (
                result.rows.length === 0
            ) {

                return interaction.reply({

                    content:
                        '❌ Ce rôle est déjà dans la liste des rôles ping tickets.',

                    ephemeral: true
                });
            }

            return interaction.reply({

                content:
`✅ Rôle ajouté aux pings tickets :
${role}`,

                ephemeral: true
            });
        }

        // REMOVE
        if (subcommand === 'remove') {

            const role =
                interaction.options.getRole(
                    'role'
                );

            const result =
                await pool.query(

                    `
                    DELETE FROM ticket_ping_roles

                    WHERE serveur_id = $1
                    AND role_id = $2

                    RETURNING *
                    `,

                    [
                        serveurId,
                        role.id
                    ]
                );

            if (
                result.rows.length === 0
            ) {

                return interaction.reply({

                    content:
                        '❌ Ce rôle n’est pas dans la liste des rôles ping tickets.',

                    ephemeral: true
                });
            }

            return interaction.reply({

                content:
`✅ Rôle retiré des pings tickets :
${role}`,

                ephemeral: true
            });
        }

        // LIST
        if (subcommand === 'list') {

            const result =
                await pool.query(

                    `
                    SELECT role_id
                    FROM ticket_ping_roles
                    WHERE serveur_id = $1
                    ORDER BY id ASC
                    `,

                    [
                        serveurId
                    ]
                );

            if (
                result.rows.length === 0
            ) {

                return interaction.reply({

                    content:
                        '❌ Aucun rôle ping ticket configuré.',

                    ephemeral: true
                });
            }

            const roles =
                result.rows.map(row => {

                    return `<@&${row.role_id}>`;

                }).join('\n');

            return interaction.reply({

                content:
`🎫 Rôles ping tickets configurés :

${roles}`,

                ephemeral: true
            });
        }
    }
};

const {
    SlashCommandBuilder,
    PermissionFlagsBits
} = require('discord.js');

const { envoyerLog } =
    require('../../../../core/logger');

const {
    requireBotPermission
} = require('../../../../core/permissions');

module.exports = {

    data: new SlashCommandBuilder()

        .setName('role')

        .setDescription(
            'Gestion des rôles.'
        )

        // ADD
        .addSubcommand(subcommand =>
            subcommand

                .setName('add')

                .setDescription(
                    'Ajouter un rôle.'
                )

                .addUserOption(option =>
                    option

                        .setName('membre')

                        .setDescription(
                            'Membre ciblé'
                        )

                        .setRequired(true)
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
                    'Retirer un rôle.'
                )

                .addUserOption(option =>
                    option

                        .setName('membre')

                        .setDescription(
                            'Membre ciblé'
                        )

                        .setRequired(true)
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

        .setDefaultMemberPermissions(
            PermissionFlagsBits.ManageRoles
        ),

    async execute(interaction) {

        const subcommand =
            interaction.options.getSubcommand();

        const membre =
            interaction.options.getMember(
                'membre'
            );

        const user =
            interaction.options.getUser(
                'membre'
            );

        const role =
            interaction.options.getRole(
                'role'
            );

        if (!await requireBotPermission(
            interaction,
            PermissionFlagsBits.ManageRoles,
            'ManageRoles'
        )) return;

        // MEMBRE INTROUVABLE
        if (!membre) {

            return interaction.reply({

                content:
                    '❌ Membre introuvable.',

                ephemeral: true
            });
        }

        // ROLE BOT
        if (
            role.position >=
            interaction.guild.members.me.roles.highest.position
        ) {

            return interaction.reply({

                content:
                    '❌ Mon rôle est trop bas.',

                ephemeral: true
            });
        }

        // HIERARCHIE USER
        if (
            role.position >=
            interaction.member.roles.highest.position
            &&
            interaction.guild.ownerId !==
            interaction.user.id
        ) {

            return interaction.reply({

                content:
                    '❌ Ce rôle est supérieur ou égal au tien.',

                ephemeral: true
            });
        }

        // ADD
        if (subcommand === 'add') {

            if (
                membre.roles.cache.has(
                    role.id
                )
            ) {

                return interaction.reply({

                    content:
                        '❌ Ce membre possède déjà ce rôle.',

                    ephemeral: true
                });
            }

            try {

                await membre.roles.add(role);

            } catch (error) {

                console.error(`Impossible d'ajouter le rôle ${role.id} à ${membre.id} :`, error);

                return interaction.reply({

                    content:
                        '❌ Impossible d’ajouter ce rôle.',

                    ephemeral: true
                });
            }

            await interaction.reply({

                content:
`✅ Rôle ajouté.

👤 Membre :
${user}

🎭 Rôle :
${role}`
            });

            // LOG
            await envoyerLog(

                interaction.client,

                interaction.guild.id,

                {

                    titre:
                        '🎭 Rôle ajouté',

                    description:
`👤 Membre :
${user}

🎭 Rôle :
${role}

🛡️ Modérateur :
${interaction.user}`,

                    couleur: 0x57F287,

                    auteur: user
                }
            );

            return;
        }

        // REMOVE
        if (subcommand === 'remove') {

            if (
                !membre.roles.cache.has(
                    role.id
                )
            ) {

                return interaction.reply({

                    content:
                        '❌ Ce membre ne possède pas ce rôle.',

                    ephemeral: true
                });
            }

            try {

                await membre.roles.remove(role);

            } catch (error) {

                console.error(`Impossible de retirer le rôle ${role.id} à ${membre.id} :`, error);

                return interaction.reply({

                    content:
                        '❌ Impossible de retirer ce rôle.',

                    ephemeral: true
                });
            }

            await interaction.reply({

                content:
`✅ Rôle retiré.

👤 Membre :
${user}

🎭 Rôle :
${role}`
            });

            // LOG
            await envoyerLog(

                interaction.client,

                interaction.guild.id,

                {

                    titre:
                        '🗑️ Rôle retiré',

                    description:
`👤 Membre :
${user}

🎭 Rôle :
${role}

🛡️ Modérateur :
${interaction.user}`,

                    couleur: 0xED4245,

                    auteur: user
                }
            );
        }
    }
};

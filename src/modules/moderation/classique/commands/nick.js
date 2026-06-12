const {
    SlashCommandBuilder,
    PermissionFlagsBits
} = require('discord.js');

const { envoyerLog } =
    require('../../../../core/logger');

module.exports = {

    data: new SlashCommandBuilder()

        .setName('nick')

        .setDescription(
            'Gestion des pseudos.'
        )

        // SET
        .addSubcommand(subcommand =>
            subcommand

                .setName('set')

                .setDescription(
                    'Modifier le pseudo.'
                )

                .addUserOption(option =>
                    option

                        .setName('membre')

                        .setDescription(
                            'Membre ciblé'
                        )

                        .setRequired(true)
                )

                .addStringOption(option =>
                    option

                        .setName('pseudo')

                        .setDescription(
                            'Nouveau pseudo'
                        )

                        .setRequired(true)

                        .setMaxLength(32)
                )
        )

        // RESET
        .addSubcommand(subcommand =>
            subcommand

                .setName('reset')

                .setDescription(
                    'Réinitialiser le pseudo.'
                )

                .addUserOption(option =>
                    option

                        .setName('membre')

                        .setDescription(
                            'Membre ciblé'
                        )

                        .setRequired(true)
                )
        )

        .setDefaultMemberPermissions(
            PermissionFlagsBits.ManageNicknames
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

        // MEMBRE INTROUVABLE
        if (!membre) {

            return interaction.reply({

                content:
                    '❌ Membre introuvable.',

                ephemeral: true
            });
        }

        // OWNER
        if (
            membre.id ===
            interaction.guild.ownerId
        ) {

            return interaction.reply({

                content:
                    '❌ Impossible de modifier le pseudo du propriétaire.',

                ephemeral: true
            });
        }

        // HIERARCHIE USER
        if (
            membre.roles.highest.position >=
            interaction.member.roles.highest.position
            &&
            interaction.guild.ownerId !==
            interaction.user.id
        ) {

            return interaction.reply({

                content:
                    '❌ Ce membre possède un rôle supérieur ou égal au tien.',

                ephemeral: true
            });
        }

        // HIERARCHIE BOT
        if (
            membre.roles.highest.position >=
            interaction.guild.members.me.roles.highest.position
        ) {

            return interaction.reply({

                content:
                    '❌ Mon rôle est trop bas.',

                ephemeral: true
            });
        }

        const ancienPseudo =
            membre.nickname ||
            membre.user.username;

        // SET
        if (subcommand === 'set') {

            const pseudo =
                interaction.options.getString(
                    'pseudo'
                );

            try {

                await membre.setNickname(
                    pseudo
                );

            } catch {

                return interaction.reply({

                    content:
                        '❌ Impossible de modifier ce pseudo.',

                    ephemeral: true
                });
            }

            await interaction.reply({

                content:
`✅ Pseudo modifié.

👤 Membre :
${user}

📝 Ancien pseudo :
${ancienPseudo}

✨ Nouveau pseudo :
${pseudo}`
            });

            // LOG
            await envoyerLog(

                interaction.client,

                interaction.guild.id,

                {
                    type: 'user',

                    titre:
                        '📝 Pseudo modifié',

                    description:
`👤 Membre :
${user}

📝 Ancien pseudo :
${ancienPseudo}

✨ Nouveau pseudo :
${pseudo}

🛡️ Modérateur :
${interaction.user}`,

                    couleur: 0x5865F2,

                    auteur: user
                }
            );

            return;
        }

        // RESET
        if (subcommand === 'reset') {

            try {

                await membre.setNickname(
                    null
                );

            } catch {

                return interaction.reply({

                    content:
                        '❌ Impossible de réinitialiser ce pseudo.',

                    ephemeral: true
                });
            }

            await interaction.reply({

                content:
`✅ Pseudo réinitialisé.

👤 Membre :
${user}

📝 Ancien pseudo :
${ancienPseudo}`
            });

            // LOG
            await envoyerLog(

                interaction.client,

                interaction.guild.id,

                {
                    type: 'user',

                    titre:
                        '🔄 Pseudo réinitialisé',

                    description:
`👤 Membre :
${user}

📝 Ancien pseudo :
${ancienPseudo}

🛡️ Modérateur :
${interaction.user}`,

                    couleur: 0x57F287,

                    auteur: user
                }
            );
        }
    }
};

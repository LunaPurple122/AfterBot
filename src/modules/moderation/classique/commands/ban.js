const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder
} = require('discord.js');

const { envoyerLog } =
    require('../../../../core/logger');

const {
    requireBotPermission
} = require('../../../../core/permissions');

module.exports = {

    data: new SlashCommandBuilder()

        .setName('ban')

        .setDescription(
            'Bannir un membre ou un utilisateur par ID.'
        )

        .addUserOption(option =>
            option

                .setName('membre')

                .setDescription(
                    'Membre ou utilisateur à bannir'
                )

                .setRequired(true)
        )

        .addStringOption(option =>
            option

                .setName('raison')

                .setDescription(
                    'Raison du ban'
                )

                .setRequired(false)
        )

        .setDefaultMemberPermissions(
            PermissionFlagsBits.BanMembers
        ),

    async execute(interaction) {

        const membre =
            interaction.options.getMember(
                'membre'
            );

        const user =
            interaction.options.getUser(
                'membre'
            );

        const raison =
            interaction.options.getString(
                'raison'
            ) || 'Aucune raison fournie';

        if (!await requireBotPermission(
            interaction,
            PermissionFlagsBits.BanMembers,
            'BanMembers'
        )) return;

        // USER INTROUVABLE
        if (!user) {

            return interaction.reply({

                content:
                    '❌ Utilisateur introuvable.',

                ephemeral: true
            });
        }

        // SELF BAN
        if (
            user.id === interaction.user.id
        ) {

            return interaction.reply({

                content:
                    '❌ Tu ne peux pas te bannir toi-même.',

                ephemeral: true
            });
        }

        // OWNER
        if (
            user.id ===
            interaction.guild.ownerId
        ) {

            return interaction.reply({

                content:
                    '❌ Impossible de bannir le propriétaire du serveur.',

                ephemeral: true
            });
        }

        // HIERARCHIE UNIQUEMENT SI LE MEMBRE EST SUR LE SERVEUR
        if (membre) {

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

            // BOT HIERARCHIE
            if (
                membre.roles.highest.position >=
                interaction.guild.members.me.roles.highest.position
            ) {

                return interaction.reply({

                    content:
                        '❌ Mon rôle est trop bas pour bannir ce membre.',

                    ephemeral: true
                });
            }

            // DM UNIQUEMENT SI LE MEMBRE EST SUR LE SERVEUR
            try {

                const embed =
                    new EmbedBuilder()

                        .setColor(0xED4245)

                        .setTitle(
                            '🔨 Bannissement'
                        )

                        .setDescription(
`Tu as été banni de :

🌃 ${interaction.guild.name}

📄 Raison :
${raison}

📧 Demande de déban :
deban-adg@afterproject.fr`
                        )

                        .setTimestamp();

                await membre.send({
                    embeds: [embed]
                });

            } catch (error) {
                console.error(`Impossible d'envoyer le DM de ban à ${membre.id} :`, error);
            }
        }

        // BAN PAR ID, FONCTIONNE AUSSI SI LA PERSONNE N'EST PAS SUR LE SERVEUR
        try {

            await interaction.guild.bans.create(
                user.id,
                {
                    reason:
                        `${raison} | Modérateur : ${interaction.user.tag}`
                }
            );

        } catch (error) {

            console.error(error);

            return interaction.reply({

                content:
                    '❌ Impossible de bannir cet utilisateur.',

                ephemeral: true
            });
        }

        // REPONSE
        await interaction.reply({

            content:
`✅ ${user.tag} a été banni.

📄 Raison :
${raison}`
        });

        // LOG
        await envoyerLog(

            interaction.client,

            interaction.guild.id,

            {

                titre: '🔨 Bannissement',

                description:
`👤 Utilisateur :
${user}

🆔 ID :
${user.id}

🛡️ Modérateur :
${interaction.user}

📄 Raison :
${raison}`,

                couleur: 0xED4245,

                auteur: user
            }
        );
    }
};

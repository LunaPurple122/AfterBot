const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder
} = require('discord.js');

const { envoyerLog } =
    require('../../../../core/logger');

module.exports = {

    data: new SlashCommandBuilder()

        .setName('ban')

        .setDescription(
            'Bannir un membre.'
        )

        .addUserOption(option =>
            option

                .setName('membre')

                .setDescription(
                    'Membre à bannir'
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

        // MEMBRE INTROUVABLE
        if (!membre) {

            return interaction.reply({

                content:
                    '❌ Membre introuvable.',

                ephemeral: true
            });
        }

        // SELF BAN
        if (
            membre.id === interaction.user.id
        ) {

            return interaction.reply({

                content:
                    '❌ Tu ne peux pas te bannir toi-même.',

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
                    '❌ Impossible de bannir le propriétaire du serveur.',

                ephemeral: true
            });
        }

        // HIERARCHIE
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

        // DM
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
deban@afterstation.fr`
                    )

                    .setTimestamp();

            await membre.send({
                embeds: [embed]
            });

        } catch {}

        // BAN
        try {

            await membre.ban({

                reason:
                    `${raison} | Modérateur : ${interaction.user.tag}`

            });

        } catch {

            return interaction.reply({

                content:
                    '❌ Impossible de bannir ce membre.',

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
`👤 Membre :
${user}

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
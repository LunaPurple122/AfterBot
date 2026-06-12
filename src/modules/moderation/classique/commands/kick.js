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

        .setName('kick')

        .setDescription(
            'Expulser un membre.'
        )

        .addUserOption(option =>
            option

                .setName('membre')

                .setDescription(
                    'Membre à expulser'
                )

                .setRequired(true)
        )

        .addStringOption(option =>
            option

                .setName('raison')

                .setDescription(
                    'Raison du kick'
                )

                .setRequired(false)
        )

        .setDefaultMemberPermissions(
            PermissionFlagsBits.KickMembers
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
            PermissionFlagsBits.KickMembers,
            'KickMembers'
        )) return;

        // MEMBRE INTROUVABLE
        if (!membre) {

            return interaction.reply({

                content:
                    '❌ Membre introuvable.',

                ephemeral: true
            });
        }

        // SELF KICK
        if (
            membre.id === interaction.user.id
        ) {

            return interaction.reply({

                content:
                    '❌ Tu ne peux pas t’expulser toi-même.',

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
                    '❌ Impossible d’expulser le propriétaire du serveur.',

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
                    '❌ Mon rôle est trop bas pour expulser ce membre.',

                ephemeral: true
            });
        }

        // DM
        try {

            const embed =
                new EmbedBuilder()

                    .setColor(0xED4245)

                    .setTitle(
                        '👢 Expulsion'
                    )

                    .setDescription(
`Tu as été expulsé de :

🌃 ${interaction.guild.name}

📄 Raison :
${raison}`
                    )

                    .setTimestamp();

            await membre.send({
                embeds: [embed]
            });

        } catch (error) {
            console.error(`Impossible d'envoyer le DM de kick à ${membre.id} :`, error);
        }

        // KICK
        try {

            await membre.kick(
                `${raison} | Modérateur : ${interaction.user.tag}`
            );

        } catch (error) {

            console.error(`Impossible de kick ${membre.id} :`, error);

            return interaction.reply({

                content:
                    '❌ Impossible d’expulser ce membre.',

                ephemeral: true
            });
        }

        // REPONSE
        await interaction.reply({

            content:
`✅ ${user.tag} a été expulsé.

📄 Raison :
${raison}`
        });

        // LOG
        await envoyerLog(

            interaction.client,

            interaction.guild.id,

            {
                type: 'punisher',

                titre: '👢 Expulsion',

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

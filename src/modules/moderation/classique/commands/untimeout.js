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

        .setName('untimeout')

        .setDescription(
            'Retirer le timeout d’un membre.'
        )

        .addUserOption(option =>
            option

                .setName('membre')

                .setDescription(
                    'Membre à untimeout'
                )

                .setRequired(true)
        )

        .addStringOption(option =>
            option

                .setName('raison')

                .setDescription(
                    'Raison du retrait'
                )

                .setRequired(false)
        )

        .setDefaultMemberPermissions(
            PermissionFlagsBits.ModerateMembers
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
            PermissionFlagsBits.ModerateMembers,
            'ModerateMembers'
        )) return;

        // MEMBRE INTROUVABLE
        if (!membre) {

            return interaction.reply({

                content:
                    '❌ Membre introuvable.',

                ephemeral: true
            });
        }

        // PAS TIMEOUT
        if (
            !membre.communicationDisabledUntil
        ) {

            return interaction.reply({

                content:
                    '❌ Ce membre n’est pas timeout.',

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
                    '❌ Mon rôle est trop bas.',

                ephemeral: true
            });
        }

        // DM
        try {

            const embed =
                new EmbedBuilder()

                    .setColor(0x57F287)

                    .setTitle(
                        '🔓 Timeout retiré'
                    )

                    .setDescription(
`Ton timeout sur :

🌃 ${interaction.guild.name}

a été retiré.

📄 Raison :
${raison}`
                    )

                    .setTimestamp();

            await membre.send({
                embeds: [embed]
            });

        } catch (error) {
            console.error(`Impossible d'envoyer le DM d'untimeout à ${membre.id} :`, error);
        }

        // REMOVE TIMEOUT
        try {

            await membre.timeout(

                null,

                `${raison} | Modérateur : ${interaction.user.tag}`
            );

        } catch (error) {

            console.error(`Impossible de retirer le timeout de ${membre.id} :`, error);

            return interaction.reply({

                content:
                    '❌ Impossible de retirer le timeout.',

                ephemeral: true
            });
        }

        // REPONSE
        await interaction.reply({

            content:
`✅ Timeout retiré pour ${user.tag}.

📄 Raison :
${raison}`
        });

        // LOG
        await envoyerLog(

            interaction.client,

            interaction.guild.id,

            {
                type: 'punisher',

                titre: '🔓 Timeout retiré',

                description:
`👤 Membre :
${user}

🛡️ Modérateur :
${interaction.user}

📄 Raison :
${raison}`,

                couleur: 0x57F287,

                auteur: user
            }
        );
    }
};

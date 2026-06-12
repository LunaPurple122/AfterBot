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

function convertirTemps(temps) {

    const regex = /^(\d+)(s|m|h|d)$/;

    const match = temps.match(regex);

    if (!match) return null;

    const valeur = parseInt(match[1]);

    const unite = match[2];

    switch (unite) {

        case 's':
            return valeur * 1000;

        case 'm':
            return valeur * 60 * 1000;

        case 'h':
            return valeur * 60 * 60 * 1000;

        case 'd':
            return valeur * 24 * 60 * 60 * 1000;

        default:
            return null;
    }
}

module.exports = {

    data: new SlashCommandBuilder()

        .setName('timeout')

        .setDescription(
            'Timeout un membre.'
        )

        .addUserOption(option =>
            option

                .setName('membre')

                .setDescription(
                    'Membre à timeout'
                )

                .setRequired(true)
        )

        .addStringOption(option =>
            option

                .setName('duree')

                .setDescription(
                    'Exemple : 10m, 1h, 2d'
                )

                .setRequired(true)
        )

        .addStringOption(option =>
            option

                .setName('raison')

                .setDescription(
                    'Raison du timeout'
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

        const dureeInput =
            interaction.options.getString(
                'duree'
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

        const duree =
            convertirTemps(dureeInput);

        // FORMAT
        if (!duree) {

            return interaction.reply({

                content:
                    '❌ Format invalide. Exemple : 10m, 1h, 2d',

                ephemeral: true
            });
        }

        // MAX DISCORD
        if (
            duree >
            28 * 24 * 60 * 60 * 1000
        ) {

            return interaction.reply({

                content:
                    '❌ La durée maximale est de 28 jours.',

                ephemeral: true
            });
        }

        // MEMBRE INTROUVABLE
        if (!membre) {

            return interaction.reply({

                content:
                    '❌ Membre introuvable.',

                ephemeral: true
            });
        }

        // SELF
        if (
            membre.id === interaction.user.id
        ) {

            return interaction.reply({

                content:
                    '❌ Tu ne peux pas te timeout toi-même.',

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
                    '❌ Impossible de timeout le propriétaire du serveur.',

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
                    '❌ Mon rôle est trop bas pour timeout ce membre.',

                ephemeral: true
            });
        }

        // DM
        try {

            const embed =
                new EmbedBuilder()

                    .setColor(0xFEE75C)

                    .setTitle(
                        '⏳ Timeout'
                    )

                    .setDescription(
`Tu as reçu un timeout sur :

🌃 ${interaction.guild.name}

⏱️ Durée :
${dureeInput}

📄 Raison :
${raison}`
                    )

                    .setTimestamp();

            await membre.send({
                embeds: [embed]
            });

        } catch (error) {
            console.error(`Impossible d'envoyer le DM de timeout à ${membre.id} :`, error);
        }

        // TIMEOUT
        try {

            await membre.timeout(

                duree,

                `${raison} | Modérateur : ${interaction.user.tag}`
            );

        } catch (error) {

            console.error(`Impossible de timeout ${membre.id} :`, error);

            return interaction.reply({

                content:
                    '❌ Impossible de timeout ce membre.',

                ephemeral: true
            });
        }

        // REPONSE
        await interaction.reply({

            content:
`✅ ${user.tag} a été timeout.

⏱️ Durée :
${dureeInput}

📄 Raison :
${raison}`
        });

        // LOG
        await envoyerLog(

            interaction.client,

            interaction.guild.id,

            {
                type: 'punisher',

                titre: '⏳ Timeout',

                description:
`👤 Membre :
${user}

🛡️ Modérateur :
${interaction.user}

⏱️ Durée :
${dureeInput}

📄 Raison :
${raison}`,

                couleur: 0xFEE75C,

                auteur: user
            }
        );
    }
};

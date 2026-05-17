const {
    SlashCommandBuilder,
    PermissionFlagsBits
} = require('discord.js');

const { envoyerLog } =
    require('../../../../core/logger');

module.exports = {

    data: new SlashCommandBuilder()

        .setName('unban')

        .setDescription(
            'Débannir un utilisateur.'
        )

        .addStringOption(option =>
            option

                .setName('utilisateur')

                .setDescription(
                    'ID ou tag utilisateur'
                )

                .setRequired(true)
        )

        .addStringOption(option =>
            option

                .setName('raison')

                .setDescription(
                    'Raison du déban'
                )

                .setRequired(false)
        )

        .setDefaultMemberPermissions(
            PermissionFlagsBits.BanMembers
        ),

    async execute(interaction) {

        const utilisateur =
            interaction.options.getString(
                'utilisateur'
            );

        const raison =
            interaction.options.getString(
                'raison'
            ) || 'Aucune raison fournie';

        const bans =
            await interaction.guild.bans.fetch();

        let banTrouve = null;

        // RECHERCHE PAR ID
        banTrouve =
            bans.find(
                ban => ban.user.id === utilisateur
            );

        // RECHERCHE PAR TAG
        if (!banTrouve) {

            banTrouve =
                bans.find(
                    ban =>
                        ban.user.tag
                            .toLowerCase() ===
                        utilisateur.toLowerCase()
                );
        }

        if (!banTrouve) {

            return interaction.reply({

                content:
                    '❌ Aucun utilisateur banni trouvé.',

                ephemeral: true
            });
        }

        try {

            await interaction.guild.members.unban(

                banTrouve.user.id,

                `${raison} | Modérateur : ${interaction.user.tag}`
            );

        } catch {

            return interaction.reply({

                content:
                    '❌ Impossible de débannir cet utilisateur.',

                ephemeral: true
            });
        }

        // REPONSE
        await interaction.reply({

            content:
`✅ ${banTrouve.user.tag} a été débanni.

📄 Raison :
${raison}`
        });

        // LOG
        await envoyerLog(

            interaction.client,

            interaction.guild.id,

            {

                titre: '🔓 Débannissement',

                description:
`👤 Utilisateur :
${banTrouve.user}

🛡️ Modérateur :
${interaction.user}

📄 Raison :
${raison}`,

                couleur: 0x57F287,

                auteur: banTrouve.user
            }
        );
    }
};
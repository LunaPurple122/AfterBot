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

        .setName('banid')

        .setDescription(
            'Bannir un ou plusieurs utilisateurs par ID.'
        )

        .addStringOption(option =>
            option

                .setName('ids')

                .setDescription(
                    'IDs à bannir, séparés par des espaces'
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

        const idsRaw =
            interaction.options.getString('ids');

        const raison =
            interaction.options.getString('raison') ||
            'Aucune raison fournie';

        if (!await requireBotPermission(
            interaction,
            PermissionFlagsBits.BanMembers,
            'BanMembers'
        )) return;

        const ids =
            idsRaw
                .split(/\s+/)
                .map(id => id.trim())
                .filter(id => /^\d{17,20}$/.test(id));

        if (ids.length === 0) {

            return interaction.reply({

                content:
                    '❌ Aucun ID valide fourni.',

                ephemeral: true
            });
        }

        await interaction.deferReply({
            ephemeral: true
        });

        const bannis = [];
        const erreurs = [];

        for (const id of ids) {

            if (id === interaction.user.id) {

                erreurs.push(
                    `${id} : impossible de te bannir toi-même`
                );

                continue;
            }

            if (id === interaction.guild.ownerId) {

                erreurs.push(
                    `${id} : impossible de bannir le propriétaire`
                );

                continue;
            }

            try {

                await interaction.guild.bans.create(
                    id,
                    {
                        reason:
                            `${raison} | Modérateur : ${interaction.user.tag}`
                    }
                );

                bannis.push(id);

            } catch (error) {

                console.error(
                    `Erreur ban ID ${id} :`,
                    error
                );

                erreurs.push(
                    `${id} : erreur lors du bannissement`
                );
            }
        }

        await interaction.editReply({

            content:
`🔨 Bannissement par ID terminé.

✅ Bannis :
${bannis.length > 0 ? bannis.join('\n') : 'Aucun'}

❌ Erreurs :
${erreurs.length > 0 ? erreurs.join('\n') : 'Aucune'}

📄 Raison :
${raison}`
        });

        if (bannis.length > 0) {

            await envoyerLog(

                interaction.client,

                interaction.guild.id,

                {

                    titre: '🔨 Bannissement par ID',

                    description:
`👤 Utilisateurs bannis :
${bannis.map(id => `<@${id}> | ${id}`).join('\n')}

🛡️ Modérateur :
${interaction.user}

📄 Raison :
${raison}`,

                    couleur: 0xED4245,

                    auteur: interaction.user
                }
            );
        }
    }
};

const {
    SlashCommandBuilder,
    PermissionFlagsBits
} = require('discord.js');

const { envoyerLog } =
    require('../../../../core/logger');

const {
    requireBotPermission
} = require('../../../../core/permissions');

function convertirTemps(temps) {

    const regex = /^(\d+)(s|m|h)$/;

    const match = temps.match(regex);

    if (!match) return null;

    const valeur = parseInt(match[1]);

    const unite = match[2];

    switch (unite) {

        case 's':
            return valeur;

        case 'm':
            return valeur * 60;

        case 'h':
            return valeur * 60 * 60;

        default:
            return null;
    }
}

module.exports = {

    data: new SlashCommandBuilder()

        .setName('channel')

        .setDescription(
            'Gestion des salons.'
        )

        // LOCK
        .addSubcommand(subcommand =>
            subcommand

                .setName('lock')

                .setDescription(
                    'Verrouiller le salon.'
                )
        )

        // UNLOCK
        .addSubcommand(subcommand =>
            subcommand

                .setName('unlock')

                .setDescription(
                    'Déverrouiller le salon.'
                )
        )

        // SLOWMODE
        .addSubcommand(subcommand =>
            subcommand

                .setName('slowmode')

                .setDescription(
                    'Modifier le slowmode.'
                )

                .addStringOption(option =>
                    option

                        .setName('duree')

                        .setDescription(
                            'Exemple : 10s, 5m, 1h'
                        )

                        .setRequired(true)
                )
        )

        .setDefaultMemberPermissions(
            PermissionFlagsBits.ManageChannels
        ),

    async execute(interaction) {

        const subcommand =
            interaction.options.getSubcommand();

        const channel =
            interaction.channel;

        if (!await requireBotPermission(
            interaction,
            PermissionFlagsBits.ManageChannels,
            'ManageChannels'
        )) return;

        // LOCK
        if (subcommand === 'lock') {

            try {

                await channel.permissionOverwrites.edit(

                    interaction.guild.roles.everyone,

                    {
                        SendMessages: false
                    }
                );

            } catch (error) {

                console.error(`Impossible de verrouiller le salon ${channel.id} :`, error);

                return interaction.reply({

                    content:
                        '❌ Impossible de verrouiller ce salon.',

                    ephemeral: true
                });
            }

            await interaction.reply({

                content:
                    '🔒 Salon verrouillé.'
            });

            // LOG
            await envoyerLog(

                interaction.client,

                interaction.guild.id,

                {
                    type: 'serveur',

                    titre:
                        '🔒 Salon verrouillé',

                    description:
`📍 Salon :
${channel}

🛡️ Modérateur :
${interaction.user}`,

                    couleur: 0xED4245,

                    auteur: interaction.user
                }
            );

            return;
        }

        // UNLOCK
        if (subcommand === 'unlock') {

            try {

                await channel.permissionOverwrites.edit(

                    interaction.guild.roles.everyone,

                    {
                        SendMessages: null
                    }
                );

            } catch (error) {

                console.error(`Impossible de déverrouiller le salon ${channel.id} :`, error);

                return interaction.reply({

                    content:
                        '❌ Impossible de déverrouiller ce salon.',

                    ephemeral: true
                });
            }

            await interaction.reply({

                content:
                    '🔓 Salon déverrouillé.'
            });

            // LOG
            await envoyerLog(

                interaction.client,

                interaction.guild.id,

                {
                    type: 'serveur',

                    titre:
                        '🔓 Salon déverrouillé',

                    description:
`📍 Salon :
${channel}

🛡️ Modérateur :
${interaction.user}`,

                    couleur: 0x57F287,

                    auteur: interaction.user
                }
            );

            return;
        }

        // SLOWMODE
        if (subcommand === 'slowmode') {

            const dureeInput =
                interaction.options.getString(
                    'duree'
                );

            const duree =
                convertirTemps(
                    dureeInput
                );

            if (duree === null) {

                return interaction.reply({

                    content:
                        '❌ Format invalide. Exemple : 10s, 5m, 1h',

                    ephemeral: true
                });
            }

            // MAX DISCORD
            if (duree > 21600) {

                return interaction.reply({

                    content:
                        '❌ Le slowmode maximum est de 6 heures.',

                    ephemeral: true
                });
            }

            try {

                await channel.setRateLimitPerUser(
                    duree
                );

            } catch (error) {

                console.error(`Impossible de modifier le slowmode du salon ${channel.id} :`, error);

                return interaction.reply({

                    content:
                        '❌ Impossible de modifier le slowmode.',

                    ephemeral: true
                });
            }

            await interaction.reply({

                content:
`🐌 Slowmode défini sur :
${dureeInput}`
            });

            // LOG
            await envoyerLog(

                interaction.client,

                interaction.guild.id,

                {
                    type: 'serveur',

                    titre:
                        '🐌 Slowmode modifié',

                    description:
`📍 Salon :
${channel}

🛡️ Modérateur :
${interaction.user}

⏱️ Slowmode :
${dureeInput}`,

                    couleur: 0x5865F2,

                    auteur: interaction.user
                }
            );
        }
    }
};

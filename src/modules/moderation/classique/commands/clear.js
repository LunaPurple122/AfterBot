const {
    SlashCommandBuilder,
    PermissionFlagsBits
} = require('discord.js');

const { envoyerLog } =
    require('../../../../core/logger');

module.exports = {

    data: new SlashCommandBuilder()

        .setName('clear')

        .setDescription(
            'Supprimer des messages.'
        )

        .addIntegerOption(option =>
            option

                .setName('nombre')

                .setDescription(
                    'Nombre de messages'
                )

                .setRequired(false)

                .setMinValue(1)
        )

        .addUserOption(option =>
            option

                .setName('membre')

                .setDescription(
                    'Membre ciblé'
                )

                .setRequired(false)
        )

        .addBooleanOption(option =>
            option

                .setName('all')

                .setDescription(
                    'Supprimer tous les messages du membre sur le serveur'
                )

                .setRequired(false)
        )

        .setDefaultMemberPermissions(
            PermissionFlagsBits.ManageMessages
        ),

    async execute(interaction) {

        await interaction.deferReply({
            ephemeral: true
        });

        const nombre =
            interaction.options.getInteger(
                'nombre'
            ) || 999999;

        const membre =
            interaction.options.getMember(
                'membre'
            );

        const all =
            interaction.options.getBoolean(
                'all'
            ) || false;

        let totalSupprime = 0;

        // ALL SERVER MEMBER
        if (all && membre) {

            for (
                const channel
                of interaction.guild.channels.cache.values()
            ) {

                if (!channel.isTextBased()) continue;

                try {

                    let fetched;

                    do {

                        fetched =
                            await channel.messages.fetch({
                                limit: 100
                            });

                        const messages =
                            fetched.filter(
                                msg =>
                                    msg.author.id ===
                                    membre.id
                            );

                        for (
                            const msg
                            of messages.values()
                        ) {

                            try {

                                await msg.delete();

                                totalSupprime++;

                            } catch {}
                        }

                    } while (
                        fetched.size >= 100
                    );

                } catch {}
            }

            await interaction.editReply({

                content:
`✅ Messages supprimés sur tout le serveur.

👤 Membre :
${membre}

🗑️ Messages supprimés :
${totalSupprime}`
            });

            // LOG
            await envoyerLog(

                interaction.client,

                interaction.guild.id,

                {

                    titre:
                        '🧹 Clear global membre',

                    description:
`🛡️ Modérateur :
${interaction.user}

👤 Membre ciblé :
${membre}

🗑️ Messages supprimés :
${totalSupprime}`,

                    couleur: 0x5865F2,

                    auteur: interaction.user
                }
            );

            return;
        }

        // CLEAR CHANNEL
        let restant = nombre;

        while (restant > 0) {

            const limite =
                restant > 100
                    ? 100
                    : restant;

            const fetched =
                await interaction.channel.messages.fetch({
                    limit: limite
                });

            if (fetched.size === 0) break;

            let messages = fetched;

            // FILTRE MEMBRE
            if (membre) {

                messages =
                    fetched.filter(
                        msg =>
                            msg.author.id ===
                            membre.id
                    );
            }

            // MOINS DE 14 JOURS
            const recents =
                messages.filter(msg => {

                    return (
                        Date.now() -
                        msg.createdTimestamp
                    ) < 14 * 24 * 60 * 60 * 1000;

                });

            if (recents.size === 0) break;

            try {

                await interaction.channel.bulkDelete(
                    recents,
                    true
                );

                totalSupprime +=
                    recents.size;

            } catch {}

            restant -= fetched.size;

            if (fetched.size < limite) break;
        }

        await interaction.editReply({

            content:
`✅ Messages supprimés.

🗑️ Total :
${totalSupprime}`
        });

        // LOG
        await envoyerLog(

            interaction.client,

            interaction.guild.id,

            {

                titre: '🧹 Clear',

                description:
`🛡️ Modérateur :
${interaction.user}

📍 Salon :
${interaction.channel}

👤 Membre ciblé :
${membre || 'Aucun'}

🗑️ Messages supprimés :
${totalSupprime}`,

                couleur: 0x5865F2,

                auteur: interaction.user
            }
        );
    }
};
const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');

const { pool } =
    require('../../../database/db');

module.exports = {

    data: new SlashCommandBuilder()

        .setName('ticketpanel')

        .setDescription(
            'Envoyer le panel ticket.'
        )

        .setDefaultMemberPermissions(
            PermissionFlagsBits.Administrator
        ),

    async execute(interaction) {

        const result =
            await pool.query(

                `
                SELECT *
                FROM ticket_config
                WHERE serveur_id = $1
                `,

                [
                    interaction.guild.id
                ]
            );

        const config =
            result.rows[0];

        if (!config) {

            return interaction.reply({

                content:
                    '❌ Le système ticket n’est pas configuré.',

                ephemeral: true
            });
        }

        const panelChannel =
            interaction.guild.channels.cache.get(
                config.panel_channel_id
            );

        if (!panelChannel) {

            return interaction.reply({

                content:
                    '❌ Salon panel introuvable.',

                ephemeral: true
            });
        }

        const embed =
            new EmbedBuilder()

                .setColor(0x5865F2)

                .setTitle(
                    "🎫 Support L'Antre des Gamers"
                )

                .setDescription(
`Besoin d’aide ?

Clique sur le bouton ci-dessous pour ouvrir un ticket privé avec le staff.

🛡️ Un membre de l’équipe prendra en charge ton problème dès que possible.`
                );

        const row =
            new ActionRowBuilder()

                .addComponents(

                    new ButtonBuilder()

                        .setCustomId(
                            'create_ticket'
                        )

                        .setLabel(
                            'Créer un ticket'
                        )

                        .setEmoji(
                            '🎫'
                        )

                        .setStyle(
                            ButtonStyle.Primary
                        )
                );

        await panelChannel.send({

            embeds: [embed],

            components: [row]
        });

        await interaction.reply({

            content:
                '✅ Panel ticket envoyé.',

            ephemeral: true
        });
    }
};
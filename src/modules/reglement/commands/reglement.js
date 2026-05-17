const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');

module.exports = {

    data: new SlashCommandBuilder()

        .setName('reglement')

        .setDescription(
            'Gestion du règlement.'
        )

        .addSubcommand(subcommand =>
            subcommand

                .setName('envoyer')

                .setDescription(
                    'Envoyer le règlement.'
                )
        )

        .setDefaultMemberPermissions(
            PermissionFlagsBits.Administrator
        ),

    async execute(interaction) {

        const subcommand =
            interaction.options.getSubcommand();

        if (subcommand === 'envoyer') {

            const embed =
                new EmbedBuilder()

                    .setColor(0x5865F2)

                    .setTitle(
                        '📜 Règlement'
                    )

                    .setDescription(
`Bienvenue sur AfterStation 🌃

Avant d’accéder au serveur :

merci de lire et accepter le règlement.

━━━━━━━━━━━━━━

✅ Respect obligatoire
✅ Pas de spam
✅ Pas de contenu illégal
✅ Pas de raid
✅ Pas de harcèlement

━━━━━━━━━━━━━━

Clique sur le bouton ci-dessous
pour accepter le règlement.`
                    )

                    .setFooter({
                        text:
                            'AfterStation'
                    });

            const row =
                new ActionRowBuilder()

                    .addComponents(

                        new ButtonBuilder()

                            .setCustomId(
                                'accepter_reglement'
                            )

                            .setLabel(
                                'Accepter le règlement'
                            )

                            .setEmoji('✅')

                            .setStyle(
                                ButtonStyle.Success
                            )
                    );

            await interaction.channel.send({

                embeds: [embed],

                components: [row]
            });

            return interaction.reply({

                content:
                    '✅ Règlement envoyé.',

                ephemeral: true
            });
        }
    }
};
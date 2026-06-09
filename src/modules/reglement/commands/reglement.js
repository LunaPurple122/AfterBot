const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} = require('discord.js');

const { pool } =
    require('../../../database/db');

const MAX_REGLEMENT_LENGTH = 4000;

module.exports = {

    data: new SlashCommandBuilder()

        .setName('reglement')

        .setDescription(
            'Gestion du reglement.'
        )

        .addSubcommand(subcommand =>
            subcommand

                .setName('envoyer')

                .setDescription(
                    'Envoyer le reglement.'
                )
        )

        .addSubcommand(subcommand =>
            subcommand

                .setName('configurer')

                .setDescription(
                    'Configurer le texte du reglement.'
                )
        )

        .setDefaultMemberPermissions(
            PermissionFlagsBits.Administrator
        ),

    async execute(interaction) {

        const serverName =
            interaction.guild?.name || 'le serveur';

        const subcommand =
            interaction.options.getSubcommand();

        if (subcommand === 'configurer') {

            const result =
                await pool.query(
                    `SELECT texte_reglement
                    FROM serveurs
                    WHERE serveur_id = $1`,
                    [interaction.guild.id]
                );

            const texteReglement =
                result.rows[0]?.texte_reglement || '';

            const modal =
                new ModalBuilder()
                    .setCustomId(
                        `reglement_configurer:${interaction.user.id}`
                    )
                    .setTitle(
                        'Texte du reglement'
                    );

            const texteInput =
                new TextInputBuilder()
                    .setCustomId('texte_reglement')
                    .setLabel('Texte du reglement')
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder(
                        'Colle ou ecris le reglement ici...'
                    )
                    .setRequired(true)
                    .setMaxLength(MAX_REGLEMENT_LENGTH);

            if (texteReglement) {
                texteInput.setValue(
                    texteReglement.slice(
                        0,
                        MAX_REGLEMENT_LENGTH
                    )
                );
            }

            const row =
                new ActionRowBuilder()
                    .addComponents(texteInput);

            modal.addComponents(row);

            return interaction.showModal(modal);
        }

        if (subcommand === 'envoyer') {

            const result =
                await pool.query(
                    `SELECT texte_reglement
                    FROM serveurs
                    WHERE serveur_id = $1`,
                    [interaction.guild.id]
                );

            const texteReglement =
                result.rows[0]?.texte_reglement?.trim();

            if (!texteReglement) {
                return interaction.reply({

                    content:
                        'Aucun texte de reglement configure. Utilise `/reglement configurer` avant de l envoyer.',

                    ephemeral: true
                });
            }

            const embed =
                new EmbedBuilder()

                    .setColor(0x5865F2)

                    .setTitle(
                        `Bienvenue sur ${serverName}`
                    )

                    .setDescription(
                        texteReglement
                    )

                    .setFooter({
                        text:
                            serverName
                    });

            const row =
                new ActionRowBuilder()

                    .addComponents(

                        new ButtonBuilder()

                            .setCustomId(
                                'accepter_reglement'
                            )

                            .setLabel(
                                'Accepter le reglement'
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
                    'Reglement envoye.',

                ephemeral: true
            });
        }
    }
};

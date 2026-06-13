const {
    ActionRowBuilder,
    MessageFlags,
    ModalBuilder,
    SlashCommandBuilder,
    TextInputBuilder,
    TextInputStyle
} = require('discord.js');

const AUTHORIZED_USER_ID = '987688776027471933';
const CUSTOM_ID_PREFIX = 'broadcast_create:';
const MAX_TITLE_LENGTH = 256;
const MAX_MESSAGE_LENGTH = 4000;

function buildBroadcastModal(userId) {
    const customId =
        `${CUSTOM_ID_PREFIX}${userId}:${Date.now()}`;

    return new ModalBuilder()
        .setCustomId(customId)
        .setTitle('Broadcast global')
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('title')
                    .setLabel('Titre du broadcast')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
                    .setMaxLength(MAX_TITLE_LENGTH)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('message')
                    .setLabel('Message du broadcast')
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(true)
                    .setMaxLength(MAX_MESSAGE_LENGTH)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('send_to_logs')
                    .setLabel('Salons logs ? oui/non')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(false)
                    .setMaxLength(3)
                    .setPlaceholder('oui')
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('send_to_owners')
                    .setLabel('MP proprietaires ? oui/non')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(false)
                    .setMaxLength(3)
                    .setPlaceholder('oui')
            )
        );
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('broadcast')
        .setDescription('Creer un broadcast global AfterBot.'),

    async execute(interaction) {
        if (interaction.user.id !== AUTHORIZED_USER_ID) {
            return interaction.reply({
                content:
                    '❌ Tu n’es pas autorisé à utiliser cette commande.',
                flags:
                    MessageFlags.Ephemeral
            });
        }

        return interaction.showModal(
            buildBroadcastModal(interaction.user.id)
        );
    }
};

const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder
} = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('chat')
        .setDescription('Faire parler le bot dans un salon.')
        .addChannelOption(option =>
            option
                .setName('channel')
                .setDescription('Salon cible')
                .setRequired(true)
                .addChannelTypes(
                    ChannelType.GuildText,
                    ChannelType.GuildAnnouncement
                )
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const channel = interaction.options.getChannel('channel');

        const modal = new ModalBuilder()
            .setCustomId(`chat_modal_${channel.id}`)
            .setTitle('Message du bot');

        const messageInput = new TextInputBuilder()
            .setCustomId('message')
            .setLabel('Message à envoyer')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Écris ton message ici...')
            .setRequired(true)
            .setMaxLength(2000);

        const row = new ActionRowBuilder().addComponents(messageInput);

        modal.addComponents(row);

        await interaction.showModal(modal);
    }
};
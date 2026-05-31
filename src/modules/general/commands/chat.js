const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType
} = require('discord.js');

module.exports = {

    data: new SlashCommandBuilder()

        .setName('chat')

        .setDescription('Faire parler le bot dans un salon.')

        .addChannelOption(option =>
            option
                .setName('channel')
                .setDescription('Salon où envoyer le message.')
                .setRequired(true)
                .addChannelTypes(
                    ChannelType.GuildText,
                    ChannelType.GuildAnnouncement
                )
        )

        .addStringOption(option =>
            option
                .setName('message')
                .setDescription('Message à envoyer.')
                .setRequired(true)
        )

        .setDefaultMemberPermissions(
            PermissionFlagsBits.Administrator
        ),

    async execute(interaction) {

        const channel =
            interaction.options.getChannel('channel');

        let message =
            interaction.options.getString('message');

        message =
            message.replace(/\\n/g, '\n');

        if (!channel.isTextBased()) {
            return interaction.reply({
                content: '❌ Ce salon ne peut pas recevoir de message.',
                ephemeral: true
            });
        }

        await channel.send({
            content: message,
            allowedMentions: {
                parse: ['users', 'roles', 'everyone']
            }
        });

        await interaction.reply({
            content: `✅ Message envoyé dans ${channel}.`,
            ephemeral: true
        });
    }
};
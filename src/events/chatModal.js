const {
    Events,
    PermissionFlagsBits
} = require('discord.js');

module.exports = {

    chatModalEvent: {

        name: Events.InteractionCreate,

        async execute(interaction) {

            if (!interaction.isModalSubmit()) return;

            if (!interaction.customId.startsWith('chat_modal_')) return;

            try {

                if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                    return interaction.reply({
                        content: '❌ Tu n’as pas la permission d’utiliser ça.',
                        ephemeral: true
                    });
                }

                const channelId =
                    interaction.customId.replace('chat_modal_', '');

                const channel =
                    interaction.guild.channels.cache.get(channelId);

                if (!channel || !channel.isTextBased()) {
                    return interaction.reply({
                        content: '❌ Salon introuvable ou invalide.',
                        ephemeral: true
                    });
                }

                const message =
                    interaction.fields.getTextInputValue('message');

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

            } catch (error) {

                console.error('Erreur chat modal :', error);

                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({
                        content: '❌ Une erreur est survenue pendant l’envoi du message.',
                        ephemeral: true
                    });
                }
            }
        }
    }
};
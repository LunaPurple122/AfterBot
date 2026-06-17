const { Events } = require('discord.js');

const {
    getOpenRequestByChannel,
    markFirstMessageAndAlert
} = require('../services/rodService');

module.exports = {
    name: Events.MessageCreate,

    async execute(message) {
        try {
            if (!message.guild || message.author.bot) return;

            const request =
                await getOpenRequestByChannel(
                    message.guild.id,
                    message.channel.id
                );

            if (!request) return;

            if (request.request_channel_id !== message.channel.id) {
                return;
            }

            if (request.requester_user_id !== message.author.id) {
                return;
            }

            if (request.first_message_received) {
                return;
            }

            await markFirstMessageAndAlert(
                message,
                request
            );

        } catch (error) {
            console.error(
                'Erreur event ROD messageCreate :',
                error
            );
        }
    }
};

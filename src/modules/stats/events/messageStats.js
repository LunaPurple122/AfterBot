const { Events } =
    require('discord.js');

const {
    incrementMessageCount
} = require('../services/statsService');

const {
    isStatsEnabled
} = require('../services/statsConfigService');

module.exports = {
    messageStatsEvent: {
        name: Events.MessageCreate,

        async execute(message) {
            if (!message.guild) return;
            if (message.author.bot) return;

            try {
                if (!await isStatsEnabled(message.guild.id)) {
                    return;
                }

                await incrementMessageCount(
                    message.guild.id,
                    message.author.id
                );
            } catch (error) {
                console.error(
                    `Erreur stats messages ${message.guild.id}/${message.author.id}:`,
                    error
                );
            }
        }
    }
};

const { Events } = require('discord.js');
const { envoyerLog } = require('../core/logger');

module.exports = {

    messageDeleteEvent: {

        name: Events.MessageDelete,

        async execute(message) {

            if (!message.guild) return;

            if (message.partial) {
                try {
                    await message.fetch();
                } catch {
                    return;
                }
            }

            if (message.author?.bot) return;

            await envoyerLog(message.client, message.guild.id, {

                titre: '🗑️ Message supprimé',

                description:
`👤 Auteur : ${message.author}

📍 Salon : ${message.channel}

💬 Contenu :
${message.content || '*Aucun contenu*'}`,

                couleur: 0xff0000,

                auteur: message.author
            });
        }
    }
};
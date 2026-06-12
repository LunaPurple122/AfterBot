const { Events } = require('discord.js');
const { envoyerLog } = require('../core/logger');

module.exports = {
    name: Events.MessageUpdate,

    async execute(oldMessage, newMessage) {

        if (!oldMessage.guild) return;

        if (oldMessage.partial) {
            try {
                await oldMessage.fetch();
            } catch (error) {
                console.error('Impossible de récupérer l’ancien message partiel :', error);
                return;
            }
        }

        if (newMessage.partial) {
            try {
                await newMessage.fetch();
            } catch (error) {
                console.error('Impossible de récupérer le nouveau message partiel :', error);
                return;
            }
        }

        if (oldMessage.author?.bot) return;

        if (oldMessage.content === newMessage.content) return;

        await envoyerLog(oldMessage.client, oldMessage.guild.id, {
            type: 'msg_mod',

            titre: '✏️ Message modifié',

            description:
`👤 Auteur : ${oldMessage.author}

📍 Salon : ${oldMessage.channel}

📝 Avant :
${oldMessage.content || '*Aucun contenu*'}

📝 Après :
${newMessage.content || '*Aucun contenu*'}`,

            couleur: 0xffaa00,

            auteur: oldMessage.author
        });
    }
};

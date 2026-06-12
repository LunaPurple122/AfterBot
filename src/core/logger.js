const { EmbedBuilder } = require('discord.js');
const { LOG_TYPES } = require('./logTypes');
const { sendToLogChannel } = require('./logChannelService');

async function envoyerLog(client, serveurId, options) {

    try {

        const embed = new EmbedBuilder()
            .setTitle(options.titre || 'Log')
            .setDescription(options.description || 'Aucune description')
            .setColor(options.couleur || 0x5865F2)
            .setTimestamp();

        if (options.auteur) {
            embed.setAuthor({
                name: options.auteur.tag,
                iconURL: options.auteur.displayAvatarURL()
            });
        }

        await sendToLogChannel(
            client,
            serveurId,
            options.type || options.logType || LOG_TYPES.SERVEUR,
            {
                embeds: [embed]
            }
        );

    } catch (error) {
        console.error('❌ Erreur logger :', error);
    }
}

async function envoyerLogMessage(client, serveurId, logType, payload) {
    try {
        return await sendToLogChannel(
            client,
            serveurId,
            logType,
            payload
        );

    } catch (error) {
        console.error('❌ Erreur logger :', error);
        return null;
    }
}

module.exports = {
    envoyerLog,
    envoyerLogMessage
};

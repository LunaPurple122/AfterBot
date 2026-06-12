const { Events } = require('discord.js');
const { envoyerLog } = require('../core/logger');

const VALEUR_INCONNUE = {
    auteur: 'Auteur inconnu',
    contenu: 'Contenu indisponible',
    salon: 'Salon inconnu'
};

function formaterAuteur(author) {
    if (!author) return VALEUR_INCONNUE.auteur;

    const identite = author.tag || author.username || author.id || VALEUR_INCONNUE.auteur;
    return author.id ? `${author} (${identite})` : identite;
}

function formaterSalon(channel) {
    if (!channel) return VALEUR_INCONNUE.salon;

    const nom = channel.name ? `#${channel.name}` : channel.id;
    return channel.id ? `${channel} (${nom})` : nom || VALEUR_INCONNUE.salon;
}

function formaterContenu(content) {
    if (typeof content !== 'string' || content.trim().length === 0) {
        return VALEUR_INCONNUE.contenu;
    }

    return content;
}

function formaterPiecesJointes(attachments) {
    if (!attachments || attachments.size === 0) {
        return 'Aucune pièce jointe connue';
    }

    const fichiers = [...attachments.values()]
        .map((attachment) => {
            const nom = attachment.name || 'Fichier sans nom';
            return attachment.url ? `${nom} : ${attachment.url}` : nom;
        });

    return fichiers.join('\n');
}

module.exports = {

    messageDeleteEvent: {

        name: Events.MessageDelete,

        async execute(message) {
            try {
                if (!message?.guild) return;

                /*
                 * Ne jamais appeler message.fetch() ici.
                 * Sur l'événement MessageDelete, Discord a déjà supprimé la ressource :
                 * si le message est partiel ou absent du cache, l'API répond souvent 10008
                 * "Unknown Message". On log donc uniquement les données encore disponibles.
                 */
                if (message.partial) {
                    console.warn(
                        `[messageDelete] Message supprimé non récupérable (partiel) : ${message.id || 'ID inconnu'}`
                    );
                }

                const author = message.author || null;

                if (author?.bot) return;

                const auteur = formaterAuteur(author);
                const salon = formaterSalon(message.channel);
                const contenu = formaterContenu(message.content);
                const piecesJointes = formaterPiecesJointes(message.attachments);

                if (!author || !message.content || !message.channel) {
                    console.warn(
                        `[messageDelete] Données incomplètes pour le message supprimé ${message.id || 'ID inconnu'} ` +
                        `(auteur: ${author ? 'ok' : 'absent'}, contenu: ${message.content ? 'ok' : 'absent'}, salon: ${message.channel ? 'ok' : 'absent'}).`
                    );
                }

                await envoyerLog(message.client, message.guild.id, {
                    type: 'msg_sup',

                    titre: '🗑️ Message supprimé',

                    description:
`👤 Auteur : ${auteur}

📍 Salon : ${salon}

🆔 Message : ${message.id || 'ID inconnu'}

💬 Contenu :
${contenu}

📎 Pièces jointes :
${piecesJointes}`,

                    couleur: 0xff0000,

                    auteur: author || undefined
                });

            } catch (error) {
                console.error(
                    `[messageDelete] Erreur ignorée pendant le traitement du message supprimé ${message?.id || 'ID inconnu'} :`,
                    error
                );
            }
        }
    }
};

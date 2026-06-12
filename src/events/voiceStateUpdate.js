const { Events } = require('discord.js');
const { envoyerLog } = require('../core/logger');

module.exports = {

    voiceStateUpdateEvent: {

        name: Events.VoiceStateUpdate,

        async execute(oldState, newState) {

            const member =
                newState.member || oldState.member;

            if (!member || member.user.bot) return;

            // CONNEXION
            if (!oldState.channel && newState.channel) {

                await envoyerLog(member.client, member.guild.id, {
                    type: 'voc',

                    titre: '🎤 Connexion vocale',

                    description:
`👤 Membre : ${member.user}

🔊 Salon rejoint :
${newState.channel}`,

                    couleur: 0x57F287,

                    auteur: member.user
                });
            }

            // DÉCONNEXION
            else if (oldState.channel && !newState.channel) {

                await envoyerLog(member.client, member.guild.id, {
                    type: 'voc',

                    titre: '🚪 Déconnexion vocale',

                    description:
`👤 Membre : ${member.user}

🔊 Salon quitté :
${oldState.channel}`,

                    couleur: 0xED4245,

                    auteur: member.user
                });
            }

            // DÉPLACEMENT
            else if (
                oldState.channel &&
                newState.channel &&
                oldState.channel.id !== newState.channel.id
            ) {

                await envoyerLog(member.client, member.guild.id, {
                    type: 'voc',

                    titre: '🔄 Déplacement vocal',

                    description:
`👤 Membre : ${member.user}

📤 Ancien salon :
${oldState.channel}

📥 Nouveau salon :
${newState.channel}`,

                    couleur: 0xFEE75C,

                    auteur: member.user
                });
            }
        }
    }
};

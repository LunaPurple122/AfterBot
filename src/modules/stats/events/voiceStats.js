const { Events } =
    require('discord.js');

const {
    handleVoiceStateUpdate
} = require('../services/voiceSessionService');

module.exports = {
    voiceStatsEvent: {
        name: Events.VoiceStateUpdate,

        async execute(oldState, newState) {
            try {
                await handleVoiceStateUpdate(
                    oldState,
                    newState
                );
            } catch (error) {
                const guildId =
                    newState.guild?.id || oldState.guild?.id;

                const userId =
                    newState.id || oldState.id;

                console.error(
                    `Erreur stats vocales ${guildId}/${userId}:`,
                    error
                );
            }
        }
    }
};

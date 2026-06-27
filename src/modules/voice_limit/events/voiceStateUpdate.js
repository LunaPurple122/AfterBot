const {
    Events
} = require('discord.js');

const {
    cleanupDeletedChannel,
    handleVoiceStateUpdate,
    isManagedVoiceChannel,
    rebuildOccupiedChannels
} = require('../manager/VoiceLimitManager');

module.exports = {
    voiceLimitReady: {
        name: Events.ClientReady,
        once: true,

        async execute(client) {
            await rebuildOccupiedChannels(client);
        }
    },

    voiceLimitStateUpdate: {
        name: Events.VoiceStateUpdate,

        async execute(oldState, newState) {
            await handleVoiceStateUpdate(
                oldState,
                newState
            );
        }
    },

    voiceLimitChannelDelete: {
        name: Events.ChannelDelete,

        async execute(channel) {
            if (isManagedVoiceChannel(channel)) {
                cleanupDeletedChannel(channel);
            }
        }
    }
};

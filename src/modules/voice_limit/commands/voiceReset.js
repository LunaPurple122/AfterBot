const {
    getCurrentVoiceChannel,
    isLeader,
    resetChannel
} = require('../manager/VoiceLimitManager');

const {
    safeReply
} = require('../../../core/interactions');

async function handleVoiceReset(interaction) {
    const channel =
        getCurrentVoiceChannel(interaction.member);

    if (!channel) {
        return safeReply(interaction, {
            content: '❌ Tu dois être connecté à un salon vocal.',
            ephemeral: true
        });
    }

    if (!isLeader(channel, interaction.user.id)) {
        return safeReply(interaction, {
            content: '❌ Seul le premier membre arrivé peut modifier ce salon.',
            ephemeral: true
        });
    }

    try {
        await resetChannel(
            channel,
            interaction.member
        );

    } catch (error) {
        if (error.code === 'MISSING_PERMISSION') {
            return safeReply(interaction, {
                content: '❌ Je n’ai pas la permission de modifier ce salon.',
                ephemeral: true
            });
        }

        console.error(
            'Erreur voice reset:',
            error
        );

        return safeReply(interaction, {
            content: '❌ Une erreur est survenue pendant la réinitialisation du salon.',
            ephemeral: true
        });
    }

    return safeReply(interaction, {
        content: '✅ Les paramètres temporaires du salon ont été réinitialisés.',
        ephemeral: true
    });
}

module.exports = {
    handleVoiceReset
};

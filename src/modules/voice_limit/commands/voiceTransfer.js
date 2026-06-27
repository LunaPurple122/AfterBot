const {
    getCurrentVoiceChannel,
    isLeader,
    transferLeadership
} = require('../manager/VoiceLimitManager');

const {
    safeReply
} = require('../../../core/interactions');

async function handleVoiceTransfer(interaction) {
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

    const target =
        interaction.options.getMember('membre');

    if (
        !target ||
        target.user?.bot ||
        target.voice?.channelId !== channel.id
    ) {
        return safeReply(interaction, {
            content: '❌ Le membre doit être dans le même vocal et ne peut pas être un bot.',
            ephemeral: true
        });
    }

    await transferLeadership(
        channel,
        interaction.member,
        target
    );

    return safeReply(interaction, {
        content: `✅ Responsabilité transférée à ${target}.`,
        ephemeral: true
    });
}

module.exports = {
    handleVoiceTransfer
};

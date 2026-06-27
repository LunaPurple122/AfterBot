const { EmbedBuilder } =
    require('discord.js');

const {
    buildInfo,
    formatLimit,
    getCurrentVoiceChannel
} = require('../manager/VoiceLimitManager');

const {
    safeReply
} = require('../../../core/interactions');

async function handleVoiceInfo(interaction) {
    const channel =
        getCurrentVoiceChannel(interaction.member);

    if (!channel) {
        return safeReply(interaction, {
            content: '❌ Tu dois être connecté à un salon vocal.',
            ephemeral: true
        });
    }

    const info =
        buildInfo(channel);

    const leader =
        info.leaderId
            ? `<@${info.leaderId}>`
            : 'Aucun';

    const limitText =
        info.currentLimit > 0
            ? `${info.memberCount} / ${info.currentLimit}`
            : `${info.memberCount} / ∞`;

    const description = [
        `👑 Responsable : ${leader}`,
        `👥 Occupation : ${limitText}`,
        `🔢 Limite actuelle : ${formatLimit(info.currentLimit)}`,
        `📌 Limite d'origine : ${formatLimit(info.originalLimit)}`,
        '',
        '📜 Ordre d’arrivée',
        info.orderLines.length > 0
            ? info.orderLines.join('\n')
            : 'Aucun membre présent.'
    ];

    if (info.reconstructed) {
        description.push(
            '',
            'Note : ordre reconstruit après redémarrage selon l’ordre renvoyé par Discord.'
        );
    }

    const embed =
        new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle(`Salon vocal - ${channel.name}`)
            .setDescription(description.join('\n'));

    return safeReply(interaction, {
        embeds: [embed],
        ephemeral: true
    });
}

module.exports = {
    handleVoiceInfo
};

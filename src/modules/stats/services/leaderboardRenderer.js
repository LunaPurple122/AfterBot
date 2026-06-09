const {
    EmbedBuilder
} = require('discord.js');

const {
    formatDuration
} = require('./durationService');

const {
    getMessageLeaderboard,
    getVoiceLeaderboard
} = require('./statsService');

const medals = [
    '🥇',
    '🥈',
    '🥉'
];

function rankLabel(index) {
    return medals[index] || `#${index + 1}`;
}

function formatNumber(value) {
    return Number(value || 0).toLocaleString('fr-FR');
}

function renderVoiceRows(rows) {
    if (rows.length === 0) {
        return 'Aucune statistique vocale disponible.';
    }

    return rows.map((row, index) =>
        `${rankLabel(index)} <@${row.user_id}> — ${formatDuration(row.voice_seconds)}`
    ).join('\n');
}

function renderMessageRows(rows) {
    if (rows.length === 0) {
        return 'Aucune statistique messages disponible.';
    }

    return rows.map((row, index) =>
        `${rankLabel(index)} <@${row.user_id}> — ${formatNumber(row.message_count)} messages`
    ).join('\n');
}

async function buildLeaderboardEmbeds(guildId, guildName) {
    const voiceRows =
        await getVoiceLeaderboard(guildId, 10);

    const messageRows =
        await getMessageLeaderboard(guildId, 10);

    return [
        new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle('🏆 Classement Vocal')
            .setDescription(renderVoiceRows(voiceRows))
            .setFooter({
                text: guildName
            })
            .setTimestamp(),

        new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('🏆 Classement Messages')
            .setDescription(renderMessageRows(messageRows))
            .setFooter({
                text: guildName
            })
            .setTimestamp()
    ];
}

module.exports = {
    buildLeaderboardEmbeds,
    formatNumber,
    renderMessageRows,
    renderVoiceRows
};

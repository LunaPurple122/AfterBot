function formatDuration(seconds) {
    const totalSeconds =
        Math.max(0, Math.floor(Number(seconds) || 0));

    const hours =
        Math.floor(totalSeconds / 3600);

    const minutes =
        Math.floor((totalSeconds % 3600) / 60);

    return `${hours}:${String(minutes).padStart(2, '0')}`;
}

function parseDuration(value) {
    const input =
        String(value || '').trim();

    const match =
        input.match(/^(\d+):([0-5]\d)$/);

    if (!match) {
        return null;
    }

    const hours =
        Number(match[1]);

    const minutes =
        Number(match[2]);

    if (!Number.isSafeInteger(hours)) {
        return null;
    }

    return (hours * 3600) + (minutes * 60);
}

module.exports = {
    formatDuration,
    parseDuration
};

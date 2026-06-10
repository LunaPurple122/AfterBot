const {
    safeReply
} = require('./interactions');

function botHasPermission(interaction, permission) {
    const botMember = interaction.guild?.members?.me;

    if (!botMember) return false;

    return botMember.permissions.has(permission);
}

function botHasGuildPermission(guild, permission) {
    const botMember = guild?.members?.me;

    if (!botMember) return false;

    return botMember.permissions.has(permission);
}

async function requireBotPermission(interaction, permission, label) {
    if (botHasPermission(interaction, permission)) return true;

    console.error(
        `Permission bot manquante pour ${interaction.commandName}: ${label}`
    );

    const payload = {
        content:
            `❌ Permission bot manquante : ${label}.`
    };

    await safeReply(interaction, {
        ...payload,
        ephemeral: true
    });

    return false;
}

module.exports = {
    botHasGuildPermission,
    botHasPermission,
    requireBotPermission
};

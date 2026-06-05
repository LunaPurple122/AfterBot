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

    if (interaction.deferred || interaction.replied) {
        await interaction.editReply(payload);
        return false;
    }

    await interaction.reply({
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

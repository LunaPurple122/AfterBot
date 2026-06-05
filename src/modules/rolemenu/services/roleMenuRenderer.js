const {
    ActionRowBuilder,
    EmbedBuilder,
    StringSelectMenuBuilder
} = require('discord.js');

const {
    getRolemenuRoles,
    disableRoleOption
} = require('./roleMenuService');

const DEFAULT_COLOR = 0x5865F2;

function parseEmbedColor(value) {
    if (!value) return DEFAULT_COLOR;

    return parseInt(value, 16);
}

function buildCustomId(rolemenuId) {
    return `rolemenu:${rolemenuId}`;
}

async function buildRolemenuPayload(guild, rolemenu) {
    const options =
        await getRolemenuRoles(rolemenu.id, true);

    const validOptions = [];

    for (const option of options) {
        const role =
            guild.roles.cache.get(option.role_id);

        if (!role) {
            console.error(
                `Rôle supprimé ignoré dans le rolemenu ${rolemenu.id}: ${option.role_id}`
            );

            await disableRoleOption(option.id);
            continue;
        }

        if (role.id === guild.id) {
            console.error(
                `Option @everyone désactivée dans le rolemenu ${rolemenu.id}`
            );

            await disableRoleOption(option.id);
            continue;
        }

        validOptions.push({
            label: option.label.slice(0, 100),
            value: role.id,
            description: option.description
                ? option.description.slice(0, 100)
                : undefined,
            emoji: option.emoji || undefined
        });
    }

    if (validOptions.length === 0) {
        throw new Error('ROLEMENU_NO_OPTIONS');
    }

    if (validOptions.length > 25) {
        throw new Error('ROLEMENU_TOO_MANY_OPTIONS');
    }

    const embed =
        new EmbedBuilder()
            .setTitle(rolemenu.titre)
            .setColor(parseEmbedColor(rolemenu.couleur))
            .setTimestamp();

    if (rolemenu.description) {
        embed.setDescription(rolemenu.description);
    }

    const menu =
        new StringSelectMenuBuilder()
            .setCustomId(buildCustomId(rolemenu.id))
            .setPlaceholder(
                (rolemenu.placeholder || 'Choisis un rôle')
                    .slice(0, 100)
            )
            .setMinValues(1)
            .setMaxValues(1)
            .addOptions(validOptions);

    const row =
        new ActionRowBuilder()
            .addComponents(menu);

    return {
        embeds: [embed],
        components: [row]
    };
}

module.exports = {
    buildCustomId,
    buildRolemenuPayload
};

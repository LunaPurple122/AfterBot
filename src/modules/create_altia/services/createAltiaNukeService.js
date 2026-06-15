const {
    ChannelType
} = require('discord.js');

const { pool } =
    require('../../../database/db');

const DELETE_CHANNEL_TYPES =
    new Set([
        ChannelType.GuildText,
        ChannelType.GuildVoice,
        ChannelType.GuildAnnouncement,
        ChannelType.GuildStageVoice,
        ChannelType.GuildForum,
        ChannelType.GuildMedia
    ].filter(type => type !== undefined));

function canDeleteRole(guild, role) {
    if (!role) return false;
    if (role.id === guild.id) return false;
    if (role.managed) return false;

    const botRole =
        guild.members.me?.roles?.highest;

    if (!botRole) return false;
    if (role.id === botRole.id) return false;

    return role.position < botRole.position;
}

function getDeletableChannels(guild) {
    return [...guild.channels.cache.values()]
        .filter(channel =>
            DELETE_CHANNEL_TYPES.has(channel.type)
        )
        .sort((a, b) =>
            b.position - a.position
        );
}

function getDeletableCategories(guild) {
    return [...guild.channels.cache.values()]
        .filter(channel =>
            channel.type === ChannelType.GuildCategory
        )
        .sort((a, b) =>
            b.position - a.position
        );
}

function getDeletableRoles(guild) {
    return [...guild.roles.cache.values()]
        .filter(role =>
            canDeleteRole(guild, role)
        )
        .sort((a, b) =>
            a.position - b.position
        );
}

function getRequiredCommunityChannelIds(guild) {
    const ids = new Set();
    const hasCommunity =
        guild.features?.includes?.('COMMUNITY');

    if (!hasCommunity) return ids;

    for (const channelId of [
        guild.rulesChannelId,
        guild.publicUpdatesChannelId,
        guild.safetyAlertsChannelId
    ]) {
        if (channelId) {
            ids.add(channelId);
        }
    }

    return ids;
}

function getDiscordErrorCode(error) {
    return error?.code || error?.rawError?.code || null;
}

function getIgnoredReason(error) {
    const code =
        getDiscordErrorCode(error);

    const message =
        String(error?.message || error?.rawError?.message || '');

    if (code === 50074) return 'Discord 50074';
    if (code === 50013 || code === 50001) {
        return 'missing permissions';
    }

    if (
        code === 10003 ||
        message.includes('Unknown Channel')
    ) {
        return 'unknown channel';
    }

    return null;
}

function addIgnoredChannel(ignoredChannels, channel, reason) {
    ignoredChannels.push({
        id:
            channel?.id || 'unknown',
        name:
            channel?.name || 'unknown',
        reason
    });
}

async function recordNukeHistory({
    guildId,
    ownerId,
    deletedChannels,
    deletedCategories,
    deletedRoles
}) {
    await pool.query(`
        INSERT INTO create_nuke_history (
            guild_id,
            owner_id,
            deleted_channels,
            deleted_categories,
            deleted_roles
        )
        VALUES ($1, $2, $3, $4, $5)
    `, [
        guildId,
        ownerId,
        deletedChannels,
        deletedCategories,
        deletedRoles
    ]);
}

function formatNukeProgress({
    deletedRoles,
    deletedChannels,
    deletedCategories,
    ignoredChannels
}) {
    return [
        'Nuke Create Altia en cours...',
        '',
        `OK ${deletedRoles} roles supprimes`,
        `OK ${deletedChannels} salons supprimes`,
        `OK ${deletedCategories} categories supprimees`,
        `SKIP ${ignoredChannels.length} salons ignores`
    ].join('\n');
}

function formatNukeDone({
    deletedRoles,
    deletedChannels,
    deletedCategories,
    ignoredChannels,
    errors
}) {
    return [
        'Reset termine',
        '',
        'Resume :',
        '',
        `- ${deletedRoles} roles supprimes`,
        `- ${deletedChannels} salons supprimes`,
        `- ${deletedCategories} categories supprimees`,
        `- ${ignoredChannels.length} salons ignores`,
        `- ${errors.length} erreurs ignorees`,
        '',
        'Le serveur est maintenant pret pour une nouvelle configuration via :',
        '',
        '/create import',
        '',
        'ou',
        '',
        '/create gpt'
    ].join('\n');
}

async function callProgress(onProgress, message) {
    if (!onProgress) return;

    try {
        await onProgress(message);
    } catch (error) {
        console.error(
            'Create Altia nuke progression ignoree:',
            error
        );
    }
}

async function runCreateAltiaNuke({
    guild,
    ownerId,
    protectedChannelIds = [],
    onProgress
}) {
    const counters = {
        deletedRoles: 0,
        deletedChannels: 0,
        deletedCategories: 0
    };

    const errors = [];
    const ignoredChannels = [];
    const protectedChannels = new Map();
    let operationsSinceProgress = 0;

    for (const channelId of protectedChannelIds) {
        if (channelId) {
            protectedChannels.set(
                channelId,
                'channel d\'interaction'
            );
        }
    }

    for (const channelId of getRequiredCommunityChannelIds(guild)) {
        protectedChannels.set(
            channelId,
            'required community channel'
        );
    }

    const updateProgress = async (force = false) => {
        if (!force && operationsSinceProgress < 5) return;

        operationsSinceProgress = 0;

        await callProgress(
            onProgress,
            formatNukeProgress({
                ...counters,
                ignoredChannels
            })
        );
    };

    await updateProgress(true);

    for (const role of getDeletableRoles(guild)) {
        try {
            await role.delete('Create Altia nuke');
            counters.deletedRoles += 1;
        } catch (error) {
            errors.push(
                `Role ${role.name} (${role.id}) : ${error.message || error}`
            );

            console.error(
                `Create Altia nuke erreur role ${role.id}:`,
                error
            );
        }

        operationsSinceProgress += 1;
        await updateProgress();
    }

    await updateProgress(true);

    for (const channel of getDeletableChannels(guild)) {
        const protectedReason =
            protectedChannels.get(channel.id);

        if (protectedReason) {
            addIgnoredChannel(
                ignoredChannels,
                channel,
                protectedReason
            );

            operationsSinceProgress += 1;
            await updateProgress();
            continue;
        }

        try {
            await channel.delete('Create Altia nuke');
            counters.deletedChannels += 1;
        } catch (error) {
            const ignoredReason =
                getIgnoredReason(error);

            errors.push(
                `Salon ${channel.name} (${channel.id}) : ${error.message || error}`
            );

            if (ignoredReason) {
                addIgnoredChannel(
                    ignoredChannels,
                    channel,
                    ignoredReason
                );
            }

            console.error(
                `Create Altia nuke erreur salon ${channel.id}:`,
                error
            );
        }

        operationsSinceProgress += 1;
        await updateProgress();
    }

    await updateProgress(true);

    for (const category of getDeletableCategories(guild)) {
        const protectedReason =
            protectedChannels.get(category.id);

        if (protectedReason) {
            addIgnoredChannel(
                ignoredChannels,
                category,
                protectedReason
            );

            operationsSinceProgress += 1;
            await updateProgress();
            continue;
        }

        try {
            await category.delete('Create Altia nuke');
            counters.deletedCategories += 1;
        } catch (error) {
            const ignoredReason =
                getIgnoredReason(error);

            errors.push(
                `Categorie ${category.name} (${category.id}) : ${error.message || error}`
            );

            if (ignoredReason) {
                addIgnoredChannel(
                    ignoredChannels,
                    category,
                    ignoredReason
                );
            }

            console.error(
                `Create Altia nuke erreur categorie ${category.id}:`,
                error
            );
        }

        operationsSinceProgress += 1;
        await updateProgress();
    }

    await updateProgress(true);

    try {
        await recordNukeHistory({
            guildId:
                guild.id,
            ownerId,
            deletedChannels:
                counters.deletedChannels,
            deletedCategories:
                counters.deletedCategories,
            deletedRoles:
                counters.deletedRoles
        });
    } catch (error) {
        errors.push(
            `Historique nuke : ${error.message || error}`
        );

        console.error(
            'Create Altia nuke historique ignore:',
            error
        );
    }

    return {
        ...counters,
        errors,
        ignoredChannels,
        message:
            formatNukeDone({
                ...counters,
                ignoredChannels,
                errors
            })
    };
}

module.exports = {
    formatNukeDone,
    formatNukeProgress,
    runCreateAltiaNuke
};

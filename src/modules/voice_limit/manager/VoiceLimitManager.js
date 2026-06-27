const {
    ChannelType,
    PermissionFlagsBits,
    PermissionsBitField
} = require('discord.js');

const { envoyerLog } =
    require('../../../core/logger');

const voiceStates =
    new Map();

const VOICE_CHANNEL_TYPES = new Set([
    ChannelType.GuildVoice,
    ChannelType.GuildStageVoice
]);

function stateKey(guildId, channelId) {
    return `${guildId}:${channelId}`;
}

function getChannelKey(channel) {
    return stateKey(
        channel.guild.id,
        channel.id
    );
}

function isManagedVoiceChannel(channel) {
    return Boolean(
        channel &&
        VOICE_CHANNEL_TYPES.has(channel.type)
    );
}

function getHumanMembers(channel) {
    if (!channel?.members) {
        return [];
    }

    return Array.from(channel.members.values())
        .filter(member => !member.user?.bot);
}

function getOrCreateState(channel) {
    const key =
        getChannelKey(channel);

    if (!voiceStates.has(key)) {
        voiceStates.set(key, {
            guildId: channel.guild.id,
            channelId: channel.id,
            arrivalOrder: [],
            originalLimit: null,
            reconstructed: false
        });
    }

    return voiceStates.get(key);
}

function getState(channel) {
    return voiceStates.get(
        getChannelKey(channel)
    ) || null;
}

function removeUserFromState(channel, userId) {
    const state =
        getState(channel);

    if (!state) {
        return null;
    }

    state.arrivalOrder =
        state.arrivalOrder.filter(id => id !== userId);

    return state;
}

function pruneState(channel) {
    const state =
        getState(channel);

    if (!state) {
        return null;
    }

    const presentIds =
        new Set(
            getHumanMembers(channel)
                .map(member => member.id)
        );

    state.arrivalOrder =
        state.arrivalOrder.filter(id => presentIds.has(id));

    return state;
}

function rebuildQueue(channel, options = {}) {
    const state =
        getOrCreateState(channel);

    state.arrivalOrder =
        getHumanMembers(channel)
            .map(member => member.id);

    state.reconstructed =
        Boolean(options.reconstructed);

    return state;
}

function getLeader(channel) {
    const state =
        pruneState(channel) ||
        rebuildQueue(channel);

    return state.arrivalOrder[0] || null;
}

function isLeader(channel, userId) {
    return getLeader(channel) === userId;
}

function getCurrentVoiceChannel(member) {
    const channel =
        member?.voice?.channel;

    if (!isManagedVoiceChannel(channel)) {
        return null;
    }

    return channel;
}

function getDisplayName(member) {
    return member?.displayName ||
        member?.user?.username ||
        'Utilisateur inconnu';
}

function formatLimit(value) {
    return Number(value || 0) > 0
        ? `${Number(value)}`
        : 'Illimitée';
}

function canEditChannel(channel) {
    const permissions =
        channel?.permissionsFor(channel.guild.members.me);

    return Boolean(
        permissions?.has(PermissionFlagsBits.ManageChannels)
    );
}

function canSendTemporaryMessage(channel) {
    if (!channel?.isTextBased?.()) {
        return false;
    }

    const permissions =
        channel.permissionsFor(channel.guild.members.me);

    return Boolean(
        permissions?.has(PermissionsBitField.Flags.ViewChannel) &&
        permissions?.has(PermissionsBitField.Flags.SendMessages)
    );
}

async function sendTemporaryMessage(channel, content) {
    if (!canSendTemporaryMessage(channel)) {
        return null;
    }

    try {
        const message =
            await channel.send({
                content
            });

        setTimeout(() => {
            message.delete().catch(() => null);
        }, 15000);

        return message;

    } catch (error) {
        console.error(
            `Voice limit: message temporaire impossible dans ${channel.id}:`,
            error.message
        );
        return null;
    }
}

async function logAction(channel, actor, title, description) {
    await envoyerLog(channel.client, channel.guild.id, {
        type: 'voc',
        titre: title,
        description,
        couleur: 0x5865F2,
        auteur: actor.user
    });
}

async function restoreOriginalLimit(channel) {
    const state =
        getState(channel);

    if (!state || state.originalLimit === null) {
        return false;
    }

    if (!canEditChannel(channel)) {
        return false;
    }

    await channel.setUserLimit(
        state.originalLimit,
        'voice_limit: restauration de la limite originale'
    );

    return true;
}

function clearTemporaryLimit(channel) {
    const state =
        getState(channel);

    if (state) {
        state.originalLimit = null;
    }
}

async function setTemporaryLimit(channel, limit, actor) {
    if (!canEditChannel(channel)) {
        const error =
            new Error('Permission ManageChannels manquante.');

        error.code = 'MISSING_PERMISSION';
        throw error;
    }

    const state =
        getOrCreateState(channel);

    if (state.originalLimit === null && limit > 0) {
        state.originalLimit =
            Number(channel.userLimit || 0);
    }

    if (limit === 0) {
        const targetLimit =
            state.originalLimit === null
                ? 0
                : state.originalLimit;

        await channel.setUserLimit(
            targetLimit,
            `voice_limit: limite temporaire retirée par ${actor.user.tag}`
        );

        state.originalLimit = null;

        await sendTemporaryMessage(
            channel,
            `🔊 ${actor} a retiré la limite.`
        );

        await logAction(
            channel,
            actor,
            '🔊 Limite vocale retirée',
            `${actor} a retiré la limite temporaire de ${channel}.`
        );

        return {
            removed: true,
            appliedLimit: targetLimit
        };
    }

    await channel.setUserLimit(
        limit,
        `voice_limit: limite temporaire définie par ${actor.user.tag}`
    );

    await sendTemporaryMessage(
        channel,
        `🔊 ${actor} a limité ce salon à ${limit} participant(s).`
    );

    await logAction(
        channel,
        actor,
        '🔊 Limite vocale modifiée',
        `${actor} a limité ${channel} à ${limit} participant(s).`
    );

    return {
        removed: false,
        appliedLimit: limit
    };
}

async function transferLeadership(channel, actor, targetMember) {
    const state =
        pruneState(channel) ||
        rebuildQueue(channel);

    state.arrivalOrder =
        [
            targetMember.id,
            ...state.arrivalOrder.filter(id => id !== targetMember.id)
        ];

    await sendTemporaryMessage(
        channel,
        `🔊 ${actor} a transféré la responsabilité à ${targetMember}.`
    );

    await logAction(
        channel,
        actor,
        '🔊 Responsabilité vocale transférée',
        `${actor} a transféré la responsabilité de ${channel} à ${targetMember}.`
    );

    return state;
}

async function resetChannel(channel, actor) {
    const existingState =
        getState(channel);

    if (
        existingState &&
        existingState.originalLimit !== null &&
        !canEditChannel(channel)
    ) {
        const error =
            new Error('Permission ManageChannels manquante.');

        error.code = 'MISSING_PERMISSION';
        throw error;
    }

    await restoreOriginalLimit(channel);

    const key =
        getChannelKey(channel);

    voiceStates.delete(key);

    const state =
        rebuildQueue(channel);

    await sendTemporaryMessage(
        channel,
        '🔊 Les paramètres du salon ont été réinitialisés.'
    );

    await logAction(
        channel,
        actor,
        '🔊 Paramètres vocaux réinitialisés',
        `${actor} a réinitialisé les paramètres temporaires de ${channel}.`
    );

    return state;
}

async function cleanupEmptyChannel(channel) {
    const key =
        getChannelKey(channel);

    const state =
        getState(channel);

    if (!state) {
        return;
    }

    if (getHumanMembers(channel).length > 0) {
        return;
    }

    try {
        await restoreOriginalLimit(channel);
    } catch (error) {
        console.error(
            `Voice limit: restauration impossible pour ${channel.id}:`,
            error.message
        );
    }

    voiceStates.delete(key);
}

function cleanupDeletedChannel(channel) {
    if (!channel?.guild) {
        return;
    }

    voiceStates.delete(
        getChannelKey(channel)
    );
}

async function handleVoiceStateUpdate(oldState, newState) {
    const member =
        newState.member || oldState.member;

    if (!member || member.user?.bot) {
        return;
    }

    const oldChannel =
        isManagedVoiceChannel(oldState.channel)
            ? oldState.channel
            : null;

    const newChannel =
        isManagedVoiceChannel(newState.channel)
            ? newState.channel
            : null;

    if (
        oldChannel &&
        (!newChannel || oldChannel.id !== newChannel.id)
    ) {
        removeUserFromState(
            oldChannel,
            member.id
        );

        await cleanupEmptyChannel(oldChannel);
    }

    if (
        newChannel &&
        (!oldChannel || oldChannel.id !== newChannel.id)
    ) {
        const state =
            getOrCreateState(newChannel);

        state.arrivalOrder =
            state.arrivalOrder.filter(id => id !== member.id);

        state.arrivalOrder.push(member.id);

        state.reconstructed = false;
    }
}

async function rebuildOccupiedChannels(client) {
    let rebuilt =
        0;

    for (const guild of client.guilds.cache.values()) {
        for (const channel of guild.channels.cache.values()) {
            if (!isManagedVoiceChannel(channel)) {
                continue;
            }

            if (getHumanMembers(channel).length === 0) {
                continue;
            }

            // Discord ne fournit pas l'ordre réel d'arrivée après un redémarrage.
            // On utilise donc l'ordre des membres renvoyé par le cache Discord.
            rebuildQueue(channel, {
                reconstructed: true
            });

            rebuilt++;
        }
    }

    if (rebuilt > 0) {
        console.log(
            `Voice limit: ${rebuilt} salon(s) occupé(s) reconstruit(s). Ordre réel d'arrivée indisponible après redémarrage.`
        );
    }
}

function buildInfo(channel) {
    const state =
        pruneState(channel) ||
        rebuildQueue(channel);

    const members =
        getHumanMembers(channel);

    const membersById =
        new Map(
            members.map(member => [
                member.id,
                member
            ])
        );

    const leaderId =
        state.arrivalOrder[0] || null;

    const lines =
        state.arrivalOrder.map((userId, index) => {
            const member =
                membersById.get(userId);

            return `${index + 1}. ${getDisplayName(member)}`;
        });

    return {
        leaderId,
        currentLimit: Number(channel.userLimit || 0),
        originalLimit:
            state.originalLimit === null
                ? Number(channel.userLimit || 0)
                : state.originalLimit,
        memberCount: members.length,
        orderLines: lines,
        reconstructed: state.reconstructed
    };
}

module.exports = {
    buildInfo,
    cleanupDeletedChannel,
    cleanupEmptyChannel,
    formatLimit,
    getCurrentVoiceChannel,
    getLeader,
    handleVoiceStateUpdate,
    isLeader,
    isManagedVoiceChannel,
    rebuildOccupiedChannels,
    resetChannel,
    setTemporaryLimit,
    transferLeadership
};

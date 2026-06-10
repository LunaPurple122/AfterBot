const { MessageFlags } = require('discord.js');

function isIgnoredInteractionError(error) {
    const code =
        error?.code ||
        error?.rawError?.code;

    const message =
        String(error?.message || error?.rawError?.message || '');

    return (
        code === 10062 ||
        code === 40060 ||
        message.includes('Unknown interaction') ||
        message.includes('Interaction has already been acknowledged')
    );
}

function logIgnoredInteractionError(interaction, action, error) {
    const name =
        interaction?.commandName ||
        interaction?.customId ||
        interaction?.id ||
        'interaction inconnue';

    console.warn(
        `[interactionCreate] ${action} ignoré pour ${name} : ${error.message}`
    );
}

function normalizeInteractionOptions(options) {
    if (typeof options === 'string') {
        return {
            content: options
        };
    }

    if (
        !options ||
        typeof options !== 'object' ||
        options.ephemeral !== true
    ) {
        return options;
    }

    const normalized = {
        ...options
    };

    delete normalized.ephemeral;

    normalized.flags =
        Number(normalized.flags || 0) |
        MessageFlags.Ephemeral;

    return normalized;
}

function removeReplyOnlyOptions(options) {
    if (!options || typeof options !== 'object') {
        return options;
    }

    const normalized = {
        ...options
    };

    delete normalized.flags;
    delete normalized.ephemeral;

    return normalized;
}

function getOriginal(interaction, methodName) {
    return interaction.__safeOriginalResponses?.[methodName] ||
        interaction[methodName]?.bind(interaction);
}

async function safeReply(interaction, options) {
    if (!interaction) return null;

    patchInteractionResponses(interaction);

    const normalizedOptions =
        normalizeInteractionOptions(options);

    try {
        if (interaction.deferred && !interaction.replied) {
            const editReply =
                getOriginal(interaction, 'editReply');

            return await editReply(
                removeReplyOnlyOptions(normalizedOptions)
            );
        }

        if (interaction.replied) {
            const followUp =
                getOriginal(interaction, 'followUp');

            return await followUp(normalizedOptions);
        }

        const reply =
            getOriginal(interaction, 'reply');

        return await reply(normalizedOptions);

    } catch (error) {
        if (isIgnoredInteractionError(error)) {
            logIgnoredInteractionError(
                interaction,
                'réponse',
                error
            );
            return null;
        }

        throw error;
    }
}

async function safeDeferReply(interaction, options = {}) {
    if (
        !interaction ||
        interaction.deferred ||
        interaction.replied
    ) {
        return true;
    }

    patchInteractionResponses(interaction);

    const deferReply =
        getOriginal(interaction, 'deferReply');

    if (typeof deferReply !== 'function') {
        return false;
    }

    try {
        await deferReply(
            normalizeInteractionOptions({
                flags:
                    MessageFlags.Ephemeral,
                ...options
            })
        );

        return true;

    } catch (error) {
        if (isIgnoredInteractionError(error)) {
            logIgnoredInteractionError(
                interaction,
                'deferReply',
                error
            );
            return false;
        }

        throw error;
    }
}

async function safeDeferUpdate(interaction) {
    if (
        !interaction ||
        interaction.deferred ||
        interaction.replied
    ) {
        return true;
    }

    patchInteractionResponses(interaction);

    const deferUpdate =
        getOriginal(interaction, 'deferUpdate');

    if (typeof deferUpdate !== 'function') {
        return false;
    }

    try {
        await deferUpdate();
        return true;

    } catch (error) {
        if (isIgnoredInteractionError(error)) {
            logIgnoredInteractionError(
                interaction,
                'deferUpdate',
                error
            );
            return false;
        }

        throw error;
    }
}

async function safeEditReply(interaction, options) {
    if (!interaction) return null;

    patchInteractionResponses(interaction);

    try {
        const editReply =
            getOriginal(interaction, 'editReply');

        return await editReply(
            removeReplyOnlyOptions(
                normalizeInteractionOptions(options)
            )
        );

    } catch (error) {
        if (isIgnoredInteractionError(error)) {
            logIgnoredInteractionError(
                interaction,
                'editReply',
                error
            );
            return null;
        }

        throw error;
    }
}

async function safeFollowUp(interaction, options) {
    if (!interaction) return null;

    patchInteractionResponses(interaction);

    try {
        const followUp =
            getOriginal(interaction, 'followUp');

        return await followUp(
            normalizeInteractionOptions(options)
        );

    } catch (error) {
        if (isIgnoredInteractionError(error)) {
            logIgnoredInteractionError(
                interaction,
                'followUp',
                error
            );
            return null;
        }

        throw error;
    }
}

function patchInteractionResponses(interaction) {
    if (
        !interaction ||
        interaction.__safeResponsesPatched
    ) {
        return;
    }

    interaction.__safeResponsesPatched = true;

    interaction.__safeOriginalResponses = {};

    for (const methodName of [
        'reply',
        'editReply',
        'followUp',
        'deferReply',
        'deferUpdate'
    ]) {
        if (typeof interaction[methodName] === 'function') {
            interaction.__safeOriginalResponses[methodName] =
                interaction[methodName].bind(interaction);
        }
    }

    if (interaction.__safeOriginalResponses.reply) {
        interaction.reply = options =>
            safeReply(interaction, options);
    }

    if (interaction.__safeOriginalResponses.editReply) {
        interaction.editReply = options =>
            safeEditReply(interaction, options);
    }

    if (interaction.__safeOriginalResponses.followUp) {
        interaction.followUp = options =>
            safeFollowUp(interaction, options);
    }

    if (interaction.__safeOriginalResponses.deferReply) {
        interaction.deferReply = options =>
            safeDeferReply(interaction, options);
    }

    if (interaction.__safeOriginalResponses.deferUpdate) {
        interaction.deferUpdate = () =>
            safeDeferUpdate(interaction);
    }
}

module.exports = {
    isIgnoredInteractionError,
    normalizeInteractionOptions,
    patchInteractionResponses,
    safeDeferReply,
    safeDeferUpdate,
    safeEditReply,
    safeFollowUp,
    safeReply
};

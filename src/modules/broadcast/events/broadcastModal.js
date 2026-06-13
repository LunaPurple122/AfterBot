const {
    Events,
    MessageFlags
} = require('discord.js');

const {
    createBroadcastJob
} = require('../../../core/broadcastService');

const {
    safeDeferReply,
    safeReply
} = require('../../../core/interactions');

const AUTHORIZED_USER_ID = '987688776027471933';
const CUSTOM_ID_PREFIX = 'broadcast_create:';
const MAX_TITLE_LENGTH = 256;
const MAX_MESSAGE_LENGTH = 4000;

function parseYesNo(value, defaultValue) {
    const normalized =
        String(value || '')
            .trim()
            .toLowerCase();

    if (!normalized) {
        return {
            value: defaultValue
        };
    }

    if (['oui', 'yes', 'y', 'o'].includes(normalized)) {
        return {
            value: true
        };
    }

    if (['non', 'no', 'n'].includes(normalized)) {
        return {
            value: false
        };
    }

    return {
        error:
            'Les options oui/non acceptent seulement oui, non, yes, no, y ou n.'
    };
}

function validateFields({
    title,
    message,
    sendToLogsInput,
    sendToOwnersInput
}) {
    if (!title.trim()) {
        return {
            error:
                'Le titre ne peut pas etre vide.'
        };
    }

    if (!message.trim()) {
        return {
            error:
                'Le message ne peut pas etre vide.'
        };
    }

    if (title.length > MAX_TITLE_LENGTH) {
        return {
            error:
                `Le titre est limite a ${MAX_TITLE_LENGTH} caracteres.`
        };
    }

    if (message.length > MAX_MESSAGE_LENGTH) {
        return {
            error:
                `Le message est limite a ${MAX_MESSAGE_LENGTH} caracteres.`
        };
    }

    const sendToLogs =
        parseYesNo(sendToLogsInput, true);

    if (sendToLogs.error) {
        return sendToLogs;
    }

    const sendToOwners =
        parseYesNo(sendToOwnersInput, true);

    if (sendToOwners.error) {
        return sendToOwners;
    }

    return {
        value: {
            sendToLogs:
                sendToLogs.value,
            sendToOwners:
                sendToOwners.value
        }
    };
}

module.exports = {
    name: Events.InteractionCreate,

    async execute(interaction) {
        if (
            !interaction.isModalSubmit() ||
            !interaction.customId.startsWith(CUSTOM_ID_PREFIX)
        ) {
            return;
        }

        if (interaction.user.id !== AUTHORIZED_USER_ID) {
            return safeReply(interaction, {
                content:
                    '❌ Tu n’es pas autorisé à utiliser cette commande.',
                flags:
                    MessageFlags.Ephemeral
            });
        }

        const [, expectedUserId] =
            interaction.customId.split(':');

        if (expectedUserId !== AUTHORIZED_USER_ID) {
            return safeReply(interaction, {
                content:
                    '❌ Tu n’es pas autorisé à utiliser cette commande.',
                flags:
                    MessageFlags.Ephemeral
            });
        }

        const title =
            interaction.fields
                .getTextInputValue('title')
                .trim();

        const message =
            interaction.fields
                .getTextInputValue('message')
                .trim();

        const sendToLogsInput =
            interaction.fields
                .getTextInputValue('send_to_logs');

        const sendToOwnersInput =
            interaction.fields
                .getTextInputValue('send_to_owners');

        const validation =
            validateFields({
                title,
                message,
                sendToLogsInput,
                sendToOwnersInput
            });

        if (validation.error) {
            return safeReply(interaction, {
                content:
                    `❌ ${validation.error}`,
                flags:
                    MessageFlags.Ephemeral
            });
        }

        try {
            const deferred =
                await safeDeferReply(interaction, {
                    flags:
                        MessageFlags.Ephemeral
                });

            if (!deferred) return;

            await createBroadcastJob({
                title,
                message,
                sendToLogs:
                    validation.value.sendToLogs,
                sendToOwners:
                    validation.value.sendToOwners
            });

            return safeReply(interaction, {
                content:
                    '✅ Broadcast ajouté à la file d’attente.',
                flags:
                    MessageFlags.Ephemeral
            });

        } catch (error) {
            console.error(
                `Erreur creation broadcast Discord par ${interaction.user.id}:`,
                error
            );

            return safeReply(interaction, {
                content:
                    '❌ Impossible d’ajouter le broadcast à la file d’attente.',
                flags:
                    MessageFlags.Ephemeral
            });
        }
    }
};

const {
    Events,
    MessageFlags
} = require('discord.js');

const {
    createLoveMessage,
    isLoveUser
} = require('../services/loveService');

const {
    safeDeferReply,
    safeReply
} = require('../../../core/interactions');

const MAX_TITLE_LENGTH = 100;
const MAX_CONTENT_LENGTH = 3000;
const CUSTOM_ID_PREFIX = 'love_create:';

function validateFields(titre, contenu) {
    if (!titre.trim() || !contenu.trim()) {
        return 'Le titre et le contenu ne peuvent pas être vides.';
    }

    if (titre.length > MAX_TITLE_LENGTH) {
        return `Le titre est limité à ${MAX_TITLE_LENGTH} caractères.`;
    }

    if (contenu.length > MAX_CONTENT_LENGTH) {
        return `Le contenu est limité à ${MAX_CONTENT_LENGTH} caractères.`;
    }

    return null;
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

        const [, expectedUserId] =
            interaction.customId.split(':');

        if (
            interaction.user.id !== expectedUserId ||
            !isLoveUser(interaction.user.id)
        ) {
            return safeReply(interaction, {
                content:
                    '❌ Cette commande est privée.',
                flags:
                    MessageFlags.Ephemeral
            });
        }

        const titre =
            interaction.fields
                .getTextInputValue('titre')
                .trim();

        const contenu =
            interaction.fields
                .getTextInputValue('contenu');

        const validationError =
            validateFields(titre, contenu);

        if (validationError) {
            return safeReply(interaction, {
                content:
                    `❌ ${validationError}`,
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

            const message =
                await createLoveMessage(
                    interaction.user.id,
                    titre,
                    contenu
                );

            return safeReply(interaction, {
                content:
`✅ Message enregistré.
ID : ${message.id}`,
                flags:
                    MessageFlags.Ephemeral
            });

        } catch (error) {
            console.error(
                `Erreur création message Love par ${interaction.user.id}:`,
                error
            );

            return safeReply(interaction, {
                content:
                    '❌ Impossible d’enregistrer le message.',
                flags:
                    MessageFlags.Ephemeral
            });
        }
    }
};

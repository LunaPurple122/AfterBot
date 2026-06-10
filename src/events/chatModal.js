const {
    Events,
    PermissionFlagsBits
} = require('discord.js');

const DISCORD_MESSAGE_LIMIT = 2000;

const {
    safeDeferReply,
    safeReply
} = require('../core/interactions');

function splitDiscordMessage(message) {
    const chunks = [];
    const lines = message.split('\n');
    let currentChunk = '';

    for (const line of lines) {
        const nextLine =
            currentChunk ? `\n${line}` : line;

        if (
            currentChunk.length + nextLine.length <=
            DISCORD_MESSAGE_LIMIT
        ) {
            currentChunk += nextLine;
            continue;
        }

        if (currentChunk) {
            chunks.push(currentChunk);
            currentChunk = '';
        }

        if (line.length <= DISCORD_MESSAGE_LIMIT) {
            currentChunk = line;
            continue;
        }

        for (
            let index = 0;
            index < line.length;
            index += DISCORD_MESSAGE_LIMIT
        ) {
            chunks.push(
                line.slice(
                    index,
                    index + DISCORD_MESSAGE_LIMIT
                )
            );
        }
    }

    if (currentChunk) {
        chunks.push(currentChunk);
    }

    return chunks;
}

module.exports = {

    chatModalEvent: {

        name: Events.InteractionCreate,

        async execute(interaction) {

            if (!interaction.isModalSubmit()) return;

            if (!interaction.customId.startsWith('chat_modal_')) return;

            try {

                if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                    return safeReply(interaction, {
                        content: 'Tu n as pas la permission d utiliser ca.',
                        ephemeral: true
                    });
                }

                const channelId =
                    interaction.customId.replace('chat_modal_', '');

                const channel =
                    interaction.guild.channels.cache.get(channelId);

                if (!channel || !channel.isTextBased()) {
                    return safeReply(interaction, {
                        content: 'Salon introuvable ou invalide.',
                        ephemeral: true
                    });
                }

                const message =
                    interaction.fields.getTextInputValue('message');

                const chunks =
                    splitDiscordMessage(message);

                const deferred =
                    await safeDeferReply(interaction, {
                        ephemeral: true
                    });

                if (!deferred) return;

                for (const chunk of chunks) {
                    await channel.send({
                        content: chunk,
                        allowedMentions: {
                            parse: ['users', 'roles', 'everyone']
                        }
                    });
                }

                await safeReply(interaction, {
                    content:
                        chunks.length > 1
                            ? `Message envoye dans ${channel} en ${chunks.length} parties.`
                            : `Message envoye dans ${channel}.`,
                    ephemeral: true
                });

            } catch (error) {

                console.error('Erreur chat modal :', error);

                await safeReply(interaction, {
                    content:
                        'Une erreur est survenue pendant l envoi du message.',
                    ephemeral: true
                });
            }
        }
    }
};

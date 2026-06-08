const {
    ActionRowBuilder,
    EmbedBuilder,
    MessageFlags,
    ModalBuilder,
    SlashCommandBuilder,
    TextInputBuilder,
    TextInputStyle
} = require('discord.js');

const {
    getLoveDisplayName,
    getLoveMessage,
    getOtherLoveUser,
    isLoveUser,
    listLoveMessages
} = require('../services/loveService');

const MAX_TITLE_LENGTH = 100;
const MAX_CONTENT_LENGTH = 3000;
const LOVE_COLOR = 0xFF77AA;

function formatCreatedAt(value) {
    const date =
        new Date(value);

    if (Number.isNaN(date.getTime())) {
        return 'Date inconnue';
    }

    const timestamp =
        Math.floor(date.getTime() / 1000);

    return `<t:${timestamp}:f>`;
}

function buildLoveEmbed(message) {
    return new EmbedBuilder()
        .setTitle(message.titre)
        .setDescription(message.contenu)
        .setColor(LOVE_COLOR)
        .setFooter({
            text:
                `Message écrit par ${getLoveDisplayName(message.auteur_id)}`
        })
        .setTimestamp(message.created_at);
}

function buildPlainMessage(message) {
    return [
        `**${message.titre}**`,
        '',
        message.contenu,
        '',
        `Message écrit par ${getLoveDisplayName(message.auteur_id)}`
    ].join('\n');
}

function buildDmPayload(message) {
    if (
        message.titre.length <= 256 &&
        message.contenu.length <= 4096
    ) {
        return {
            embeds: [
                buildLoveEmbed(message)
            ]
        };
    }

    return {
        content:
            buildPlainMessage(message)
                .slice(0, 2000)
    };
}

function buildListLines(messages) {
    return messages.map(message => (
        `ID ${message.id} - ${message.titre} - ${getLoveDisplayName(message.auteur_id)} - ${formatCreatedAt(message.created_at)}`
    ));
}

function chunkLines(lines, maxLength = 1900) {
    const chunks = [];
    let current = '';

    for (const line of lines) {
        const next =
            current
                ? `${current}\n${line}`
                : line;

        if (next.length > maxLength) {
            if (current) {
                chunks.push(current);
            }

            current =
                line.length > maxLength
                    ? `${line.slice(0, maxLength - 3)}...`
                    : line;

            continue;
        }

        current = next;
    }

    if (current) {
        chunks.push(current);
    }

    return chunks;
}

async function replyPrivateCommand(interaction) {
    return interaction.reply({
        content:
            '❌ Cette commande est privée.',
        flags:
            MessageFlags.Ephemeral
    });
}

async function respond(interaction, options) {
    const payload = {
        ...options,
        flags:
            Number(options.flags || 0) |
            MessageFlags.Ephemeral
    };

    if (interaction.deferred && !interaction.replied) {
        const editPayload = {
            ...payload
        };

        delete editPayload.flags;

        return interaction.editReply(editPayload);
    }

    if (interaction.replied) {
        return interaction.followUp(payload);
    }

    return interaction.reply(payload);
}

async function safeSendDm(targetUser, payload) {
    try {
        await targetUser.send(payload);
        return true;
    } catch (error) {
        console.error(
            `Impossible d'envoyer un MP a ${targetUser.id}:`,
            error
        );
        return false;
    }
}

function buildLoveModal({
    customId,
    modalTitle,
    titleValue = '',
    contentValue = ''
}) {
    const titleInput =
        new TextInputBuilder()
            .setCustomId('titre')
            .setLabel('Titre')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(MAX_TITLE_LENGTH);

    if (titleValue) {
        titleInput.setValue(titleValue.slice(0, MAX_TITLE_LENGTH));
    }

    const contentInput =
        new TextInputBuilder()
            .setCustomId('contenu')
            .setLabel('Contenu')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMaxLength(MAX_CONTENT_LENGTH);

    if (contentValue) {
        contentInput.setValue(contentValue.slice(0, MAX_CONTENT_LENGTH));
    }

    return new ModalBuilder()
        .setCustomId(customId)
        .setTitle(modalTitle)
        .addComponents(
            new ActionRowBuilder().addComponents(titleInput),
            new ActionRowBuilder().addComponents(contentInput)
        );
}

async function waitForModalExpiration(interaction, customId, message) {
    try {
        await interaction.awaitModalSubmit({
            time: 300000,
            filter: modalInteraction =>
                modalInteraction.customId === customId &&
                modalInteraction.user.id === interaction.user.id
        });
    } catch (error) {
        if (String(error?.message || '').includes('time')) {
            await interaction.followUp({
                content:
                    message,
                flags:
                    MessageFlags.Ephemeral
            }).catch(followUpError => {
                console.error(
                    `Impossible d'envoyer l'annulation du modal Love ${customId}:`,
                    followUpError
                );
            });
            return;
        }

        console.error(
            `Erreur attente modal Love ${customId}:`,
            error
        );
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('love')
        .setDescription('Messages privés du couple.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('message')
                .setDescription('Enregistrer un message privé.')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('Lister les messages enregistrés.')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('read')
                .setDescription('Recevoir un message en MP.')
                .addIntegerOption(option =>
                    option
                        .setName('id')
                        .setDescription('ID du message')
                        .setRequired(true)
                        .setMinValue(1)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('mod')
                .setDescription('Modifier un message.')
                .addIntegerOption(option =>
                    option
                        .setName('id')
                        .setDescription('ID du message')
                        .setRequired(true)
                        .setMinValue(1)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('send')
                .setDescription("Envoyer un message à l'autre personne.")
                .addIntegerOption(option =>
                    option
                        .setName('id')
                        .setDescription('ID du message')
                        .setRequired(true)
                        .setMinValue(1)
                )
        ),

    async execute(interaction) {
        if (!isLoveUser(interaction.user.id)) {
            return replyPrivateCommand(interaction);
        }

        const subcommand =
            interaction.options.getSubcommand();

        if (subcommand === 'message') {
            const customId =
                `love_create:${interaction.user.id}:${Date.now()}`;

            await interaction.showModal(
                buildLoveModal({
                    customId,
                    modalTitle:
                        'Nouveau message Love'
                })
            );

            waitForModalExpiration(
                interaction,
                customId,
                '❌ Modification annulée.'
            );

            return;
        }

        if (subcommand === 'mod') {
            const id =
                interaction.options.getInteger('id');

            const message =
                await getLoveMessage(id);

            if (!message) {
                return interaction.reply({
                    content:
                        '❌ Message introuvable.',
                    flags:
                        MessageFlags.Ephemeral
                });
            }

            const customId =
                `love_edit:${interaction.user.id}:${message.id}:${Date.now()}`;

            await interaction.showModal(
                buildLoveModal({
                    customId,
                    modalTitle:
                        `Modifier message #${message.id}`,
                    titleValue:
                        message.titre,
                    contentValue:
                        message.contenu
                })
            );

            waitForModalExpiration(
                interaction,
                customId,
                '❌ Création annulée.'
            );

            return;
        }

        await interaction.deferReply({
            flags:
                MessageFlags.Ephemeral
        });

        if (subcommand === 'list') {
            const messages =
                await listLoveMessages();

            if (messages.length === 0) {
                return respond(interaction, {
                    content:
                        'Aucun message enregistré.'
                });
            }

            const chunks =
                chunkLines(
                    buildListLines(messages)
                );

            await interaction.editReply({
                content:
                    chunks[0]
            });

            for (const chunk of chunks.slice(1)) {
                await interaction.followUp({
                    content:
                        chunk,
                    flags:
                        MessageFlags.Ephemeral
                });
            }

            return;
        }

        if (subcommand === 'read') {
            const id =
                interaction.options.getInteger('id');

            const message =
                await getLoveMessage(id);

            if (!message) {
                return respond(interaction, {
                    content:
                        '❌ Message introuvable.'
                });
            }

            const sent =
                await safeSendDm(
                    interaction.user,
                    buildDmPayload(message)
                );

            return respond(interaction, {
                content:
                    sent
                        ? '✅ Message envoyé en MP.'
                        : "❌ Impossible de t'envoyer un MP."
            });
        }

        if (subcommand === 'send') {
            const id =
                interaction.options.getInteger('id');

            const message =
                await getLoveMessage(id);

            if (!message) {
                return respond(interaction, {
                    content:
                        '❌ Message introuvable.'
                });
            }

            const otherLoveUser =
                getOtherLoveUser(interaction.user.id);

            if (!otherLoveUser) {
                return replyPrivateCommand(interaction);
            }

            const targetUser =
                await interaction.client.users.fetch(otherLoveUser.id)
                    .catch(error => {
                        console.error(
                            `Impossible de récupérer l'utilisateur ${otherLoveUser.id}:`,
                            error
                        );
                        return null;
                    });

            if (!targetUser) {
                return respond(interaction, {
                    content:
                        "❌ Impossible d'envoyer le MP."
                });
            }

            const sent =
                await safeSendDm(
                    targetUser,
                    buildDmPayload(message)
                );

            return respond(interaction, {
                content:
                    sent
                        ? `✅ Message envoyé à ${otherLoveUser.name}.`
                        : "❌ Impossible d'envoyer le MP."
            });
        }

        return respond(interaction, {
            content:
                '❌ Sous-commande inconnue.'
        });
    }
};

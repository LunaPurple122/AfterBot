const { Events } = require('discord.js');

const {
    safeDeferUpdate,
    safeReply
} = require('../../../core/interactions');

const {
    buildBanListEmbed,
    listMinorBans,
    memberCanManageMineur,
    setDmMessage
} = require('../services/mineurService');

const PAGE_SIZE = 8;
const MAX_DM_LENGTH = 1900;

function buildPaginationRows(page, totalRows) {
    const {
        ActionRowBuilder,
        ButtonBuilder,
        ButtonStyle
    } = require('discord.js');

    const totalPages =
        Math.max(
            1,
            Math.ceil(totalRows / PAGE_SIZE)
        );

    return [
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`mineur_bans:${page - 1}`)
                    .setLabel('Precedent')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(page <= 0),
                new ButtonBuilder()
                    .setCustomId(`mineur_bans:${page + 1}`)
                    .setLabel('Suivant')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(page >= totalPages - 1)
            )
    ];
}

async function handleMessageModal(interaction) {
    const expectedUserId =
        interaction.customId.replace(
            'mineur_msg:',
            ''
        );

    if (interaction.user.id !== expectedUserId) {
        return safeReply(interaction, {
            content:
                'Ce modal ne t est pas destine.',
            ephemeral: true
        });
    }

    if (!await memberCanManageMineur(interaction.member)) {
        return safeReply(interaction, {
            content:
                'Tu dois etre administrateur ou posseder le role staff configure pour modifier ce message.',
            ephemeral: true
        });
    }

    const dmMessage =
        interaction.fields
            .getTextInputValue('dm_message')
            .trim();

    if (!dmMessage) {
        return safeReply(interaction, {
            content:
                'Le message ne peut pas etre vide.',
            ephemeral: true
        });
    }

    if (dmMessage.length > MAX_DM_LENGTH) {
        return safeReply(interaction, {
            content:
                `Le message est limite a ${MAX_DM_LENGTH} caracteres.`,
            ephemeral: true
        });
    }

    await setDmMessage(
        interaction.guild.id,
        dmMessage
    );

    return safeReply(interaction, {
        content:
            'Message MP mineur enregistre.',
        ephemeral: true
    });
}

async function handleBanPagination(interaction) {
    if (!await memberCanManageMineur(interaction.member)) {
        return safeReply(interaction, {
            content:
                'Tu dois etre administrateur ou posseder le role staff configure pour utiliser cette pagination.',
            ephemeral: true
        });
    }

    const page =
        Number(
            interaction.customId.replace(
                'mineur_bans:',
                ''
            )
        );

    if (!Number.isInteger(page) || page < 0) {
        return safeReply(interaction, {
            content:
                'Page invalide.',
            ephemeral: true
        });
    }

    const deferred =
        await safeDeferUpdate(interaction);

    if (!deferred) return null;

    const rows =
        await listMinorBans(interaction.guild.id);

    const totalPages =
        Math.max(
            1,
            Math.ceil(rows.length / PAGE_SIZE)
        );

    const safePage =
        Math.min(
            page,
            totalPages - 1
        );

    return interaction.editReply({
        embeds: [
            buildBanListEmbed(
                rows,
                safePage,
                PAGE_SIZE
            )
        ],
        components:
            rows.length > PAGE_SIZE
                ? buildPaginationRows(safePage, rows.length)
                : []
    });
}

module.exports = {
    name: Events.InteractionCreate,

    async execute(interaction) {
        try {
            if (
                interaction.isModalSubmit() &&
                interaction.customId.startsWith('mineur_msg:')
            ) {
                return handleMessageModal(interaction);
            }

            if (
                interaction.isButton() &&
                interaction.customId.startsWith('mineur_bans:')
            ) {
                return handleBanPagination(interaction);
            }

            return null;

        } catch (error) {
            console.error(
                'Erreur interaction mineur :',
                error
            );

            return safeReply(interaction, {
                content:
                    'Impossible de traiter cette interaction mineur.',
                ephemeral: true
            });
        }
    }
};

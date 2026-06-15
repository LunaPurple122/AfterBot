const {
    EmbedBuilder
} = require('discord.js');

const { pool } =
    require('../../../database/db');

const DEFAULT_BAN_DM = {
    title:
        'Bannissement',
    description:
        [
            'Tu as été banni de :',
            '',
            '{server}',
            '',
            'Raison :',
            '{reason}',
            '',
            'Demande de déban :',
            'deban-adg@afterproject.fr'
        ].join('\n'),
    color:
        0xED4245
};

function replaceVariables(template, variables) {
    return String(template || '')
        .replaceAll('{server}', variables.server)
        .replaceAll('{reason}', variables.reason)
        .replaceAll('{user}', variables.user)
        .replaceAll('{moderator}', variables.moderator);
}

async function getBanDmConfig(guildId) {
    const result =
        await pool.query(`
            SELECT title, description, color
            FROM moderation_ban_dm_messages
            WHERE serveur_id = $1;
        `, [
            guildId
        ]);

    return result.rows[0] || DEFAULT_BAN_DM;
}

async function saveBanDmConfig({
    guildId,
    title,
    description,
    color = DEFAULT_BAN_DM.color
}) {
    await pool.query(`
        INSERT INTO moderation_ban_dm_messages (
            serveur_id,
            title,
            description,
            color,
            updated_at
        )
        VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
        ON CONFLICT (serveur_id)
        DO UPDATE SET
            title = EXCLUDED.title,
            description = EXCLUDED.description,
            color = EXCLUDED.color,
            updated_at = CURRENT_TIMESTAMP;
    `, [
        guildId,
        title,
        description,
        color
    ]);
}

async function buildBanDmEmbed({
    guild,
    user,
    moderator,
    reason
}) {
    const config =
        await getBanDmConfig(guild.id);

    const variables = {
        server:
            guild.name,
        reason,
        user:
            user.tag || user.username || String(user.id),
        moderator:
            moderator.tag || moderator.username || String(moderator.id)
    };

    return new EmbedBuilder()
        .setColor(Number(config.color || DEFAULT_BAN_DM.color))
        .setTitle(
            replaceVariables(
                config.title,
                variables
            ).slice(0, 256)
        )
        .setDescription(
            replaceVariables(
                config.description,
                variables
            ).slice(0, 4096)
        )
        .setTimestamp();
}

function normalizeBanDmInput({
    title,
    description
}) {
    const cleanTitle =
        String(title || '').trim();

    const cleanDescription =
        String(description || '').trim();

    if (!cleanTitle) {
        return {
            error:
                'Le titre ne peut pas être vide.'
        };
    }

    if (!cleanDescription) {
        return {
            error:
                'Le message ne peut pas être vide.'
        };
    }

    if (cleanTitle.length > 256) {
        return {
            error:
                'Le titre est limité à 256 caractères.'
        };
    }

    if (cleanDescription.length > 4000) {
        return {
            error:
                'Le message est limité à 4000 caractères.'
        };
    }

    return {
        value: {
            title:
                cleanTitle,
            description:
                cleanDescription,
            color:
                DEFAULT_BAN_DM.color
        }
    };
}

module.exports = {
    DEFAULT_BAN_DM,
    buildBanDmEmbed,
    getBanDmConfig,
    normalizeBanDmInput,
    saveBanDmConfig
};

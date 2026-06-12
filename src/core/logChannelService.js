const { PermissionFlagsBits } = require('discord.js');
const { pool } = require('../database/db');
const {
    LOG_TYPES,
    isValidLogType
} = require('./logTypes');

function assertValidLogType(logType) {
    if (!isValidLogType(logType)) {
        throw new Error(`Type de log invalide: ${logType}`);
    }
}

async function getSpecificLogChannel(guildId, logType) {
    assertValidLogType(logType);

    const result = await pool.query(`
        SELECT channel_id
        FROM log_channels
        WHERE guild_id = $1
        AND log_type = $2
    `, [guildId, logType]);

    return result.rows[0]?.channel_id || null;
}

async function getGeneralLogChannel(guildId) {
    const result = await pool.query(`
        SELECT salon_logs_id
        FROM serveurs
        WHERE serveur_id = $1
    `, [guildId]);

    return result.rows[0]?.salon_logs_id || null;
}

async function getLegacyTypedLogChannel(guildId, logType) {
    if (logType === LOG_TYPES.ALERTE) {
        const result = await pool.query(`
            SELECT logs_channel_id
            FROM automod_config
            WHERE serveur_id = $1
        `, [guildId]);

        return result.rows[0]?.logs_channel_id || null;
    }

    if (logType === LOG_TYPES.TICKET) {
        const result = await pool.query(`
            SELECT logs_channel_id
            FROM ticket_config
            WHERE serveur_id = $1
        `, [guildId]);

        return result.rows[0]?.logs_channel_id || null;
    }

    return null;
}

async function getLogChannel(guildId, logType) {
    return (
        await getSpecificLogChannel(guildId, logType) ||
        await getLegacyTypedLogChannel(guildId, logType) ||
        await getGeneralLogChannel(guildId)
    );
}

async function setLogChannel(guildId, logType, channelId) {
    assertValidLogType(logType);

    await pool.query(`
        INSERT INTO log_channels (
            guild_id,
            log_type,
            channel_id
        )
        VALUES ($1, $2, $3)
        ON CONFLICT (guild_id, log_type)
        DO UPDATE SET
            channel_id = EXCLUDED.channel_id,
            updated_at = CURRENT_TIMESTAMP
    `, [guildId, logType, channelId]);
}

async function removeLogChannel(guildId, logType) {
    assertValidLogType(logType);

    const result = await pool.query(`
        DELETE FROM log_channels
        WHERE guild_id = $1
        AND log_type = $2
    `, [guildId, logType]);

    return result.rowCount > 0;
}

async function listLogChannels(guildId) {
    const result = await pool.query(`
        SELECT log_type, channel_id
        FROM log_channels
        WHERE guild_id = $1
        ORDER BY log_type ASC
    `, [guildId]);

    return result.rows;
}

async function fetchWritableTextChannel(client, channelId, context) {
    if (!channelId) return null;

    try {
        const channel =
            await client.channels.fetch(channelId);

        if (!channel?.isTextBased?.()) {
            console.error(`[logs] Salon invalide pour ${context}: ${channelId}`);
            return null;
        }

        const permissions =
            channel.guild?.members?.me
                ? channel.permissionsFor(channel.guild.members.me)
                : null;

        if (
            permissions &&
            (
                !permissions.has(PermissionFlagsBits.ViewChannel) ||
                !permissions.has(PermissionFlagsBits.SendMessages)
            )
        ) {
            console.error(`[logs] Permissions insuffisantes pour ${context}: ${channelId}`);
            return null;
        }

        return channel;

    } catch (error) {
        console.error(`[logs] Salon introuvable pour ${context}: ${channelId}`, error);
        return null;
    }
}

async function resolveLogChannel(client, guildId, logType) {
    assertValidLogType(logType);

    const specificChannelId =
        await getSpecificLogChannel(guildId, logType);

    const generalChannelId =
        await getGeneralLogChannel(guildId);

    const legacyChannelId =
        await getLegacyTypedLogChannel(guildId, logType);

    const specificChannel =
        await fetchWritableTextChannel(
            client,
            specificChannelId,
            `${guildId}/${logType}`
        );

    if (specificChannel) return specificChannel;

    if (
        legacyChannelId &&
        legacyChannelId !== specificChannelId
    ) {
        const legacyChannel =
            await fetchWritableTextChannel(
                client,
                legacyChannelId,
                `${guildId}/${logType}/legacy`
            );

        if (legacyChannel) return legacyChannel;
    }

    if (
        generalChannelId &&
        generalChannelId !== specificChannelId
        &&
        generalChannelId !== legacyChannelId
    ) {
        return fetchWritableTextChannel(
            client,
            generalChannelId,
            `${guildId}/fallback`
        );
    }

    return null;
}

async function sendToLogChannel(client, guildId, logType, payload) {
    const channel =
        await resolveLogChannel(client, guildId, logType);

    if (!channel) return null;

    try {
        return await channel.send(payload);

    } catch (error) {
        console.error(`[logs] Impossible d'envoyer le log ${logType}:`, error);
        return null;
    }
}

module.exports = {
    getLogChannel,
    setLogChannel,
    removeLogChannel,
    listLogChannels,
    resolveLogChannel,
    sendToLogChannel
};

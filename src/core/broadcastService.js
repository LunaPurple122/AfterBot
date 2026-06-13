const {
    EmbedBuilder,
    PermissionFlagsBits
} = require('discord.js');

const { pool } = require('../database/db');
const { LOG_TYPES } = require('./logTypes');

const BROADCAST_INTERVAL_MS = 10 * 1000;
const MAX_DESCRIPTION_LENGTH = 4096;

let broadcastInterval = null;
let broadcastRunning = false;

async function ensureBroadcastTable() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS broadcast_jobs (
            id SERIAL PRIMARY KEY,
            title VARCHAR(256) NOT NULL,
            message TEXT NOT NULL,
            send_to_logs BOOLEAN DEFAULT true,
            send_to_owners BOOLEAN DEFAULT false,
            status VARCHAR(32) DEFAULT 'pending',
            stats JSONB,
            error TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            started_at TIMESTAMP,
            sent_at TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_broadcast_jobs_status
        ON broadcast_jobs (status, created_at);
    `);
}

function buildBroadcastEmbed(job) {
    return new EmbedBuilder()
        .setTitle(job.title)
        .setDescription(job.message)
        .setFooter({
            text: 'Message global envoyé par AfterBot'
        })
        .setTimestamp()
        .setColor(0x5865F2);
}

function createInitialStats() {
    return {
        serveursTrouves: 0,
        messagesSalonsEnvoyes: 0,
        mpProprietairesEnvoyes: 0,
        salonsIntrouvables: 0,
        salonsInaccessibles: 0,
        mpRefuses: 0,
        erreurs: 0
    };
}

async function claimPendingJob() {
    const result = await pool.query(`
        UPDATE broadcast_jobs
        SET
            status = 'processing',
            started_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = (
            SELECT id
            FROM broadcast_jobs
            WHERE status = 'pending'
            ORDER BY created_at ASC
            FOR UPDATE SKIP LOCKED
            LIMIT 1
        )
        RETURNING *;
    `);

    return result.rows[0] || null;
}

async function getConfiguredGuildIds() {
    const result = await pool.query(`
        SELECT serveur_id
        FROM serveurs
        ORDER BY cree_le ASC;
    `);

    return result.rows.map(row => String(row.serveur_id));
}

async function getLogChannelCandidates(guildId) {
    const result = await pool.query(`
        SELECT channel_id, priority
        FROM (
            SELECT channel_id, 1 AS priority
            FROM log_channels
            WHERE guild_id = $1
            AND log_type = $2

            UNION ALL

            SELECT logs_channel_id AS channel_id, 2 AS priority
            FROM automod_config
            WHERE serveur_id = $1
            AND logs_channel_id IS NOT NULL

            UNION ALL

            SELECT channel_id, 3 AS priority
            FROM log_channels
            WHERE guild_id = $1
            AND log_type <> $2

            UNION ALL

            SELECT logs_channel_id AS channel_id, 4 AS priority
            FROM ticket_config
            WHERE serveur_id = $1
            AND logs_channel_id IS NOT NULL

            UNION ALL

            SELECT salon_logs_id AS channel_id, 5 AS priority
            FROM serveurs
            WHERE serveur_id = $1
            AND salon_logs_id IS NOT NULL
        ) candidates
        WHERE channel_id IS NOT NULL
        ORDER BY priority ASC;
    `, [
        guildId,
        LOG_TYPES.ALERTE
    ]);

    const seen = new Set();
    const channelIds = [];

    for (const row of result.rows) {
        const channelId = String(row.channel_id);

        if (seen.has(channelId)) continue;

        seen.add(channelId);
        channelIds.push(channelId);
    }

    return channelIds;
}

async function fetchWritableLogChannel(guild, channelId, stats) {
    let channel = guild.channels.cache.get(channelId);

    if (!channel) {
        try {
            channel = await guild.channels.fetch(channelId);
        } catch (error) {
            stats.salonsIntrouvables++;
            console.error(
                `[broadcast] Salon introuvable ${channelId} sur ${guild.id}:`,
                error.message
            );
            return null;
        }
    }

    if (!channel || !channel.isTextBased()) {
        stats.salonsInaccessibles++;
        return null;
    }

    const permissions =
        channel.permissionsFor(guild.members.me);

    if (
        !permissions ||
        !permissions.has(PermissionFlagsBits.ViewChannel) ||
        !permissions.has(PermissionFlagsBits.SendMessages) ||
        !permissions.has(PermissionFlagsBits.EmbedLinks)
    ) {
        stats.salonsInaccessibles++;
        console.error(
            `[broadcast] Permissions insuffisantes dans ${channel.id} sur ${guild.id}.`
        );
        return null;
    }

    return channel;
}

async function sendToFirstValidLogChannel(guild, embed, stats) {
    const channelIds =
        await getLogChannelCandidates(guild.id);

    if (channelIds.length === 0) {
        stats.salonsIntrouvables++;
        return;
    }

    for (const channelId of channelIds) {
        const channel =
            await fetchWritableLogChannel(
                guild,
                channelId,
                stats
            );

        if (!channel) continue;

        try {
            await channel.send({
                embeds: [embed]
            });

            stats.messagesSalonsEnvoyes++;
            return;

        } catch (error) {
            stats.erreurs++;
            console.error(
                `[broadcast] Envoi salon impossible ${channel.id} sur ${guild.id}:`,
                error.message
            );
        }
    }
}

async function sendToOwner(guild, embed, stats) {
    try {
        const owner =
            await guild.fetchOwner();

        await owner.send({
            embeds: [embed]
        });

        stats.mpProprietairesEnvoyes++;

    } catch (error) {
        const isDmRefused =
            error.code === 50007 ||
            error.rawError?.code === 50007;

        if (isDmRefused) {
            stats.mpRefuses++;
        } else {
            stats.erreurs++;
        }

        console.error(
            `[broadcast] MP proprietaire impossible sur ${guild.id}:`,
            error.message
        );
    }
}

async function completeJob(jobId, stats) {
    await pool.query(`
        UPDATE broadcast_jobs
        SET
            status = 'sent',
            stats = $2,
            sent_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1;
    `, [
        jobId,
        JSON.stringify(stats)
    ]);
}

async function failJob(jobId, error) {
    await pool.query(`
        UPDATE broadcast_jobs
        SET
            status = 'failed',
            error = $2,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1;
    `, [
        jobId,
        String(error.message || error)
    ]);
}

async function processBroadcastJob(client, job) {
    if (!job.message || job.message.length > MAX_DESCRIPTION_LENGTH) {
        throw new Error(
            'Broadcast invalide: description vide ou superieure a 4096 caracteres.'
        );
    }

    const stats =
        createInitialStats();

    const embed =
        buildBroadcastEmbed(job);

    const configuredGuildIds =
        await getConfiguredGuildIds();

    stats.serveursTrouves =
        configuredGuildIds.length;

    for (const guildId of configuredGuildIds) {
        const guild =
            client.guilds.cache.get(guildId);

        if (!guild) {
            stats.erreurs++;
            console.error(
                `[broadcast] Serveur configure inaccessible: ${guildId}.`
            );
            continue;
        }

        if (job.send_to_logs) {
            await sendToFirstValidLogChannel(
                guild,
                embed,
                stats
            );
        }

        if (job.send_to_owners) {
            await sendToOwner(
                guild,
                embed,
                stats
            );
        }
    }

    await completeJob(job.id, stats);

    console.log(
        `[broadcast] Job ${job.id} termine: ${JSON.stringify(stats)}`
    );
}

async function runBroadcastProcessor(client) {
    if (broadcastRunning) {
        return;
    }

    broadcastRunning = true;

    try {
        let job = await claimPendingJob();

        while (job) {
            try {
                await processBroadcastJob(client, job);
            } catch (error) {
                console.error(
                    `[broadcast] Job ${job.id} echoue:`,
                    error
                );

                await failJob(job.id, error);
            }

            job = await claimPendingJob();
        }

    } finally {
        broadcastRunning = false;
    }
}

async function startBroadcastProcessor(client) {
    if (broadcastInterval) {
        return;
    }

    await ensureBroadcastTable();

    runBroadcastProcessor(client).catch(error => {
        console.error(
            '[broadcast] Erreur au demarrage:',
            error
        );
    });

    broadcastInterval =
        setInterval(() => {
            runBroadcastProcessor(client).catch(error => {
                console.error(
                    '[broadcast] Erreur intervalle:',
                    error
                );
            });
        }, BROADCAST_INTERVAL_MS);

    console.log(
        'Processor broadcast demarre'
    );
}

module.exports = {
    ensureBroadcastTable,
    processBroadcastJob,
    runBroadcastProcessor,
    startBroadcastProcessor
};

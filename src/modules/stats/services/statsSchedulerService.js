const {
    PermissionsBitField
} = require('discord.js');

const { pool } =
    require('../../../database/db');

const {
    buildLeaderboardEmbeds
} = require('./leaderboardRenderer');

let schedulerInterval = null;
let schedulerRunning = false;

function getCurrentTimeLabel() {
    const now =
        new Date();

    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function getTodayStart() {
    const now =
        new Date();

    now.setHours(0, 0, 0, 0);

    return now;
}

async function claimDailySend(guildId) {
    const result =
        await pool.query(`
            UPDATE stats_config
            SET
                last_daily_sent_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE guild_id = $1
            AND enabled = true
            AND leaderboard_channel_id IS NOT NULL
            AND daily_send_time <= $3
            AND (
                last_daily_sent_at IS NULL
                OR last_daily_sent_at < $2
            )
            RETURNING *;
        `, [
            guildId,
            getTodayStart(),
            getCurrentTimeLabel()
        ]);

    return result.rows[0] || null;
}

async function getDueConfigs() {
    const result =
        await pool.query(`
            SELECT *
            FROM stats_config
            WHERE enabled = true
            AND leaderboard_channel_id IS NOT NULL
            AND daily_send_time <= $1
            AND (
                last_daily_sent_at IS NULL
                OR last_daily_sent_at < $2
            );
        `, [
            getCurrentTimeLabel(),
            getTodayStart()
        ]);

    return result.rows;
}

async function sendDailyLeaderboard(client, config) {
    const claimedConfig =
        await claimDailySend(config.guild_id);

    if (!claimedConfig) {
        return;
    }

    const guild =
        client.guilds.cache.get(String(claimedConfig.guild_id));

    if (!guild) {
        console.error(
            `Stats scheduler: serveur introuvable ${claimedConfig.guild_id}.`
        );
        return;
    }

    const channel =
        guild.channels.cache.get(
            String(claimedConfig.leaderboard_channel_id)
        );

    if (!channel || !channel.isTextBased()) {
        console.error(
            `Stats scheduler: salon invalide ${claimedConfig.leaderboard_channel_id} sur ${guild.id}.`
        );
        return;
    }

    const permissions =
        channel.permissionsFor(guild.members.me);

    if (
        !permissions ||
        !permissions.has(PermissionsBitField.Flags.ViewChannel) ||
        !permissions.has(PermissionsBitField.Flags.SendMessages) ||
        !permissions.has(PermissionsBitField.Flags.EmbedLinks)
    ) {
        console.error(
            `Stats scheduler: permissions insuffisantes dans ${channel.id} sur ${guild.id}.`
        );
        return;
    }

    const embeds =
        await buildLeaderboardEmbeds(
            guild.id,
            guild.name
        );

    await channel.send({
        embeds
    });
}

async function runStatsScheduler(client) {
    if (schedulerRunning) {
        return;
    }

    schedulerRunning = true;

    try {
        const configs =
            await getDueConfigs();

        for (const config of configs) {
            try {
                await sendDailyLeaderboard(client, config);
            } catch (error) {
                console.error(
                    `Stats scheduler: erreur envoi serveur ${config.guild_id}:`,
                    error
                );
            }
        }

    } catch (error) {
        console.error(
            'Stats scheduler: erreur globale:',
            error
        );

    } finally {
        schedulerRunning = false;
    }
}

function startStatsScheduler(client) {
    if (schedulerInterval) {
        return;
    }

    runStatsScheduler(client).catch(error => {
        console.error(
            'Stats scheduler: erreur au démarrage:',
            error
        );
    });

    schedulerInterval =
        setInterval(() => {
            runStatsScheduler(client).catch(error => {
                console.error(
                    'Stats scheduler: erreur intervalle:',
                    error
                );
            });
        }, 60 * 1000);

    console.log(
        '✅ Scheduler stats démarré'
    );
}

module.exports = {
    runStatsScheduler,
    startStatsScheduler
};

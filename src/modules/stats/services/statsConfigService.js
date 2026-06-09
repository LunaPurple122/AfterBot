const { pool } =
    require('../../../database/db');

const TIME_PATTERN =
    /^([01]\d|2[0-3]):([0-5]\d)$/;

function isValidDailySendTime(value) {
    return TIME_PATTERN.test(String(value || ''));
}

async function upsertStatsConfig(guildId, channelId, dailySendTime = '20:00') {
    await pool.query(`
        INSERT INTO stats_config (
            guild_id,
            enabled,
            leaderboard_channel_id,
            daily_send_time,
            updated_at
        )
        VALUES ($1, true, $2, $3, CURRENT_TIMESTAMP)
        ON CONFLICT (guild_id)
        DO UPDATE SET
            enabled = true,
            leaderboard_channel_id = EXCLUDED.leaderboard_channel_id,
            daily_send_time = EXCLUDED.daily_send_time,
            updated_at = CURRENT_TIMESTAMP;
    `, [
        guildId,
        channelId,
        dailySendTime
    ]);
}

async function disableStatsConfig(guildId) {
    await pool.query(`
        INSERT INTO stats_config (
            guild_id,
            enabled,
            daily_send_time,
            updated_at
        )
        VALUES ($1, false, '20:00', CURRENT_TIMESTAMP)
        ON CONFLICT (guild_id)
        DO UPDATE SET
            enabled = false,
            updated_at = CURRENT_TIMESTAMP;
    `, [
        guildId
    ]);
}

async function getStatsConfig(guildId) {
    const result =
        await pool.query(`
            SELECT *
            FROM stats_config
            WHERE guild_id = $1;
        `, [
            guildId
        ]);

    return result.rows[0] || null;
}

async function isStatsEnabled(guildId) {
    const config =
        await getStatsConfig(guildId);

    return !config || config.enabled === true;
}

async function getStatsConfigSummary(guildId) {
    const result =
        await pool.query(`
            WITH config AS (
                SELECT *
                FROM stats_config
                WHERE guild_id = $1
            ),
            tracked_users AS (
                SELECT user_id
                FROM member_stats
                WHERE guild_id = $1::TEXT

                UNION

                SELECT user_id
                FROM voice_sessions
                WHERE guild_id = $1::TEXT
                AND is_counting = true
            )
            SELECT
                COALESCE(sc.enabled, true) AS enabled,
                sc.leaderboard_channel_id,
                COALESCE(sc.daily_send_time, '20:00') AS daily_send_time,
                sc.last_daily_sent_at,
                sc.created_at,
                COUNT(tu.user_id) AS tracked_members,
                COALESCE(SUM(
                    COALESCE(ms.voice_seconds, 0)
                    + COALESCE(
                        CASE
                            WHEN vs.is_counting = true
                            THEN GREATEST(
                                0,
                                FLOOR(
                                    EXTRACT(EPOCH FROM (NOW() - vs.started_at))
                                )::BIGINT
                            )
                            ELSE 0
                        END,
                        0
                    )
                ), 0) AS total_voice_seconds,
                COALESCE(SUM(ms.message_count), 0) AS total_message_count
            FROM (SELECT $1::BIGINT AS guild_id) guild
            LEFT JOIN config sc
            ON sc.guild_id = guild.guild_id
            LEFT JOIN tracked_users tu
            ON true
            LEFT JOIN member_stats ms
            ON ms.guild_id = guild.guild_id::TEXT
            AND ms.user_id = tu.user_id
            LEFT JOIN voice_sessions vs
            ON vs.guild_id = guild.guild_id::TEXT
            AND vs.user_id = tu.user_id
            GROUP BY
                sc.enabled,
                sc.leaderboard_channel_id,
                sc.daily_send_time,
                sc.last_daily_sent_at,
                sc.created_at;
        `, [
            guildId
        ]);

    return result.rows[0] || null;
}

module.exports = {
    disableStatsConfig,
    getStatsConfig,
    getStatsConfigSummary,
    isStatsEnabled,
    isValidDailySendTime,
    upsertStatsConfig
};

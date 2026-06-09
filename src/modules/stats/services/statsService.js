const { pool } =
    require('../../../database/db');

async function ensureMemberStats(guildId, userId) {
    await pool.query(`
        INSERT INTO member_stats (guild_id, user_id)
        VALUES ($1, $2)
        ON CONFLICT (guild_id, user_id)
        DO NOTHING;
    `, [
        guildId,
        userId
    ]);
}

async function incrementMessageCount(guildId, userId, amount = 1) {
    await pool.query(`
        INSERT INTO member_stats (
            guild_id,
            user_id,
            message_count
        )
        VALUES ($1, $2, $3)
        ON CONFLICT (guild_id, user_id)
        DO UPDATE SET
            message_count = member_stats.message_count + EXCLUDED.message_count,
            updated_at = NOW();
    `, [
        guildId,
        userId,
        amount
    ]);
}

async function addVoiceSeconds(guildId, userId, seconds) {
    const amount =
        Math.max(0, Math.floor(Number(seconds) || 0));

    if (amount <= 0) return;

    await pool.query(`
        INSERT INTO member_stats (
            guild_id,
            user_id,
            voice_seconds
        )
        VALUES ($1, $2, $3)
        ON CONFLICT (guild_id, user_id)
        DO UPDATE SET
            voice_seconds = member_stats.voice_seconds + EXCLUDED.voice_seconds,
            updated_at = NOW();
    `, [
        guildId,
        userId,
        amount
    ]);
}

async function adjustVoiceSeconds(guildId, userId, seconds) {
    await ensureMemberStats(guildId, userId);

    await pool.query(`
        UPDATE member_stats
        SET
            voice_seconds = GREATEST(0, voice_seconds + $3),
            updated_at = NOW()
        WHERE guild_id = $1
        AND user_id = $2;
    `, [
        guildId,
        userId,
        seconds
    ]);
}

async function setVoiceSeconds(guildId, userId, seconds) {
    await pool.query(`
        INSERT INTO member_stats (
            guild_id,
            user_id,
            voice_seconds
        )
        VALUES ($1, $2, GREATEST(0, $3::BIGINT))
        ON CONFLICT (guild_id, user_id)
        DO UPDATE SET
            voice_seconds = GREATEST(0, EXCLUDED.voice_seconds),
            updated_at = NOW();
    `, [
        guildId,
        userId,
        seconds
    ]);
}

async function adjustMessageCount(guildId, userId, amount) {
    await ensureMemberStats(guildId, userId);

    await pool.query(`
        UPDATE member_stats
        SET
            message_count = GREATEST(0, message_count + $3),
            updated_at = NOW()
        WHERE guild_id = $1
        AND user_id = $2;
    `, [
        guildId,
        userId,
        amount
    ]);
}

async function setMessageCount(guildId, userId, amount) {
    await pool.query(`
        INSERT INTO member_stats (
            guild_id,
            user_id,
            message_count
        )
        VALUES ($1, $2, GREATEST(0, $3::BIGINT))
        ON CONFLICT (guild_id, user_id)
        DO UPDATE SET
            message_count = GREATEST(0, EXCLUDED.message_count),
            updated_at = NOW();
    `, [
        guildId,
        userId,
        amount
    ]);
}

async function getMemberStats(guildId, userId) {
    const result =
        await pool.query(`
            SELECT
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
                    ) AS voice_seconds,
                COALESCE(ms.message_count, 0) AS message_count
            FROM (SELECT $1::VARCHAR AS guild_id, $2::VARCHAR AS user_id) target
            LEFT JOIN member_stats ms
            ON ms.guild_id = target.guild_id
            AND ms.user_id = target.user_id
            LEFT JOIN voice_sessions vs
            ON vs.guild_id = target.guild_id
            AND vs.user_id = target.user_id;
        `, [
            guildId,
            userId
        ]);

    return result.rows[0] || {
        voice_seconds: 0,
        message_count: 0
    };
}

async function getVoiceLeaderboard(guildId, limit = 10) {
    const result =
        await pool.query(`
            WITH tracked_users AS (
                SELECT user_id
                FROM member_stats
                WHERE guild_id = $1

                UNION

                SELECT user_id
                FROM voice_sessions
                WHERE guild_id = $1
                AND is_counting = true
            ),
            totals AS (
                SELECT
                    tu.user_id,
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
                        ) AS voice_seconds
                FROM tracked_users tu
                LEFT JOIN member_stats ms
                ON ms.guild_id = $1
                AND ms.user_id = tu.user_id
                LEFT JOIN voice_sessions vs
                ON vs.guild_id = $1
                AND vs.user_id = tu.user_id
            )
            SELECT user_id, voice_seconds
            FROM totals
            WHERE voice_seconds > 0
            ORDER BY voice_seconds DESC, user_id ASC
            LIMIT $2;
        `, [
            guildId,
            limit
        ]);

    return result.rows;
}

async function getMessageLeaderboard(guildId, limit = 10) {
    const result =
        await pool.query(`
            SELECT user_id, message_count
            FROM member_stats
            WHERE guild_id = $1
            AND message_count > 0
            ORDER BY message_count DESC, user_id ASC
            LIMIT $2;
        `, [
            guildId,
            limit
        ]);

    return result.rows;
}

module.exports = {
    addVoiceSeconds,
    adjustMessageCount,
    adjustVoiceSeconds,
    getMemberStats,
    getMessageLeaderboard,
    getVoiceLeaderboard,
    incrementMessageCount,
    setMessageCount,
    setVoiceSeconds
};

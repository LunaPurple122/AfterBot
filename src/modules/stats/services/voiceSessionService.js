const { pool } =
    require('../../../database/db');

const {
    isStatsEnabled
} = require('./statsConfigService');

function isVoiceCountingState(state) {
    return Boolean(
        state?.channelId &&
        !state.selfMute &&
        !state.serverMute
    );
}

function secondsBetween(date) {
    const startedAt =
        new Date(date).getTime();

    if (!Number.isFinite(startedAt)) {
        return 0;
    }

    return Math.max(
        0,
        Math.floor((Date.now() - startedAt) / 1000)
    );
}

async function getSession(guildId, userId) {
    const result =
        await pool.query(`
            SELECT *
            FROM voice_sessions
            WHERE guild_id = $1
            AND user_id = $2;
        `, [
            guildId,
            userId
        ]);

    return result.rows[0] || null;
}

async function upsertSession({
    guildId,
    userId,
    channelId,
    isCounting
}) {
    await pool.query(`
        INSERT INTO voice_sessions (
            guild_id,
            user_id,
            channel_id,
            started_at,
            is_counting
        )
        VALUES ($1, $2, $3, NOW(), $4)
        ON CONFLICT (guild_id, user_id)
        DO UPDATE SET
            channel_id = EXCLUDED.channel_id,
            started_at = NOW(),
            is_counting = EXCLUDED.is_counting,
            updated_at = NOW();
    `, [
        guildId,
        userId,
        channelId,
        isCounting
    ]);
}

async function updateSessionChannel(guildId, userId, channelId) {
    await pool.query(`
        UPDATE voice_sessions
        SET
            channel_id = $3,
            updated_at = NOW()
        WHERE guild_id = $1
        AND user_id = $2;
    `, [
        guildId,
        userId,
        channelId
    ]);
}

async function deleteSession(guildId, userId) {
    await pool.query(`
        DELETE FROM voice_sessions
        WHERE guild_id = $1
        AND user_id = $2;
    `, [
        guildId,
        userId
    ]);
}

async function stopCountingSession(session) {
    if (!session?.is_counting) {
        return;
    }

    const client =
        await pool.connect();

    try {
        await client.query('BEGIN');

        const result =
            await client.query(`
                SELECT started_at
                FROM voice_sessions
                WHERE guild_id = $1
                AND user_id = $2
                AND is_counting = true
                FOR UPDATE;
            `, [
                session.guild_id,
                session.user_id
            ]);

        const lockedSession =
            result.rows[0];

        if (!lockedSession) {
            await client.query('COMMIT');
            return;
        }

        const elapsedSeconds =
            secondsBetween(lockedSession.started_at);

        if (elapsedSeconds > 0) {
            await client.query(`
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
                session.guild_id,
                session.user_id,
                elapsedSeconds
            ]);
        }

        await client.query(`
            UPDATE voice_sessions
            SET
                started_at = NOW(),
                is_counting = false,
                updated_at = NOW()
            WHERE guild_id = $1
            AND user_id = $2;
        `, [
            session.guild_id,
            session.user_id
        ]);

        await client.query('COMMIT');

    } catch (error) {
        await client.query('ROLLBACK');
        throw error;

    } finally {
        client.release();
    }
}

async function handleVoiceStateUpdate(oldState, newState) {
    const member =
        newState.member || oldState.member;

    if (!member || member.user.bot || !member.guild) {
        return;
    }

    const guildId =
        member.guild.id;

    const userId =
        member.id;

    const newChannelId =
        newState.channelId;

    const shouldCount =
        isVoiceCountingState(newState);

    const session =
        await getSession(guildId, userId);

    if (!await isStatsEnabled(guildId)) {
        await stopCountingSession(session);
        await deleteSession(guildId, userId);
        return;
    }

    if (!newChannelId) {
        await stopCountingSession(session);
        await deleteSession(guildId, userId);
        return;
    }

    if (!shouldCount) {
        await stopCountingSession(session);
        await upsertSession({
            guildId,
            userId,
            channelId: newChannelId,
            isCounting: false
        });
        return;
    }

    if (!session || !session.is_counting) {
        await upsertSession({
            guildId,
            userId,
            channelId: newChannelId,
            isCounting: true
        });
        return;
    }

    if (session.channel_id !== newChannelId) {
        await updateSessionChannel(
            guildId,
            userId,
            newChannelId
        );
    }
}

async function recoverActiveVoiceSessions(client) {
    const sessionsResult =
        await pool.query(`
            SELECT *
            FROM voice_sessions;
        `);

    let recovered = 0;
    let removed = 0;

    for (const session of sessionsResult.rows) {
        const guild =
            client.guilds.cache.get(session.guild_id);

        const voiceState =
            guild?.voiceStates.cache.get(session.user_id);

        if (!await isStatsEnabled(session.guild_id)) {
            await deleteSession(
                session.guild_id,
                session.user_id
            );

            removed++;
            continue;
        }

        if (!voiceState?.channelId) {
            await deleteSession(
                session.guild_id,
                session.user_id
            );

            removed++;
            continue;
        }

        if (session.is_counting && isVoiceCountingState(voiceState)) {
            await stopCountingSession(session);
            recovered++;
        }

        await upsertSession({
            guildId: session.guild_id,
            userId: session.user_id,
            channelId: voiceState.channelId,
            isCounting: isVoiceCountingState(voiceState)
        });
    }

    if (recovered > 0 || removed > 0) {
        console.log(
            `✅ Sessions vocales récupérées: ${recovered}, supprimées: ${removed}`
        );
    }
}

async function stopGuildVoiceSessions(guildId) {
    const sessionsResult =
        await pool.query(`
            SELECT *
            FROM voice_sessions
            WHERE guild_id = $1;
        `, [
            guildId
        ]);

    for (const session of sessionsResult.rows) {
        await stopCountingSession(session);
    }

    await pool.query(`
        DELETE FROM voice_sessions
        WHERE guild_id = $1;
    `, [
        guildId
    ]);
}

module.exports = {
    handleVoiceStateUpdate,
    isVoiceCountingState,
    recoverActiveVoiceSessions,
    stopGuildVoiceSessions
};

const {
    EmbedBuilder,
    PermissionFlagsBits,
    PermissionsBitField
} = require('discord.js');

const { pool } =
    require('../../../database/db');

const inviteCache =
    new Map();

function cacheKey(guildId) {
    return String(guildId);
}

function getGuildCache(guildId) {
    return inviteCache.get(cacheKey(guildId)) || new Map();
}

function setGuildCache(guildId, invites) {
    const mapped =
        new Map();

    for (const invite of invites.values()) {
        mapped.set(
            invite.code,
            {
                code: invite.code,
                uses: Number(invite.uses || 0)
            }
        );
    }

    inviteCache.set(
        cacheKey(guildId),
        mapped
    );
}

function hasManageGuild(guild) {
    return Boolean(
        guild?.members?.me?.permissions?.has(
            PermissionFlagsBits.ManageGuild
        )
    );
}

function dateOrNull(value) {
    if (!value) return null;

    const date =
        value instanceof Date
            ? value
            : new Date(value);

    return Number.isNaN(date.getTime())
        ? null
        : date;
}

function inviteUrl(invite) {
    return invite.url ||
        `https://discord.gg/${invite.code}`;
}

function inviterUsername(invite) {
    return invite.inviter?.tag ||
        invite.inviter?.username ||
        null;
}

async function upsertConfig(guildId, values = {}) {
    const enabled =
        Object.prototype.hasOwnProperty.call(values, 'enabled')
            ? values.enabled
            : true;

    const logChannelId =
        Object.prototype.hasOwnProperty.call(values, 'logChannelId')
            ? values.logChannelId
            : null;

    await pool.query(`
        INSERT INTO invite_tracker_config (
            guild_id,
            enabled,
            log_channel_id,
            updated_at
        )
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (guild_id)
        DO UPDATE SET
            enabled = COALESCE(EXCLUDED.enabled, invite_tracker_config.enabled),
            log_channel_id = CASE
                WHEN $4::BOOLEAN THEN EXCLUDED.log_channel_id
                ELSE invite_tracker_config.log_channel_id
            END,
            updated_at = NOW();
    `, [
        guildId,
        enabled,
        logChannelId,
        Object.prototype.hasOwnProperty.call(values, 'logChannelId')
    ]);
}

async function getConfig(guildId) {
    const result =
        await pool.query(`
            SELECT *
            FROM invite_tracker_config
            WHERE guild_id = $1;
        `, [
            guildId
        ]);

    if (result.rows[0]) {
        return result.rows[0];
    }

    await upsertConfig(guildId, {
        enabled: true
    });

    return {
        guild_id: guildId,
        enabled: true,
        log_channel_id: null
    };
}

async function setEnabled(guildId, enabled) {
    await upsertConfig(guildId, {
        enabled
    });
}

async function setLogChannel(guildId, channelId) {
    await upsertConfig(guildId, {
        enabled: true,
        logChannelId: channelId
    });
}

async function resetConfig(guildId) {
    await pool.query(`
        DELETE FROM invite_tracker_config
        WHERE guild_id = $1;
    `, [
        guildId
    ]);
}

async function upsertInvite(guildId, invite, isActive = true) {
    await pool.query(`
        INSERT INTO invite_tracker_invites (
            guild_id,
            invite_code,
            invite_url,
            inviter_id,
            inviter_username,
            uses,
            max_uses,
            expires_at,
            discord_created_at,
            deleted_at,
            is_active,
            updated_at
        )
        VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8, $9,
            NULL, $10, NOW()
        )
        ON CONFLICT (guild_id, invite_code)
        DO UPDATE SET
            invite_url = EXCLUDED.invite_url,
            inviter_id = COALESCE(EXCLUDED.inviter_id, invite_tracker_invites.inviter_id),
            inviter_username = COALESCE(EXCLUDED.inviter_username, invite_tracker_invites.inviter_username),
            uses = EXCLUDED.uses,
            max_uses = EXCLUDED.max_uses,
            expires_at = EXCLUDED.expires_at,
            discord_created_at = COALESCE(EXCLUDED.discord_created_at, invite_tracker_invites.discord_created_at),
            deleted_at = NULL,
            is_active = EXCLUDED.is_active,
            updated_at = NOW();
    `, [
        guildId,
        invite.code,
        inviteUrl(invite),
        invite.inviter?.id || null,
        inviterUsername(invite),
        Number(invite.uses || 0),
        invite.maxUses || null,
        dateOrNull(invite.expiresAt),
        dateOrNull(invite.createdAt),
        isActive
    ]);
}

async function markInviteDeleted(guildId, code) {
    await pool.query(`
        UPDATE invite_tracker_invites
        SET
            deleted_at = NOW(),
            is_active = false,
            updated_at = NOW()
        WHERE guild_id = $1
        AND invite_code = $2;
    `, [
        guildId,
        code
    ]);
}

async function fetchGuildInvites(guild) {
    if (!hasManageGuild(guild)) {
        const error =
            new Error('Permission Manage Guild manquante.');

        error.code = 'MISSING_MANAGE_GUILD';
        throw error;
    }

    return guild.invites.fetch();
}

async function syncGuildInvites(guild) {
    const invites =
        await fetchGuildInvites(guild);

    const activeCodes = [];

    for (const invite of invites.values()) {
        activeCodes.push(invite.code);

        await upsertInvite(
            guild.id,
            invite,
            true
        );
    }

    await pool.query(`
        UPDATE invite_tracker_invites
        SET
            is_active = false,
            deleted_at = COALESCE(deleted_at, NOW()),
            updated_at = NOW()
        WHERE guild_id = $1
        AND is_active = true
        AND NOT (invite_code = ANY($2::TEXT[]));
    `, [
        guild.id,
        activeCodes
    ]);

    setGuildCache(
        guild.id,
        invites
    );

    return invites;
}

async function startInviteTracker(client) {
    for (const guild of client.guilds.cache.values()) {
        try {
            await getConfig(guild.id);

            if (!hasManageGuild(guild)) {
                console.error(
                    `Invite tracker: permission Manage Guild manquante sur ${guild.name} (${guild.id}).`
                );
                continue;
            }

            await syncGuildInvites(guild);

        } catch (error) {
            console.error(
                `Invite tracker: impossible de synchroniser ${guild.id}:`,
                error.message
            );
        }
    }

    console.log(
        'Invite tracker demarre'
    );
}

async function sendModuleLog(guild, payload) {
    const config =
        await getConfig(guild.id);

    if (!config.log_channel_id) {
        return;
    }

    let channel =
        guild.channels.cache.get(config.log_channel_id);

    if (!channel) {
        try {
            channel =
                await guild.channels.fetch(config.log_channel_id);
        } catch (error) {
            console.error(
                `Invite tracker: salon logs introuvable ${config.log_channel_id}.`,
                error.message
            );
            return;
        }
    }

    if (!channel?.isTextBased()) {
        return;
    }

    const permissions =
        channel.permissionsFor(guild.members.me);

    if (
        !permissions?.has(PermissionsBitField.Flags.ViewChannel) ||
        !permissions?.has(PermissionsBitField.Flags.SendMessages)
    ) {
        return;
    }

    await channel.send(payload);
}

function findUsedInvite(previousInvites, currentInvites) {
    for (const invite of currentInvites.values()) {
        const previous =
            previousInvites.get(invite.code);

        if (
            previous &&
            Number(invite.uses || 0) > Number(previous.uses || 0)
        ) {
            return invite;
        }
    }

    for (const invite of currentInvites.values()) {
        if (Number(invite.uses || 0) > 0) {
            const previous =
                previousInvites.get(invite.code);

            if (!previous) {
                return invite;
            }
        }
    }

    return null;
}

async function recordJoin(member, invite, detectionStatus) {
    await pool.query(`
        INSERT INTO invite_tracker_joins (
            guild_id,
            invited_user_id,
            invited_username,
            invite_code,
            inviter_id,
            joined_at,
            left_at,
            is_present,
            detection_status,
            updated_at
        )
        VALUES ($1, $2, $3, $4, $5, NOW(), NULL, true, $6, NOW())
        ON CONFLICT (guild_id, invited_user_id)
        DO UPDATE SET
            invited_username = EXCLUDED.invited_username,
            invite_code = EXCLUDED.invite_code,
            inviter_id = EXCLUDED.inviter_id,
            left_at = NULL,
            is_present = true,
            detection_status = EXCLUDED.detection_status,
            updated_at = NOW();
    `, [
        member.guild.id,
        member.id,
        member.user?.tag || member.user?.username || null,
        invite?.code || null,
        invite?.inviter?.id || null,
        detectionStatus
    ]);
}

async function handleMemberJoin(member) {
    const config =
        await getConfig(member.guild.id);

    if (!config.enabled) {
        return;
    }

    let currentInvites = null;
    let usedInvite = null;
    let detectionStatus = 'detected';

    try {
        currentInvites =
            await fetchGuildInvites(member.guild);

        const previousInvites =
            getGuildCache(member.guild.id);

        usedInvite =
            findUsedInvite(
                previousInvites,
                currentInvites
            );

        if (!usedInvite) {
            detectionStatus = 'unknown';
        }

        for (const invite of currentInvites.values()) {
            await upsertInvite(
                member.guild.id,
                invite,
                true
            );
        }

        setGuildCache(
            member.guild.id,
            currentInvites
        );

    } catch (error) {
        detectionStatus =
            error.code === 'MISSING_MANAGE_GUILD'
                ? 'missing_permission'
                : 'unknown';

        console.error(
            `Invite tracker: detection impossible pour ${member.id} sur ${member.guild.id}:`,
            error.message
        );
    }

    await recordJoin(
        member,
        usedInvite,
        detectionStatus
    );

    if (usedInvite?.inviter?.id) {
        await applyRewards(
            member.guild,
            usedInvite.inviter.id
        );
    }

    const embed =
        new EmbedBuilder()
            .setColor(usedInvite ? 0x57F287 : 0xFEE75C)
            .setTitle('Invite tracker - arrivee')
            .setDescription(
                usedInvite
                    ? `${member} a rejoint via \`${usedInvite.code}\` cree par <@${usedInvite.inviter.id}>.`
                    : `${member} a rejoint, mais le lien utilise est inconnu.`
            )
            .addFields({
                name: 'Statut detection',
                value: detectionStatus,
                inline: true
            })
            .setTimestamp();

    await sendModuleLog(
        member.guild,
        {
            embeds: [embed]
        }
    );
}

async function handleMemberLeave(member) {
    const result =
        await pool.query(`
            UPDATE invite_tracker_joins
            SET
                is_present = false,
                left_at = NOW(),
                updated_at = NOW()
            WHERE guild_id = $1
            AND invited_user_id = $2
            RETURNING *;
        `, [
            member.guild.id,
            member.id
        ]);

    const row =
        result.rows[0];

    if (!row) {
        return;
    }

    const embed =
        new EmbedBuilder()
            .setColor(0xED4245)
            .setTitle('Invite tracker - depart')
            .setDescription(
                `${member.user?.tag || member.id} a quitte le serveur.`
            )
            .addFields(
                {
                    name: 'Invite par',
                    value: row.inviter_id
                        ? `<@${row.inviter_id}>`
                        : 'Inconnu',
                    inline: true
                },
                {
                    name: 'Code',
                    value: row.invite_code
                        ? `\`${row.invite_code}\``
                        : 'Inconnu',
                    inline: true
                }
            )
            .setTimestamp();

    await sendModuleLog(
        member.guild,
        {
            embeds: [embed]
        }
    );
}

async function handleInviteCreate(invite) {
    await upsertInvite(
        invite.guild.id,
        invite,
        true
    );

    const cached =
        getGuildCache(invite.guild.id);

    cached.set(
        invite.code,
        {
            code: invite.code,
            uses: Number(invite.uses || 0)
        }
    );

    inviteCache.set(
        cacheKey(invite.guild.id),
        cached
    );
}

async function handleInviteDelete(invite) {
    await markInviteDeleted(
        invite.guild.id,
        invite.code
    );

    const cached =
        getGuildCache(invite.guild.id);

    cached.delete(invite.code);

    inviteCache.set(
        cacheKey(invite.guild.id),
        cached
    );
}

async function getInviteRows(guildId, userId = null) {
    const params =
        userId
            ? [guildId, userId]
            : [guildId];

    const result =
        await pool.query(`
            SELECT *
            FROM invite_tracker_invites
            WHERE guild_id = $1
            ${userId ? 'AND inviter_id = $2' : ''}
            ORDER BY created_at DESC, invite_code ASC;
        `, params);

    return result.rows;
}

async function getJoinInfo(guildId, userId) {
    const result =
        await pool.query(`
            SELECT
                j.*,
                i.inviter_username,
                i.invite_url
            FROM invite_tracker_joins j
            LEFT JOIN invite_tracker_invites i
            ON i.guild_id = j.guild_id
            AND i.invite_code = j.invite_code
            WHERE j.guild_id = $1
            AND j.invited_user_id = $2;
        `, [
            guildId,
            userId
        ]);

    return result.rows[0] || null;
}

async function getInvitedBy(guildId, inviterId, onlyLeft = false) {
    const result =
        await pool.query(`
            SELECT *
            FROM invite_tracker_joins
            WHERE guild_id = $1
            AND inviter_id = $2
            ${onlyLeft ? 'AND is_present = false' : ''}
            ORDER BY joined_at DESC;
        `, [
            guildId,
            inviterId
        ]);

    return result.rows;
}

async function getStats(guildId, userId) {
    const result =
        await pool.query(`
            SELECT
                (
                    SELECT COUNT(*)
                    FROM invite_tracker_invites
                    WHERE guild_id = $1
                    AND inviter_id = $2
                ) AS links_created,
                (
                    SELECT COUNT(*)
                    FROM invite_tracker_joins
                    WHERE guild_id = $1
                    AND inviter_id = $2
                ) AS total_invited,
                (
                    SELECT COUNT(*)
                    FROM invite_tracker_joins
                    WHERE guild_id = $1
                    AND inviter_id = $2
                    AND is_present = true
                ) AS active_invited,
                (
                    SELECT COUNT(*)
                    FROM invite_tracker_joins
                    WHERE guild_id = $1
                    AND inviter_id = $2
                    AND is_present = false
                ) AS left_invited,
                (
                    SELECT COUNT(*)
                    FROM invite_tracker_invites
                    WHERE guild_id = $1
                    AND inviter_id = $2
                    AND is_active = true
                    AND deleted_at IS NULL
                    AND (
                        expires_at IS NULL
                        OR expires_at > NOW()
                    )
                    AND (
                        max_uses IS NULL
                        OR max_uses = 0
                        OR uses < max_uses
                    )
                ) AS active_links;
        `, [
            guildId,
            userId
        ]);

    return result.rows[0];
}

async function getInviteInfo(guildId, code) {
    const result =
        await pool.query(`
            SELECT
                i.*,
                COUNT(j.id) AS joined_count
            FROM invite_tracker_invites i
            LEFT JOIN invite_tracker_joins j
            ON j.guild_id = i.guild_id
            AND j.invite_code = i.invite_code
            WHERE i.guild_id = $1
            AND i.invite_code = $2
            GROUP BY i.id;
        `, [
            guildId,
            code
        ]);

    return result.rows[0] || null;
}

async function getLeaderboard(guild, type = 'total') {
    const members =
        await guild.members.fetch();

    const result =
        await pool.query(`
            SELECT
                inviter_id,
                COUNT(*) FILTER (WHERE TRUE) AS total_count,
                COUNT(*) FILTER (WHERE is_present = true) AS active_count,
                COUNT(*) FILTER (
                    WHERE joined_at >= date_trunc('month', NOW())
                ) AS month_count
            FROM invite_tracker_joins
            WHERE guild_id = $1
            AND inviter_id IS NOT NULL
            GROUP BY inviter_id;
        `, [
            guild.id
        ]);

    const byUser =
        new Map();

    for (const row of result.rows) {
        byUser.set(
            row.inviter_id,
            {
                total: Number(row.total_count || 0),
                active: Number(row.active_count || 0),
                month: Number(row.month_count || 0)
            }
        );
    }

    const rows =
        members
            .filter(member => !member.user.bot)
            .map(member => {
                const stats =
                    byUser.get(member.id) || {
                        total: 0,
                        active: 0,
                        month: 0
                    };

                return {
                    userId: member.id,
                    username: member.user.tag,
                    total: stats.total,
                    active: stats.active,
                    month: stats.month,
                    value: stats[type] || 0
                };
            })
            .sort((a, b) =>
                b.value - a.value ||
                a.username.localeCompare(b.username)
            );

    return rows;
}

async function addReward(guildId, inviteCount, roleId) {
    await pool.query(`
        INSERT INTO invite_tracker_rewards (
            guild_id,
            invite_count,
            role_id
        )
        VALUES ($1, $2, $3)
        ON CONFLICT (guild_id, invite_count)
        DO UPDATE SET
            role_id = EXCLUDED.role_id;
    `, [
        guildId,
        inviteCount,
        roleId
    ]);
}

async function removeReward(guildId, inviteCount) {
    const result =
        await pool.query(`
            DELETE FROM invite_tracker_rewards
            WHERE guild_id = $1
            AND invite_count = $2;
        `, [
            guildId,
            inviteCount
        ]);

    return result.rowCount > 0;
}

async function listRewards(guildId) {
    const result =
        await pool.query(`
            SELECT *
            FROM invite_tracker_rewards
            WHERE guild_id = $1
            ORDER BY invite_count ASC;
        `, [
            guildId
        ]);

    return result.rows;
}

async function applyRewards(guild, inviterId) {
    const stats =
        await getStats(
            guild.id,
            inviterId
        );

    const activeCount =
        Number(stats?.active_invited || 0);

    const rewards =
        await listRewards(guild.id);

    if (rewards.length === 0) {
        return;
    }

    let member = null;

    try {
        member =
            await guild.members.fetch(inviterId);
    } catch (error) {
        return;
    }

    for (const reward of rewards) {
        if (activeCount < Number(reward.invite_count)) {
            continue;
        }

        if (member.roles.cache.has(reward.role_id)) {
            continue;
        }

        try {
            await member.roles.add(
                reward.role_id,
                'Invite tracker reward'
            );
        } catch (error) {
            console.error(
                `Invite tracker: role reward impossible ${reward.role_id} pour ${inviterId}:`,
                error.message
            );
        }
    }
}

module.exports = {
    addReward,
    applyRewards,
    getConfig,
    getInvitedBy,
    getInviteInfo,
    getInviteRows,
    getJoinInfo,
    getLeaderboard,
    getStats,
    handleInviteCreate,
    handleInviteDelete,
    handleMemberJoin,
    handleMemberLeave,
    hasManageGuild,
    listRewards,
    removeReward,
    resetConfig,
    setEnabled,
    setLogChannel,
    startInviteTracker,
    syncGuildInvites
};

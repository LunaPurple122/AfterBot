const {
    EmbedBuilder,
    PermissionFlagsBits
} = require('discord.js');

const { pool } =
    require('../../../database/db');

const { envoyerLog } =
    require('../../../core/logger');

const { botHasGuildPermission } =
    require('../../../core/permissions');

const DEFAULT_BAN_REASON =
    'Serveur reserve aux personnes majeures - role mineur detecte';

const DEFAULT_DM_MESSAGE =
    'Ce serveur est reserve aux personnes de 18 ans et plus. Un role indiquant que tu es mineur a ete detecte, tu vas donc etre banni du serveur.';

async function addMinorRole(guildId, roleId) {
    await pool.query(`
        INSERT INTO mineur_roles (guild_id, role_id)
        VALUES ($1, $2)
        ON CONFLICT (guild_id, role_id) DO NOTHING
    `, [guildId, roleId]);
}

async function removeMinorRole(guildId, roleId) {
    const result = await pool.query(`
        DELETE FROM mineur_roles
        WHERE guild_id = $1
        AND role_id = $2
    `, [guildId, roleId]);

    return result.rowCount > 0;
}

async function listMinorRoles(guildId) {
    const result = await pool.query(`
        SELECT role_id, created_at
        FROM mineur_roles
        WHERE guild_id = $1
        ORDER BY created_at ASC
    `, [guildId]);

    return result.rows;
}

async function getMinorRoleIds(guildId) {
    const rows =
        await listMinorRoles(guildId);

    return new Set(
        rows.map(row => row.role_id)
    );
}

async function getDmMessage(guildId) {
    const result = await pool.query(`
        SELECT dm_message
        FROM mineur_config
        WHERE guild_id = $1
    `, [guildId]);

    return result.rows[0]?.dm_message || '';
}

async function setDmMessage(guildId, dmMessage) {
    await pool.query(`
        INSERT INTO mineur_config (guild_id, dm_message)
        VALUES ($1, $2)
        ON CONFLICT (guild_id)
        DO UPDATE SET
            dm_message = EXCLUDED.dm_message,
            updated_at = CURRENT_TIMESTAMP
    `, [guildId, dmMessage]);
}

async function recordMinorBan({
    guildId,
    userId,
    username,
    reason
}) {
    await pool.query(`
        INSERT INTO mineur_bans (
            guild_id,
            user_id,
            username,
            ban_reason
        )
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (guild_id, user_id)
        DO UPDATE SET
            username = EXCLUDED.username,
            banned_at = CURRENT_TIMESTAMP,
            ban_reason = EXCLUDED.ban_reason
    `, [
        guildId,
        userId,
        username,
        reason
    ]);
}

async function listMinorBans(guildId) {
    const result = await pool.query(`
        SELECT user_id, username, banned_at
        FROM mineur_bans
        WHERE guild_id = $1
        ORDER BY banned_at DESC
    `, [guildId]);

    return result.rows;
}

async function getMinorBan(guildId, userId) {
    const result = await pool.query(`
        SELECT user_id, username, banned_at, ban_reason
        FROM mineur_bans
        WHERE guild_id = $1
        AND user_id = $2
    `, [guildId, userId]);

    return result.rows[0] || null;
}

async function deleteMinorBan(guildId, userId) {
    const result = await pool.query(`
        DELETE FROM mineur_bans
        WHERE guild_id = $1
        AND user_id = $2
    `, [guildId, userId]);

    return result.rowCount > 0;
}

async function memberCanManageMineur(member) {
    if (!member?.guild) return false;

    if (
        member.permissions.has(
            PermissionFlagsBits.Administrator
        )
    ) return true;

    try {
        const result = await pool.query(`
            SELECT staff_role_id
            FROM ticket_config
            WHERE serveur_id = $1
        `, [member.guild.id]);

        const staffRoleId =
            result.rows[0]?.staff_role_id;

        return Boolean(
            staffRoleId &&
            member.roles.cache.has(staffRoleId)
        );

    } catch (error) {
        console.error(
            'Impossible de verifier le role staff mineur :',
            error
        );

        return false;
    }
}

function isProtectedMember(member) {
    if (!member?.guild) return true;

    return (
        member.id === member.guild.ownerId ||
        member.id === member.client.user.id ||
        member.permissions.has(PermissionFlagsBits.Administrator)
    );
}

function canBotBanMember(member) {
    const botMember =
        member.guild.members.me;

    if (!botMember) return false;

    return (
        botMember.permissions.has(PermissionFlagsBits.BanMembers) &&
        member.roles.highest.position < botMember.roles.highest.position
    );
}

async function sendMinorDm(member, message) {
    try {
        await member.send({
            content:
                message?.trim() || DEFAULT_DM_MESSAGE
        });

        return true;

    } catch (error) {
        console.error(
            `Impossible d'envoyer le MP mineur a ${member.id} :`,
            error
        );

        return false;
    }
}

async function logMinorBan({
    client,
    guild,
    member,
    triggerRole,
    dmSent,
    success,
    errorMessage
}) {
    try {
        const embedTitle =
            success
                ? 'Ban automatique mineur'
                : 'Echec ban automatique mineur';

        await envoyerLog(client, guild.id, {
            type: 'punisher',
            titre: embedTitle,
            description:
`Utilisateur :
${member.user} (${member.user.tag})

ID :
${member.id}

Role declencheur :
${triggerRole ? `${triggerRole} (${triggerRole.id})` : 'Inconnu'}

Date :
${new Date().toLocaleString('fr-FR')}

MP :
${dmSent ? 'Envoye' : 'Echec'}

Statut :
${success ? 'Ban effectue' : `Erreur - ${errorMessage || 'raison inconnue'}`}`,
            couleur: success ? 0xED4245 : 0xFEE75C,
            auteur: member.user
        });

    } catch (error) {
        console.error(
            `Impossible d'envoyer le log mineur pour ${member.id} :`,
            error
        );
    }
}

async function logMinorUnban({
    client,
    guild,
    userId,
    username,
    moderator,
    wasBanned,
    unbanSuccess,
    deleteSuccess,
    errorMessage
}) {
    try {
        await envoyerLog(client, guild.id, {
            type: 'punisher',
            titre: 'Retrait ban mineur',
            description:
`Utilisateur :
${username || 'Inconnu'}

ID :
${userId}

Administrateur :
${moderator}

Debannissement Discord :
${wasBanned ? (unbanSuccess ? 'Effectue' : 'Echec') : 'Utilisateur deja debanni'}

Suppression mineur_bans :
${deleteSuccess ? 'Effectuee' : 'Echec'}

${errorMessage ? `Erreur :\n${errorMessage}` : 'Aucune erreur.'}`,
            couleur: unbanSuccess || !wasBanned ? 0x57F287 : 0xFEE75C,
            auteur: moderator
        });

    } catch (error) {
        console.error(
            `Impossible d'envoyer le log de retrait mineur pour ${userId} :`,
            error
        );
    }
}

async function sendMinorUnbanDm(client, userId, guildName) {
    try {
        const user =
            await client.users.fetch(userId);

        await user.send({
            content:
                `Tu as ete debanni de ${guildName}. Tu peux a nouveau rejoindre le serveur.`
        });

        return true;

    } catch (error) {
        console.error(
            `Impossible d'envoyer le MP de deban mineur a ${userId} :`,
            error
        );

        return false;
    }
}

async function removeMinorBanEntry({
    guild,
    userId,
    moderator
}) {
    const entry =
        await getMinorBan(
            guild.id,
            userId
        );

    if (!entry) {
        return {
            status: 'not_found'
        };
    }

    let ban = null;
    let wasBanned = false;
    let unbanSuccess = false;
    let unbanError = null;
    let deleteSuccess = false;

    try {
        ban =
            await guild.bans.fetch(userId);

        wasBanned = Boolean(ban);

    } catch (error) {
        wasBanned = false;
    }

    if (wasBanned) {
        try {
            await guild.members.unban(
                userId,
                `Retrait du systeme mineur par ${moderator.tag}`
            );

            unbanSuccess = true;

            await sendMinorUnbanDm(
                guild.client,
                userId,
                guild.name
            );

        } catch (error) {
            unbanError =
                error;

            console.error(
                `Impossible de debannir ${userId} via le module mineur :`,
                error
            );
        }
    }

    try {
        deleteSuccess =
            await deleteMinorBan(
                guild.id,
                userId
            );

    } catch (error) {
        console.error(
            `Impossible de supprimer l'entree mineur_bans ${userId} :`,
            error
        );

        throw error;
    }

    await logMinorUnban({
        client: guild.client,
        guild,
        userId,
        username: ban?.user?.tag || entry.username,
        moderator,
        wasBanned,
        unbanSuccess,
        deleteSuccess,
        errorMessage: unbanError?.message || null
    });

    if (!wasBanned) {
        return {
            status: 'already_unbanned'
        };
    }

    if (!unbanSuccess) {
        return {
            status: 'unban_failed',
            error: unbanError?.message || 'erreur inconnue'
        };
    }

    return {
        status: 'removed'
    };
}

async function executeMinorBan(member, triggerRole, options = {}) {
    const guild =
        member.guild;

    const reason =
        options.reason || DEFAULT_BAN_REASON;

    let dmSent = false;

    if (
        !botHasGuildPermission(
            guild,
            PermissionFlagsBits.BanMembers
        )
    ) {
        return {
            success: false,
            dmSent,
            error: 'Permission Ban Members manquante.'
        };
    }

    if (isProtectedMember(member)) {
        return {
            success: false,
            dmSent,
            error: 'Membre protege.'
        };
    }

    if (!canBotBanMember(member)) {
        return {
            success: false,
            dmSent,
            error: 'Role du bot trop bas.'
        };
    }

    const dmMessage =
        await getDmMessage(guild.id);

    dmSent =
        await sendMinorDm(
            member,
            dmMessage
        );

    try {
        await guild.members.ban(member.id, {
            reason
        });

        try {
            await recordMinorBan({
                guildId: guild.id,
                userId: member.id,
                username: member.user.tag,
                reason
            });

        } catch (error) {
            console.error(
                `Ban mineur effectue mais non enregistre pour ${member.id} :`,
                error
            );
        }

        await logMinorBan({
            client: member.client,
            guild,
            member,
            triggerRole,
            dmSent,
            success: true
        });

        return {
            success: true,
            dmSent
        };

    } catch (error) {
        console.error(
            `Impossible de bannir le mineur ${member.id} :`,
            error
        );

        await logMinorBan({
            client: member.client,
            guild,
            member,
            triggerRole,
            dmSent,
            success: false,
            errorMessage: error.message
        });

        return {
            success: false,
            dmSent,
            error: error.message
        };
    }
}

function buildBanListEmbed(rows, page, pageSize) {
    const totalPages =
        Math.max(
            1,
            Math.ceil(rows.length / pageSize)
        );

    const start =
        page * pageSize;

    const pageRows =
        rows.slice(
            start,
            start + pageSize
        );

    const description =
        pageRows.length === 0
            ? 'Aucun membre banni via ce systeme.'
            : pageRows.map(row => {
                const date =
                    row.banned_at
                        ? new Date(row.banned_at).toLocaleString('fr-FR')
                        : 'Date inconnue';

                return `**${row.username || 'Utilisateur inconnu'}**\nID: \`${row.user_id}\`\nDate: ${date}`;
            }).join('\n\n');

    return new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('Bans mineurs')
        .setDescription(description)
        .setFooter({
            text:
                `Page ${page + 1}/${totalPages} - ${rows.length} entree(s)`
        })
        .setTimestamp();
}

module.exports = {
    DEFAULT_BAN_REASON,
    addMinorRole,
    buildBanListEmbed,
    executeMinorBan,
    getDmMessage,
    getMinorRoleIds,
    listMinorBans,
    listMinorRoles,
    memberCanManageMineur,
    removeMinorBanEntry,
    removeMinorRole,
    setDmMessage
};

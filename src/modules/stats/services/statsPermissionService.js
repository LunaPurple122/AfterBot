const { PermissionFlagsBits } =
    require('discord.js');

const { pool } =
    require('../../../database/db');

function isGuildAdmin(member) {
    return Boolean(
        member?.permissions?.has(
            PermissionFlagsBits.Administrator
        )
    );
}

async function canManageStats(member) {
    if (isGuildAdmin(member)) {
        return true;
    }

    if (!member?.guild) {
        return false;
    }

    const result =
        await pool.query(`
            SELECT role_id
            FROM stats_admin_roles
            WHERE guild_id = $1;
        `, [
            member.guild.id
        ]);

    return result.rows.some(row =>
        member.roles.cache.has(row.role_id)
    );
}

async function addStatsAdminRole(guildId, roleId) {
    await pool.query(`
        INSERT INTO stats_admin_roles (guild_id, role_id)
        VALUES ($1, $2)
        ON CONFLICT (guild_id, role_id)
        DO NOTHING;
    `, [
        guildId,
        roleId
    ]);
}

async function removeStatsAdminRole(guildId, roleId) {
    await pool.query(`
        DELETE FROM stats_admin_roles
        WHERE guild_id = $1
        AND role_id = $2;
    `, [
        guildId,
        roleId
    ]);
}

async function listStatsAdminRoles(guildId) {
    const result =
        await pool.query(`
            SELECT role_id
            FROM stats_admin_roles
            WHERE guild_id = $1
            ORDER BY created_at ASC;
        `, [
            guildId
        ]);

    return result.rows;
}

module.exports = {
    addStatsAdminRole,
    canManageStats,
    isGuildAdmin,
    listStatsAdminRoles,
    removeStatsAdminRole
};

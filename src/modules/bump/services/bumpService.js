const {
    ChannelType,
    PermissionFlagsBits,
    PermissionsBitField
} = require('discord.js');

const { pool } =
    require('../../../database/db');

const TWO_HOURS_MS =
    2 * 60 * 60 * 1000;

const FOUR_HOURS_MS =
    4 * 60 * 60 * 1000;

const MAX_TIMEOUT_MS =
    2 ** 31 - 1;

const timers =
    new Map();

let schedulerStarted = false;
let sweepInterval = null;

function getTimerKey(guildId, reminderType) {
    return `${guildId}:${reminderType}`;
}

function clearReminderTimer(guildId, reminderType) {
    const key =
        getTimerKey(guildId, reminderType);

    const timer =
        timers.get(key);

    if (timer) {
        clearTimeout(timer);
        timers.delete(key);
    }
}

function clearGuildReminderTimers(guildId) {
    clearReminderTimer(guildId, '2h');
    clearReminderTimer(guildId, '4h');
}

function isAdmin(member) {
    return member?.permissions?.has(
        PermissionFlagsBits.Administrator
    );
}

async function getBumpConfig(guildId) {
    const result =
        await pool.query(`
            SELECT *
            FROM bump_config
            WHERE guild_id = $1;
        `, [
            guildId
        ]);

    return result.rows[0] || null;
}

async function upsertBumpChannel(guildId, channelId) {
    await pool.query(`
        INSERT INTO bump_config (
            guild_id,
            channel_id,
            updated_at
        )
        VALUES ($1, $2, NOW())
        ON CONFLICT (guild_id)
        DO UPDATE SET
            channel_id = EXCLUDED.channel_id,
            updated_at = NOW();
    `, [
        guildId,
        channelId
    ]);
}

async function upsertBumpMessage(guildId, reminderType, message) {
    const column =
        reminderType === '2h'
            ? 'message_2h'
            : 'message_4h';

    await pool.query(`
        INSERT INTO bump_config (
            guild_id,
            ${column},
            updated_at
        )
        VALUES ($1, $2, NOW())
        ON CONFLICT (guild_id)
        DO UPDATE SET
            ${column} = EXCLUDED.${column},
            updated_at = NOW();
    `, [
        guildId,
        message
    ]);
}

async function addRole(tableName, guildId, roleId) {
    await pool.query(`
        INSERT INTO ${tableName} (
            guild_id,
            role_id
        )
        VALUES ($1, $2)
        ON CONFLICT (guild_id, role_id)
        DO NOTHING;
    `, [
        guildId,
        roleId
    ]);
}

async function removeRole(tableName, guildId, roleId) {
    const result =
        await pool.query(`
            DELETE FROM ${tableName}
            WHERE guild_id = $1
            AND role_id = $2
            RETURNING role_id;
        `, [
            guildId,
            roleId
        ]);

    return result.rowCount > 0;
}

async function listRoles(tableName, guildId) {
    const result =
        await pool.query(`
            SELECT role_id
            FROM ${tableName}
            WHERE guild_id = $1
            ORDER BY created_at ASC;
        `, [
            guildId
        ]);

    return result.rows.map(row => row.role_id);
}

function addAllowedRole(guildId, roleId) {
    return addRole('bump_allowed_roles', guildId, roleId);
}

function removeAllowedRole(guildId, roleId) {
    return removeRole('bump_allowed_roles', guildId, roleId);
}

function listAllowedRoles(guildId) {
    return listRoles('bump_allowed_roles', guildId);
}

function addPingRole(guildId, roleId) {
    return addRole('bump_ping_roles', guildId, roleId);
}

function removePingRole(guildId, roleId) {
    return removeRole('bump_ping_roles', guildId, roleId);
}

function listPingRoles(guildId) {
    return listRoles('bump_ping_roles', guildId);
}

async function canUseBumpOk(member) {
    if (isAdmin(member)) {
        return true;
    }

    const allowedRoles =
        await listAllowedRoles(member.guild.id);

    return allowedRoles.some(roleId =>
        member.roles.cache.has(roleId)
    );
}

async function canManageBump(member) {
    if (isAdmin(member)) {
        return true;
    }

    return canUseBumpOk(member);
}

async function createOrReplaceReminders(guildId, userId) {
    const dueAt2h =
        new Date(Date.now() + TWO_HOURS_MS);

    const dueAt4h =
        new Date(Date.now() + FOUR_HOURS_MS);

    await pool.query('BEGIN');

    try {
        await pool.query(`
            DELETE FROM bump_reminders
            WHERE guild_id = $1;
        `, [
            guildId
        ]);

        await pool.query(`
            INSERT INTO bump_reminders (
                guild_id,
                reminder_type,
                due_at,
                created_by
            )
            VALUES
                ($1, '2h', $2, $4),
                ($1, '4h', $3, $4);
        `, [
            guildId,
            dueAt2h,
            dueAt4h,
            userId
        ]);

        await pool.query('COMMIT');

    } catch (error) {
        await pool.query('ROLLBACK');
        throw error;
    }

    return [
        {
            guild_id: guildId,
            reminder_type: '2h',
            due_at: dueAt2h
        },
        {
            guild_id: guildId,
            reminder_type: '4h',
            due_at: dueAt4h
        }
    ];
}

async function claimReminder(guildId, reminderType) {
    const result =
        await pool.query(`
            DELETE FROM bump_reminders
            WHERE guild_id = $1
            AND reminder_type = $2
            AND due_at <= NOW()
            RETURNING *;
        `, [
            guildId,
            reminderType
        ]);

    return result.rows[0] || null;
}

async function getActiveReminders() {
    const result =
        await pool.query(`
            SELECT *
            FROM bump_reminders
            ORDER BY due_at ASC;
        `);

    return result.rows;
}

async function sendReminder(client, reminder) {
    const claimed =
        await claimReminder(
            reminder.guild_id,
            reminder.reminder_type
        );

    if (!claimed) {
        return;
    }

    const guild =
        client.guilds.cache.get(claimed.guild_id);

    if (!guild) {
        console.error(
            `Bump: serveur introuvable ${claimed.guild_id}.`
        );
        return;
    }

    const config =
        await getBumpConfig(guild.id);

    if (!config?.channel_id) {
        console.error(
            `Bump: salon non configuré sur ${guild.id}.`
        );
        return;
    }

    const message =
        claimed.reminder_type === '2h'
            ? config.message_2h
            : config.message_4h;

    if (!message) {
        console.error(
            `Bump: message ${claimed.reminder_type} non configuré sur ${guild.id}.`
        );
        return;
    }

    let channel =
        guild.channels.cache.get(config.channel_id);

    if (!channel) {
        try {
            channel =
                await guild.channels.fetch(config.channel_id);
        } catch (error) {
            console.error(
                `Bump: salon introuvable ${config.channel_id} sur ${guild.id}.`,
                error
            );
            return;
        }
    }

    if (!channel || !channel.isTextBased()) {
        console.error(
            `Bump: salon invalide ${config.channel_id} sur ${guild.id}.`
        );
        return;
    }

    const permissions =
        channel.permissionsFor(guild.members.me);

    if (
        !permissions ||
        !permissions.has(PermissionsBitField.Flags.ViewChannel) ||
        !permissions.has(PermissionsBitField.Flags.SendMessages)
    ) {
        console.error(
            `Bump: permissions insuffisantes dans ${channel.id} sur ${guild.id}.`
        );
        return;
    }

    const pingRoleIds =
        await listPingRoles(guild.id);

    const mentions =
        pingRoleIds
            .filter(roleId =>
                guild.roles.cache.has(roleId)
            )
            .map(roleId =>
                `<@&${roleId}>`
            );

    await channel.send({
        content:
            [
                mentions.join(' '),
                message
            ]
                .filter(Boolean)
                .join('\n'),
        allowedMentions: {
            roles:
                pingRoleIds.filter(roleId =>
                    guild.roles.cache.has(roleId)
                )
        }
    });
}

function scheduleReminder(client, reminder) {
    clearReminderTimer(
        reminder.guild_id,
        reminder.reminder_type
    );

    const dueAt =
        new Date(reminder.due_at).getTime();

    const delay =
        Math.max(0, dueAt - Date.now());

    const timeoutDelay =
        Math.min(delay, MAX_TIMEOUT_MS);

    const key =
        getTimerKey(
            reminder.guild_id,
            reminder.reminder_type
        );

    const timer =
        setTimeout(() => {
            timers.delete(key);

            if (delay > MAX_TIMEOUT_MS) {
                scheduleReminder(client, reminder);
                return;
            }

            sendReminder(client, reminder).catch(error => {
                console.error(
                    `Bump: erreur rappel ${reminder.reminder_type} sur ${reminder.guild_id}:`,
                    error
                );
            });
        }, timeoutDelay);

    timers.set(key, timer);
}

async function startBumpReminders(client) {
    if (schedulerStarted) {
        return;
    }

    schedulerStarted = true;

    const reminders =
        await getActiveReminders();

    for (const reminder of reminders) {
        scheduleReminder(client, reminder);
    }

    sweepInterval =
        setInterval(() => {
            getActiveReminders()
                .then(activeReminders => {
                    for (const reminder of activeReminders) {
                        const key =
                            getTimerKey(
                                reminder.guild_id,
                                reminder.reminder_type
                            );

                        if (!timers.has(key)) {
                            scheduleReminder(client, reminder);
                        }
                    }
                })
                .catch(error => {
                    console.error(
                        'Bump: erreur reprise timers:',
                        error
                    );
                });
        }, 60 * 1000);

    console.log(
        '✅ Scheduler bump démarré'
    );
}

async function launchBumpReminders(client, guildId, userId) {
    clearGuildReminderTimers(guildId);

    const reminders =
        await createOrReplaceReminders(guildId, userId);

    for (const reminder of reminders) {
        scheduleReminder(client, reminder);
    }
}

function isSupportedReminderChannel(channel) {
    return (
        channel &&
        (
            channel.type === ChannelType.GuildText ||
            channel.type === ChannelType.GuildAnnouncement
        )
    );
}

module.exports = {
    addAllowedRole,
    addPingRole,
    canManageBump,
    canUseBumpOk,
    getBumpConfig,
    isSupportedReminderChannel,
    launchBumpReminders,
    listAllowedRoles,
    listPingRoles,
    removeAllowedRole,
    removePingRole,
    startBumpReminders,
    upsertBumpChannel,
    upsertBumpMessage
};

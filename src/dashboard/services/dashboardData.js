const { pool } = require('../../database/db');

async function tableExists(tableName) {
    const result = await pool.query(
        `
        SELECT EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = $1
        ) AS exists;
        `,
        [tableName]
    );

    return result.rows[0]?.exists === true;
}

async function columnExists(tableName, columnName) {
    const result = await pool.query(
        `
        SELECT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = $1
            AND column_name = $2
        ) AS exists;
        `,
        [tableName, columnName]
    );

    return result.rows[0]?.exists === true;
}

async function getDbOwnerId(guildId) {
    if (!await columnExists('serveurs', 'owner_id')) return null;

    const result = await pool.query(
        'SELECT owner_id FROM serveurs WHERE serveur_id = $1;',
        [guildId]
    );

    return result.rows[0]?.owner_id || null;
}

async function getServerConfig(guildId, guildName = null) {
    const result = await pool.query(
        `
        INSERT INTO serveurs (serveur_id, nom)
        VALUES ($1, $2)
        ON CONFLICT (serveur_id)
        DO UPDATE SET
            nom = COALESCE(EXCLUDED.nom, serveurs.nom),
            modifie_le = CURRENT_TIMESTAMP
        RETURNING *;
        `,
        [guildId, guildName]
    );

    return result.rows[0];
}

async function updateServerConfig(guildId, values) {
    await getServerConfig(guildId);

    await pool.query(
        `
        UPDATE serveurs
        SET
            salon_logs_id = NULLIF($1, ''),
            salon_bienvenue_id = NULLIF($2, ''),
            salon_depart_id = NULLIF($3, ''),
            salon_radio_id = NULLIF($4, ''),
            automod_actif = $5,
            captcha_actif = $6,
            role_non_verifie_id = NULLIF($7, ''),
            role_membre_id = NULLIF($8, ''),
            categorie_captcha_id = NULLIF($9, ''),
            role_reglement_id = NULLIF($10, ''),
            texte_reglement = NULLIF($11, ''),
            modifie_le = CURRENT_TIMESTAMP
        WHERE serveur_id = $12;
        `,
        [
            values.salon_logs_id,
            values.salon_bienvenue_id,
            values.salon_depart_id,
            values.salon_radio_id,
            values.automod_actif,
            values.captcha_actif,
            values.role_non_verifie_id,
            values.role_membre_id,
            values.categorie_captcha_id,
            values.role_reglement_id,
            values.texte_reglement,
            guildId
        ]
    );
}

async function updateServerFields(guildId, values) {
    const current = await getServerConfig(guildId);

    await updateServerConfig(guildId, {
        salon_logs_id: values.salon_logs_id ?? current.salon_logs_id,
        salon_bienvenue_id: values.salon_bienvenue_id ?? current.salon_bienvenue_id,
        salon_depart_id: values.salon_depart_id ?? current.salon_depart_id,
        salon_radio_id: values.salon_radio_id ?? current.salon_radio_id,
        automod_actif: values.automod_actif ?? current.automod_actif,
        captcha_actif: values.captcha_actif ?? current.captcha_actif,
        role_non_verifie_id: values.role_non_verifie_id ?? current.role_non_verifie_id,
        role_membre_id: values.role_membre_id ?? current.role_membre_id,
        categorie_captcha_id: values.categorie_captcha_id ?? current.categorie_captcha_id,
        role_reglement_id: values.role_reglement_id ?? current.role_reglement_id,
        texte_reglement: values.texte_reglement ?? current.texte_reglement
    });
}

async function getAutomodConfig(guildId) {
    if (!await tableExists('automod_config')) return null;

    const result = await pool.query(
        'SELECT * FROM automod_config WHERE serveur_id = $1;',
        [guildId]
    );

    return result.rows[0] || {
        serveur_id: guildId,
        anti_spam_enabled: true,
        spam_message_limit: 5,
        spam_interval: 5,
        spam_timeout_minutes: 5,
        anti_mass_mention_enabled: true,
        mass_mention_limit: 5,
        mass_mention_timeout_minutes: 5,
        anti_scam_links_enabled: true,
        anti_raid_join_enabled: true,
        raid_join_limit: 10,
        raid_join_interval: 10,
        raid_join_action: 'lockdown',
        raid_lockdown_minutes: 10,
        logs_channel_id: null
    };
}

async function updateAutomodConfig(guildId, values) {
    await pool.query(
        `
        INSERT INTO automod_config (
            serveur_id,
            anti_spam_enabled,
            spam_message_limit,
            spam_interval,
            spam_timeout_minutes,
            anti_mass_mention_enabled,
            mass_mention_limit,
            mass_mention_timeout_minutes,
            anti_scam_links_enabled,
            anti_raid_join_enabled,
            raid_join_limit,
            raid_join_interval,
            raid_join_action,
            raid_lockdown_minutes,
            logs_channel_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NULLIF($15, ''))
        ON CONFLICT (serveur_id)
        DO UPDATE SET
            anti_spam_enabled = EXCLUDED.anti_spam_enabled,
            spam_message_limit = EXCLUDED.spam_message_limit,
            spam_interval = EXCLUDED.spam_interval,
            spam_timeout_minutes = EXCLUDED.spam_timeout_minutes,
            anti_mass_mention_enabled = EXCLUDED.anti_mass_mention_enabled,
            mass_mention_limit = EXCLUDED.mass_mention_limit,
            mass_mention_timeout_minutes = EXCLUDED.mass_mention_timeout_minutes,
            anti_scam_links_enabled = EXCLUDED.anti_scam_links_enabled,
            anti_raid_join_enabled = EXCLUDED.anti_raid_join_enabled,
            raid_join_limit = EXCLUDED.raid_join_limit,
            raid_join_interval = EXCLUDED.raid_join_interval,
            raid_join_action = EXCLUDED.raid_join_action,
            raid_lockdown_minutes = EXCLUDED.raid_lockdown_minutes,
            logs_channel_id = EXCLUDED.logs_channel_id;
        `,
        [
            guildId,
            values.anti_spam_enabled,
            values.spam_message_limit,
            values.spam_interval,
            values.spam_timeout_minutes,
            values.anti_mass_mention_enabled,
            values.mass_mention_limit,
            values.mass_mention_timeout_minutes,
            values.anti_scam_links_enabled,
            values.anti_raid_join_enabled,
            values.raid_join_limit,
            values.raid_join_interval,
            values.raid_join_action,
            values.raid_lockdown_minutes,
            values.logs_channel_id
        ]
    );
}

async function getLogsConfig(guildId) {
    const server = await getServerConfig(guildId);
    const automod = await getAutomodConfig(guildId);
    return {
        salon_logs_id: server.salon_logs_id,
        automod_logs_channel_id: automod?.logs_channel_id || null
    };
}

async function updateLogsConfig(guildId, values) {
    await pool.query(
        `
        UPDATE serveurs
        SET salon_logs_id = NULLIF($1, ''),
            modifie_le = CURRENT_TIMESTAMP
        WHERE serveur_id = $2;
        `,
        [values.salon_logs_id, guildId]
    );

    if (await tableExists('automod_config')) {
        const current = await getAutomodConfig(guildId);
        await updateAutomodConfig(guildId, {
            ...current,
            logs_channel_id: values.automod_logs_channel_id
        });
    }
}

async function getRolemenus(guildId) {
    if (!await tableExists('rolemenus')) return [];

    const result = await pool.query(
        `
        SELECT rm.*,
            COUNT(rr.id) AS roles_count
        FROM rolemenus rm
        LEFT JOIN rolemenu_roles rr
            ON rr.rolemenu_id = rm.id
        WHERE rm.guild_id = $1
        GROUP BY rm.id
        ORDER BY rm.modifie_le DESC NULLS LAST, rm.id DESC;
        `,
        [guildId]
    );

    return result.rows;
}

async function getTicketsSummary(guildId) {
    const config = await tableExists('ticket_config')
        ? (await pool.query(
            'SELECT * FROM ticket_config WHERE serveur_id = $1;',
            [guildId]
        )).rows[0] || null
        : null;

    const tickets = await tableExists('tickets')
        ? (await pool.query(
            `
            SELECT ouvert, COUNT(*)::INTEGER AS total
            FROM tickets
            WHERE serveur_id = $1
            GROUP BY ouvert;
            `,
            [guildId]
        )).rows
        : [];

    return { config, tickets };
}

async function getTicketConfig(guildId) {
    if (!await tableExists('ticket_config')) return null;

    const result = await pool.query(
        'SELECT * FROM ticket_config WHERE serveur_id = $1;',
        [guildId]
    );

    return result.rows[0] || {
        serveur_id: guildId,
        panel_channel_id: null,
        staff_role_id: null,
        category_id: null,
        logs_channel_id: null,
        alert_channel_id: null,
        alert_message: null
    };
}

async function updateTicketConfig(guildId, values) {
    await pool.query(
        `
        INSERT INTO ticket_config (
            serveur_id,
            panel_channel_id,
            staff_role_id,
            category_id,
            logs_channel_id,
            alert_channel_id,
            alert_message
        )
        VALUES ($1, NULLIF($2, ''), NULLIF($3, ''), NULLIF($4, ''), NULLIF($5, ''), NULLIF($6, ''), NULLIF($7, ''))
        ON CONFLICT (serveur_id)
        DO UPDATE SET
            panel_channel_id = EXCLUDED.panel_channel_id,
            staff_role_id = EXCLUDED.staff_role_id,
            category_id = EXCLUDED.category_id,
            logs_channel_id = EXCLUDED.logs_channel_id,
            alert_channel_id = EXCLUDED.alert_channel_id,
            alert_message = EXCLUDED.alert_message;
        `,
        [
            guildId,
            values.panel_channel_id,
            values.staff_role_id,
            values.category_id,
            values.logs_channel_id,
            values.alert_channel_id,
            values.alert_message
        ]
    );
}

async function getTicketPingRoles(guildId) {
    if (!await tableExists('ticket_ping_roles')) return [];

    const result = await pool.query(
        `
        SELECT role_id
        FROM ticket_ping_roles
        WHERE serveur_id = $1
        ORDER BY id ASC;
        `,
        [guildId]
    );

    return result.rows;
}

async function replaceTicketPingRoles(guildId, roleIds) {
    const uniqueRoleIds = [...new Set((roleIds || []).filter(Boolean))];
    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        await client.query('DELETE FROM ticket_ping_roles WHERE serveur_id = $1;', [guildId]);

        for (const roleId of uniqueRoleIds) {
            await client.query(
                `
                INSERT INTO ticket_ping_roles (serveur_id, role_id)
                VALUES ($1, $2)
                ON CONFLICT (serveur_id, role_id)
                DO NOTHING;
                `,
                [guildId, roleId]
            );
        }

        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

async function getTexts(guildId) {
    const server = await getServerConfig(guildId);
    const ticketConfig = await tableExists('ticket_config')
        ? (await pool.query(
            'SELECT alert_message FROM ticket_config WHERE serveur_id = $1;',
            [guildId]
        )).rows[0] || null
        : null;

    return {
        texte_reglement: server.texte_reglement,
        ticket_alert_message: ticketConfig?.alert_message || null
    };
}

async function updateTexts(guildId, values) {
    await updateServerFields(guildId, {
        texte_reglement: values.texte_reglement
    });

    if (await tableExists('ticket_config')) {
        const current = await getTicketConfig(guildId);

        await updateTicketConfig(guildId, {
            ...current,
            alert_message: values.ticket_alert_message
        });
    }
}

async function getWarnings(guildId) {
    if (!await tableExists('warns')) return [];

    const result = await pool.query(
        `
        SELECT *
        FROM warns
        WHERE serveur_id = $1
        ORDER BY cree_le DESC
        LIMIT 50;
        `,
        [guildId]
    );

    return result.rows;
}

async function getStatsSummary(guildId) {
    const memberStats = await tableExists('member_stats')
        ? (await pool.query(
            `
            SELECT
                COUNT(*)::INTEGER AS tracked_members,
                COALESCE(SUM(message_count), 0)::BIGINT AS messages,
                COALESCE(SUM(voice_seconds), 0)::BIGINT AS voice_seconds
            FROM member_stats
            WHERE guild_id = $1;
            `,
            [guildId]
        )).rows[0]
        : null;

    return { memberStats };
}

async function getStatsDashboardConfig(guildId) {
    if (!await tableExists('stats_config')) {
        return {
            config: null,
            adminRoles: []
        };
    }

    const hasStatsAdminRoles = await tableExists('stats_admin_roles');
    const [configResult, adminRolesResult, summary] = await Promise.all([
        pool.query('SELECT * FROM stats_config WHERE guild_id = $1;', [guildId]),
        hasStatsAdminRoles
            ? pool.query(
                'SELECT role_id FROM stats_admin_roles WHERE guild_id = $1 ORDER BY created_at ASC;',
                [guildId]
            )
            : { rows: [] },
        getStatsSummary(guildId)
    ]);

    return {
        config: configResult.rows[0] || {
            guild_id: guildId,
            enabled: true,
            leaderboard_channel_id: null,
            daily_send_time: '20:00'
        },
        adminRoles: adminRolesResult.rows,
        summary
    };
}

async function updateStatsDashboardConfig(guildId, values) {
    if (!await tableExists('stats_config')) return;

    await pool.query(
        `
        INSERT INTO stats_config (
            guild_id,
            enabled,
            leaderboard_channel_id,
            daily_send_time,
            updated_at
        )
        VALUES ($1, $2, NULLIF($3, ''), $4, CURRENT_TIMESTAMP)
        ON CONFLICT (guild_id)
        DO UPDATE SET
            enabled = EXCLUDED.enabled,
            leaderboard_channel_id = EXCLUDED.leaderboard_channel_id,
            daily_send_time = EXCLUDED.daily_send_time,
            updated_at = CURRENT_TIMESTAMP;
        `,
        [
            guildId,
            values.enabled,
            values.leaderboard_channel_id,
            values.daily_send_time || '20:00'
        ]
    );

    if (await tableExists('stats_admin_roles')) {
        const uniqueRoleIds = [...new Set((values.admin_role_ids || []).filter(Boolean))];
        const client = await pool.connect();

        try {
            await client.query('BEGIN');
            await client.query('DELETE FROM stats_admin_roles WHERE guild_id = $1;', [guildId]);

            for (const roleId of uniqueRoleIds) {
                await client.query(
                    `
                    INSERT INTO stats_admin_roles (guild_id, role_id)
                    VALUES ($1, $2)
                    ON CONFLICT (guild_id, role_id)
                    DO NOTHING;
                    `,
                    [guildId, roleId]
                );
            }

            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }
}

async function getOverviewData(guildId, guild) {
    const [
        serverConfig,
        automod,
        tickets,
        rolemenus,
        statsDashboard
    ] = await Promise.all([
        getServerConfig(guildId, guild?.name),
        getAutomodConfig(guildId),
        getTicketsSummary(guildId),
        getRolemenus(guildId),
        getStatsDashboardConfig(guildId)
    ]);

    return {
        serverConfig,
        automod,
        tickets,
        rolemenus,
        stats: statsDashboard.summary || { memberStats: null },
        statsConfig: statsDashboard
    };
}

module.exports = {
    columnExists,
    getDbOwnerId,
    getServerConfig,
    updateServerFields,
    updateServerConfig,
    getAutomodConfig,
    updateAutomodConfig,
    getLogsConfig,
    updateLogsConfig,
    getOverviewData,
    getRolemenus,
    getStatsDashboardConfig,
    updateStatsDashboardConfig,
    getTicketConfig,
    getTicketPingRoles,
    getTicketsSummary,
    getTexts,
    replaceTicketPingRoles,
    getWarnings,
    updateTexts,
    updateTicketConfig,
    getStatsSummary,
    tableExists
};

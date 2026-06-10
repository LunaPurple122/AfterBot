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

module.exports = {
    columnExists,
    getDbOwnerId,
    getServerConfig,
    updateServerConfig,
    getAutomodConfig,
    updateAutomodConfig,
    getLogsConfig,
    updateLogsConfig,
    getRolemenus,
    getTicketsSummary,
    getTexts,
    getWarnings,
    getStatsSummary,
    tableExists
};

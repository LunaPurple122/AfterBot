const { pool } =
    require('../../../database/db');

const MAX_OPTIONS = 25;

function sanitizeText(value, maxLength) {
    if (!value) return null;

    return String(value)
        .trim()
        .slice(0, maxLength);
}

function parseColor(value) {
    if (!value) return null;

    const normalized =
        value.trim().replace('#', '');

    if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
        return null;
    }

    return normalized.toUpperCase();
}

async function getRolemenu(guildId, rolemenuId) {
    const result = await pool.query(
        `
        SELECT *
        FROM rolemenus
        WHERE id = $1
        AND guild_id = $2
        `,
        [
            rolemenuId,
            guildId
        ]
    );

    return result.rows[0] || null;
}

async function getRolemenuByMessage(guildId, messageId) {
    const result = await pool.query(
        `
        SELECT *
        FROM rolemenus
        WHERE guild_id = $1
        AND message_id = $2
        `,
        [
            guildId,
            messageId
        ]
    );

    return result.rows[0] || null;
}

async function getRolemenuRoles(rolemenuId, onlyActive = false) {
    const result = await pool.query(
        `
        SELECT *
        FROM rolemenu_roles
        WHERE rolemenu_id = $1
        ${onlyActive ? 'AND actif = TRUE' : ''}
        ORDER BY position ASC, id ASC
        `,
        [
            rolemenuId
        ]
    );

    return result.rows;
}

async function createRolemenu(guildId, values) {
    const result = await pool.query(
        `
        INSERT INTO rolemenus (
            guild_id,
            nom_interne,
            titre,
            description,
            placeholder,
            couleur
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
        `,
        [
            guildId,
            sanitizeText(values.nomInterne, 100),
            sanitizeText(values.titre, 256),
            sanitizeText(values.description, 4000),
            sanitizeText(values.placeholder, 100) || 'Choisis un rôle',
            parseColor(values.couleur)
        ]
    );

    return result.rows[0];
}

async function updateRolemenu(guildId, rolemenuId, values) {
    const current =
        await getRolemenu(guildId, rolemenuId);

    if (!current) return null;

    const result = await pool.query(
        `
        UPDATE rolemenus
        SET
            channel_id = $1,
            nom_interne = $2,
            titre = $3,
            description = $4,
            placeholder = $5,
            couleur = $6,
            modifie_le = CURRENT_TIMESTAMP
        WHERE id = $7
        AND guild_id = $8
        RETURNING *
        `,
        [
            values.channelId ?? current.channel_id,
            sanitizeText(values.nomInterne, 100) ?? current.nom_interne,
            sanitizeText(values.titre, 256) ?? current.titre,
            sanitizeText(values.description, 4000) ?? current.description,
            sanitizeText(values.placeholder, 100) ?? current.placeholder,
            values.couleur === undefined
                ? current.couleur
                : parseColor(values.couleur),
            rolemenuId,
            guildId
        ]
    );

    return result.rows[0] || null;
}

async function setRolemenuMessage(guildId, rolemenuId, channelId, messageId) {
    await pool.query(
        `
        UPDATE rolemenus
        SET
            channel_id = $1,
            message_id = $2,
            modifie_le = CURRENT_TIMESTAMP
        WHERE id = $3
        AND guild_id = $4
        `,
        [
            channelId,
            messageId,
            rolemenuId,
            guildId
        ]
    );
}

async function setRolemenuEnabled(guildId, rolemenuId, actif) {
    const result = await pool.query(
        `
        UPDATE rolemenus
        SET
            actif = $1,
            modifie_le = CURRENT_TIMESTAMP
        WHERE id = $2
        AND guild_id = $3
        RETURNING *
        `,
        [
            actif,
            rolemenuId,
            guildId
        ]
    );

    return result.rows[0] || null;
}

async function deleteRolemenu(guildId, rolemenuId) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const menuResult = await client.query(
            `
            SELECT *
            FROM rolemenus
            WHERE id = $1
            AND guild_id = $2
            `,
            [
                rolemenuId,
                guildId
            ]
        );

        if (!menuResult.rows[0]) {
            await client.query('COMMIT');
            return null;
        }

        await client.query(
            `
            DELETE FROM rolemenu_roles
            WHERE rolemenu_id = $1
            `,
            [
                rolemenuId
            ]
        );

        const result = await client.query(
            `
            DELETE FROM rolemenus
            WHERE id = $1
            AND guild_id = $2
            RETURNING *
            `,
            [
                rolemenuId,
                guildId
            ]
        );

        await client.query('COMMIT');

        return result.rows[0] || null;

    } catch (error) {
        await client.query('ROLLBACK');
        console.error(`Erreur suppression rolemenu ${rolemenuId}:`, error);
        throw error;
    } finally {
        client.release();
    }
}

async function listRolemenus(guildId, onlyActive = false) {
    const result = await pool.query(
        `
        SELECT *
        FROM rolemenus
        WHERE guild_id = $1
        ${onlyActive ? 'AND actif = TRUE' : ''}
        ORDER BY id ASC
        `,
        [
            guildId
        ]
    );

    return result.rows;
}

async function addRoleOption(rolemenuId, values) {
    const countResult = await pool.query(
        `
        SELECT COUNT(*)::INTEGER AS total
        FROM rolemenu_roles
        WHERE rolemenu_id = $1
        AND actif = TRUE
        `,
        [
            rolemenuId
        ]
    );

    if (countResult.rows[0].total >= MAX_OPTIONS) {
        throw new Error('ROLEMENU_TOO_MANY_OPTIONS');
    }

    const result = await pool.query(
        `
        INSERT INTO rolemenu_roles (
            rolemenu_id,
            role_id,
            label,
            description,
            emoji,
            position
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (rolemenu_id, role_id)
        DO UPDATE SET
            label = EXCLUDED.label,
            description = EXCLUDED.description,
            emoji = EXCLUDED.emoji,
            position = EXCLUDED.position,
            actif = TRUE,
            modifie_le = CURRENT_TIMESTAMP
        RETURNING *
        `,
        [
            rolemenuId,
            values.roleId,
            sanitizeText(values.label, 100),
            sanitizeText(values.description, 100),
            sanitizeText(values.emoji, 64),
            values.position
        ]
    );

    return result.rows[0];
}

async function updateRoleOption(rolemenuId, roleId, values) {
    const currentResult = await pool.query(
        `
        SELECT *
        FROM rolemenu_roles
        WHERE rolemenu_id = $1
        AND role_id = $2
        `,
        [
            rolemenuId,
            roleId
        ]
    );

    const current = currentResult.rows[0];

    if (!current) return null;

    const result = await pool.query(
        `
        UPDATE rolemenu_roles
        SET
            label = $1,
            description = $2,
            emoji = $3,
            position = $4,
            actif = $5,
            modifie_le = CURRENT_TIMESTAMP
        WHERE rolemenu_id = $6
        AND role_id = $7
        RETURNING *
        `,
        [
            sanitizeText(values.label, 100) ?? current.label,
            sanitizeText(values.description, 100) ?? current.description,
            values.emoji === undefined
                ? current.emoji
                : sanitizeText(values.emoji, 64),
            values.position ?? current.position,
            values.actif ?? current.actif,
            rolemenuId,
            roleId
        ]
    );

    return result.rows[0] || null;
}

async function removeRoleOption(rolemenuId, roleId) {
    const result = await pool.query(
        `
        DELETE FROM rolemenu_roles
        WHERE rolemenu_id = $1
        AND role_id = $2
        RETURNING *
        `,
        [
            rolemenuId,
            roleId
        ]
    );

    return result.rows[0] || null;
}

async function disableRoleOption(optionId) {
    await pool.query(
        `
        UPDATE rolemenu_roles
        SET
            actif = FALSE,
            modifie_le = CURRENT_TIMESTAMP
        WHERE id = $1
        `,
        [
            optionId
        ]
    );
}

async function syncRoleMenu(client, guildId, rolemenuId) {
    const rolemenu =
        await getRolemenu(guildId, rolemenuId);

    if (!rolemenu) {
        return {
            error: 'ROLEMENU_NOT_FOUND',
            message: 'Rolemenu introuvable.',
            skipped: false,
            synced: false
        };
    }

    if (!rolemenu.channel_id || !rolemenu.message_id) {
        return {
            error: null,
            message: 'Rolemenu enregistré. Aucun message à synchroniser.',
            skipped: true,
            synced: false
        };
    }

    const guild =
        client.guilds.cache.get(guildId);

    if (!guild) {
        return {
            error: 'ROLEMENU_GUILD_NOT_FOUND',
            message: 'Serveur introuvable pour la synchronisation.',
            skipped: false,
            synced: false
        };
    }

    const channel =
        await guild.channels.fetch(rolemenu.channel_id)
            .catch(error => {
                console.error(
                    `Salon rolemenu introuvable ${rolemenu.channel_id}:`,
                    error
                );
                return null;
            });

    if (!channel || !channel.isTextBased()) {
        return {
            error: 'ROLEMENU_CHANNEL_NOT_FOUND',
            message: 'Salon rolemenu introuvable.',
            skipped: false,
            synced: false
        };
    }

    const message =
        await channel.messages.fetch(rolemenu.message_id)
            .catch(error => {
                console.error(
                    `Message rolemenu introuvable ${rolemenu.message_id}:`,
                    error
                );
                return null;
            });

    if (!message) {
        return {
            error: 'ROLEMENU_MESSAGE_NOT_FOUND',
            message:
                'Message rolemenu introuvable. Utilise /rolemenu send pour le republier.',
            skipped: false,
            synced: false
        };
    }

    try {
        const {
            buildRolemenuPayload
        } = require('./roleMenuRenderer');

        const payload =
            await buildRolemenuPayload(guild, rolemenu);

        await message.edit(payload);

        return {
            error: null,
            message: 'Message synchronisé.',
            skipped: false,
            synced: true
        };

    } catch (error) {
        console.error(
            `Erreur synchronisation rolemenu ${rolemenuId}:`,
            error
        );

        const messages = {
            ROLEMENU_NO_OPTIONS:
                'Aucune option active à synchroniser.',
            ROLEMENU_TOO_MANY_OPTIONS:
                `Limite de ${MAX_OPTIONS} options dépassée.`
        };

        return {
            error: error.message,
            message:
                messages[error.message] ||
                'Synchronisation impossible.',
            skipped: false,
            synced: false
        };
    }
}

module.exports = {
    MAX_OPTIONS,
    addRoleOption,
    createRolemenu,
    deleteRolemenu,
    disableRoleOption,
    getRolemenu,
    getRolemenuByMessage,
    getRolemenuRoles,
    listRolemenus,
    parseColor,
    removeRoleOption,
    setRolemenuEnabled,
    setRolemenuMessage,
    syncRoleMenu,
    updateRolemenu,
    updateRoleOption
};

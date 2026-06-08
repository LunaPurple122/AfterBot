const { pool } =
    require('../../../database/db');

const LOVE_USERS = {
    Luna: '987688776027471933',
    Ibtissem: '280674647383736321'
};

function isLoveUser(userId) {
    return Object.values(LOVE_USERS)
        .includes(String(userId));
}

function getLoveDisplayName(userId) {
    const normalizedUserId =
        String(userId);

    if (normalizedUserId === LOVE_USERS.Luna) {
        return 'Luna';
    }

    if (normalizedUserId === LOVE_USERS.Ibtissem) {
        return 'Ibtissem';
    }

    return 'Inconnu';
}

function getOtherLoveUser(userId) {
    const normalizedUserId =
        String(userId);

    if (normalizedUserId === LOVE_USERS.Luna) {
        return {
            id: LOVE_USERS.Ibtissem,
            name: 'Ibtissem'
        };
    }

    if (normalizedUserId === LOVE_USERS.Ibtissem) {
        return {
            id: LOVE_USERS.Luna,
            name: 'Luna'
        };
    }

    return null;
}

async function createLoveMessage(auteurId, titre, contenu) {
    const result = await pool.query(
        `
        INSERT INTO love_messages (
            auteur_id,
            titre,
            contenu
        )
        VALUES ($1, $2, $3)
        RETURNING *
        `,
        [
            String(auteurId),
            titre,
            contenu
        ]
    );

    return result.rows[0];
}

async function listLoveMessages() {
    const result = await pool.query(
        `
        SELECT
            id,
            auteur_id,
            titre,
            created_at,
            updated_at
        FROM love_messages
        ORDER BY created_at DESC, id DESC
        `
    );

    return result.rows;
}

async function getLoveMessage(id) {
    const result = await pool.query(
        `
        SELECT *
        FROM love_messages
        WHERE id = $1
        `,
        [
            id
        ]
    );

    return result.rows[0] || null;
}

async function updateLoveMessage(id, titre, contenu) {
    const result = await pool.query(
        `
        UPDATE love_messages
        SET
            titre = $1,
            contenu = $2,
            updated_at = NOW()
        WHERE id = $3
        RETURNING *
        `,
        [
            titre,
            contenu,
            id
        ]
    );

    return result.rows[0] || null;
}

module.exports = {
    LOVE_USERS,
    createLoveMessage,
    getLoveDisplayName,
    getLoveMessage,
    getOtherLoveUser,
    isLoveUser,
    listLoveMessages,
    updateLoveMessage
};

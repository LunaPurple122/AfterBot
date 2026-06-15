const {
    EmbedBuilder
} = require('discord.js');

const { pool } =
    require('../../../database/db');

const PRESENTATION_COLOR =
    0xF47FFF;

const MAX_PRESENTATION_LENGTH =
    4096;

const MEMBER_REQUIRED_MESSAGE =
    'Vous devez être membre du serveur pour utiliser cette commande.';

function formatDateFr(date = new Date()) {
    return new Intl.DateTimeFormat('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    }).format(date);
}

function getPresentationTemplate(guildName) {
    return `👋 Salut !

Prends quelques minutes pour te présenter à la communauté. Tu n'es pas obligé(e) de répondre à tout, mais plus tu en dis sur toi, plus il sera facile pour les autres de venir discuter avec toi. 💜

🪪 Comment aimerais-tu qu'on t'appelle ?
➡️

🎨 À quoi ressembles-tu ? (physique, style vestimentaire, couleur de cheveux, signe distinctif, etc.)
➡️

🌟 Comment te décrirais-tu en quelques mots ?
➡️

🎮 Quels sont tes jeux préférés ou ceux auxquels tu joues en ce moment ?
➡️

🎵 Qu'est-ce que tu aimes faire en dehors du gaming ?
➡️

💜 Quelles sont tes passions ou centres d'intérêt ?
➡️

🍕 Quelques trucs que tu adores ?
➡️

😖 Quelques trucs que tu détestes ?
➡️

🎯 Un objectif, un rêve ou un projet qui te tient particulièrement à cœur ?
➡️

🤝 Qu'aimerais-tu trouver sur « ${guildName} » ? (amis, partenaires de jeu, discussions, rencontres, événements, etc.)
➡️

✨ Tu souhaites ajouter quelque chose sur toi ?
➡️`;
}

async function ensureServerRow(guild) {
    await pool.query(`
        INSERT INTO serveurs (serveur_id, nom)
        VALUES ($1, $2)
        ON CONFLICT (serveur_id)
        DO UPDATE SET nom = EXCLUDED.nom;
    `, [
        guild.id,
        guild.name
    ]);
}

async function setPresentationChannel(guild, channelId) {
    await ensureServerRow(guild);

    await pool.query(`
        UPDATE serveurs
        SET presentation_channel_id = $1,
            modifie_le = CURRENT_TIMESTAMP
        WHERE serveur_id = $2;
    `, [
        channelId,
        guild.id
    ]);
}

async function getPresentationSettings(guildId) {
    const result =
        await pool.query(`
            SELECT presentation_channel_id, role_membre_id
            FROM serveurs
            WHERE serveur_id = $1;
        `, [
            guildId
        ]);

    return result.rows[0] || null;
}

async function memberHasRequiredRole(member) {
    const settings =
        await getPresentationSettings(member.guild.id);

    if (!settings?.role_membre_id) {
        return false;
    }

    return member.roles.cache.has(settings.role_membre_id);
}

async function getPresentation(guildId, userId) {
    const result =
        await pool.query(`
            SELECT *
            FROM presentations
            WHERE guild_id = $1
            AND user_id = $2;
        `, [
            guildId,
            userId
        ]);

    return result.rows[0] || null;
}

async function presentationExists(guildId, userId) {
    return Boolean(
        await getPresentation(guildId, userId)
    );
}

async function createPresentation({
    guildId,
    userId,
    channelId,
    messageId,
    content
}) {
    await pool.query(`
        INSERT INTO presentations (
            guild_id,
            user_id,
            channel_id,
            message_id,
            content,
            created_at,
            updated_at
        )
        VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    `, [
        guildId,
        userId,
        channelId,
        messageId,
        content
    ]);
}

async function updatePresentation({
    guildId,
    userId,
    content
}) {
    await pool.query(`
        UPDATE presentations
        SET content = $3,
            updated_at = CURRENT_TIMESTAMP
        WHERE guild_id = $1
        AND user_id = $2;
    `, [
        guildId,
        userId,
        content
    ]);
}

async function deletePresentation(guildId, userId) {
    await pool.query(`
        DELETE FROM presentations
        WHERE guild_id = $1
        AND user_id = $2;
    `, [
        guildId,
        userId
    ]);
}

function buildPresentationEmbed({
    member,
    content,
    updated = false
}) {
    const footerPrefix =
        updated
            ? 'Présentation mise à jour le'
            : 'Présenté le';

    return new EmbedBuilder()
        .setTitle(`Présentation de ${member.displayName}`)
        .setDescription(content)
        .setColor(PRESENTATION_COLOR)
        .setThumbnail(
            member.user.displayAvatarURL({
                dynamic: true
            })
        )
        .setFooter({
            text:
                `${footerPrefix} ${formatDateFr()}`
        })
        .setTimestamp();
}

module.exports = {
    MAX_PRESENTATION_LENGTH,
    MEMBER_REQUIRED_MESSAGE,
    buildPresentationEmbed,
    createPresentation,
    deletePresentation,
    getPresentation,
    getPresentationSettings,
    getPresentationTemplate,
    memberHasRequiredRole,
    presentationExists,
    setPresentationChannel,
    updatePresentation
};

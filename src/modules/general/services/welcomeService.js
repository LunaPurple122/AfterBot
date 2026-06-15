const {
    EmbedBuilder
} = require('discord.js');

const { pool } =
    require('../../../database/db');

const DEFAULT_WELCOME_EMBED = {
    title:
        'Nouveau membre',
    description:
        'Bienvenue {user} sur le serveur {server}, tu es le {memberCount} ieme membre de ce serveur et tu as ete invite par {inviter}.',
    color:
        '#57F287',
    footer:
        'Membre #{memberCount}',
    content:
        '|| {user} ||'
};

const DEFAULT_LEAVE_EMBED = {
    title:
        'Depart membre',
    description:
        '{username} a quitte le serveur {server}. Nous sommes maintenant {memberCount} membres.',
    color:
        '#ED4245',
    footer:
        'Membre parti',
    content:
        ''
};

function normalizeColor(value, defaultColor) {
    const color =
        String(value || '').trim();

    if (!color) return defaultColor;

    if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
        return null;
    }

    return color.toUpperCase();
}

function trimField(value, fallback, maxLength) {
    const text =
        String(value || '').trim();

    return (text || fallback).slice(0, maxLength);
}

function normalizeWelcomeEmbed(values) {
    return normalizeMemberEmbed(
        values,
        DEFAULT_WELCOME_EMBED
    );
}

function normalizeLeaveEmbed(values) {
    return normalizeMemberEmbed(
        values,
        DEFAULT_LEAVE_EMBED
    );
}

function normalizeMemberEmbed(values, defaults) {
    const color =
        normalizeColor(values.color, defaults.color);

    if (!color) {
        return {
            error:
                'La couleur doit etre au format #RRGGBB. Exemple : #57F287'
        };
    }

    return {
        value: {
            title:
                trimField(
                    values.title,
                    defaults.title,
                    256
                ),
            description:
                trimField(
                    values.description,
                    defaults.description,
                    4000
                ),
            color,
            footer:
                trimField(
                    values.footer,
                    defaults.footer,
                    2048
                ),
            content:
                trimField(
                    values.content,
                    defaults.content,
                    2000
                )
        }
    };
}

async function saveWelcomeConfig({
    guildId,
    guildName,
    channelId,
    embedConfig
}) {
    await pool.query(`
        INSERT INTO serveurs (
            serveur_id,
            nom,
            salon_bienvenue_id,
            bienvenue_embed
        )
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (serveur_id)
        DO UPDATE SET
            nom = EXCLUDED.nom,
            salon_bienvenue_id = EXCLUDED.salon_bienvenue_id,
            bienvenue_embed = EXCLUDED.bienvenue_embed,
            modifie_le = CURRENT_TIMESTAMP;
    `, [
        guildId,
        guildName,
        channelId,
        embedConfig
    ]);
}

async function saveLeaveConfig({
    guildId,
    guildName,
    channelId,
    embedConfig
}) {
    await pool.query(`
        INSERT INTO serveurs (
            serveur_id,
            nom,
            salon_depart_id,
            depart_embed
        )
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (serveur_id)
        DO UPDATE SET
            nom = EXCLUDED.nom,
            salon_depart_id = EXCLUDED.salon_depart_id,
            depart_embed = EXCLUDED.depart_embed,
            modifie_le = CURRENT_TIMESTAMP;
    `, [
        guildId,
        guildName,
        channelId,
        embedConfig
    ]);
}

async function getWelcomeConfig(guildId) {
    const result =
        await pool.query(`
            SELECT salon_bienvenue_id, bienvenue_embed
            FROM serveurs
            WHERE serveur_id = $1
        `, [
            guildId
        ]);

    return result.rows[0] || null;
}

async function getLeaveConfig(guildId) {
    const result =
        await pool.query(`
            SELECT salon_depart_id, depart_embed
            FROM serveurs
            WHERE serveur_id = $1
        `, [
            guildId
        ]);

    return result.rows[0] || null;
}

async function getInviterText(member) {
    const result =
        await pool.query(`
            SELECT inviter_id, detection_status
            FROM invite_tracker_joins
            WHERE guild_id = $1
            AND invited_user_id = $2
            LIMIT 1
        `, [
            member.guild.id,
            member.id
        ]);

    const row =
        result.rows[0];

    if (row?.inviter_id) {
        return `<@${row.inviter_id}>`;
    }

    if (row?.detection_status === 'missing_permission') {
        return 'un membre inconnu (permission Manage Guild manquante)';
    }

    return 'un membre inconnu';
}

function replaceVariables(template, variables) {
    return String(template || '')
        .replaceAll('{user}', variables.user)
        .replaceAll('{username}', variables.username)
        .replaceAll('{server}', variables.server)
        .replaceAll('{memberCount}', variables.memberCount)
        .replaceAll('{inviter}', variables.inviter);
}

async function buildWelcomePayload(member, embedConfig) {
    return buildMemberPayload({
        member,
        embedConfig,
        defaults:
            DEFAULT_WELCOME_EMBED,
        includeInviter:
            true
    });
}

async function buildLeavePayload(member, embedConfig) {
    return buildMemberPayload({
        member,
        embedConfig,
        defaults:
            DEFAULT_LEAVE_EMBED,
        includeInviter:
            false
    });
}

async function buildMemberPayload({
    member,
    embedConfig,
    defaults,
    includeInviter
}) {
    const config = {
        ...defaults,
        ...(embedConfig || {})
    };

    const variables = {
        user:
            member.toString(),
        username:
            member.user.tag,
        server:
            member.guild.name,
        memberCount:
            String(member.guild.memberCount),
        inviter:
            includeInviter
                ? await getInviterText(member)
                : 'inconnu'
    };

    const embed =
        new EmbedBuilder()
            .setColor(config.color)
            .setTitle(
                replaceVariables(
                    config.title,
                    variables
                )
            )
            .setDescription(
                replaceVariables(
                    config.description,
                    variables
                )
            )
            .setThumbnail(
                member.user.displayAvatarURL({
                    dynamic: true
                })
            )
            .setTimestamp();

    const footer =
        replaceVariables(
            config.footer,
            variables
        );

    if (footer) {
        embed.setFooter({
            text:
                footer
        });
    }

    const content =
        replaceVariables(
            config.content,
            variables
        );

    return {
        content:
            content || undefined,
        embeds:
            [embed]
    };
}

module.exports = {
    DEFAULT_LEAVE_EMBED,
    DEFAULT_WELCOME_EMBED,
    buildLeavePayload,
    buildWelcomePayload,
    getLeaveConfig,
    getWelcomeConfig,
    normalizeLeaveEmbed,
    normalizeWelcomeEmbed,
    saveLeaveConfig,
    saveWelcomeConfig
};

const { PermissionsBitField } = require('discord.js');
const { getDbOwnerId } = require('../services/dashboardData');

const ADMINISTRATOR = PermissionsBitField.Flags.Administrator;

let discordClient = null;

function setDiscordClient(client) {
    discordClient = client;
}

function getDiscordClient() {
    return discordClient;
}

function requireAuth(req, res, next) {
    if (req.isAuthenticated && req.isAuthenticated()) {
        return next();
    }

    return res.redirect('/login');
}

function hasAdminPermission(oauthGuild) {
    try {
        return (BigInt(oauthGuild.permissions) & ADMINISTRATOR) === ADMINISTRATOR;
    } catch (error) {
        return false;
    }
}

async function getUserGuildAccess(user, guildId) {
    const oauthGuild = user?.guilds?.find(guild => guild.id === guildId);
    const botGuild = discordClient?.guilds?.cache?.get(guildId);

    if (!oauthGuild || !botGuild) {
        return {
            allowed: false,
            canManage: false,
            isAdmin: false,
            isDbOwner: false,
            botGuild: null,
            oauthGuild: null
        };
    }

    const ownerId = await getDbOwnerId(guildId);
    const isAdmin = hasAdminPermission(oauthGuild);
    const isDbOwner = ownerId && ownerId === user.id;

    return {
        allowed: isAdmin || isDbOwner,
        canManage: isAdmin || isDbOwner,
        isAdmin,
        isDbOwner,
        botGuild,
        oauthGuild,
        ownerId
    };
}

async function requireGuildAccess(req, res, next) {
    try {
        const access = await getUserGuildAccess(req.user, req.params.guildId);

        if (!access.allowed) {
            return res.status(403).renderDashboard('login', {
                title: 'Acces refuse',
                error: 'Tu n as pas acces a ce serveur ou le bot n y est pas present.'
            });
        }

        req.guildAccess = access;
        return next();
    } catch (error) {
        return next(error);
    }
}

async function requireAdminOrOwner(req, res, next) {
    try {
        const access = req.guildAccess ||
            await getUserGuildAccess(req.user, req.params.guildId);

        if (!access.canManage) {
            return res.status(403).renderDashboard('login', {
                title: 'Acces refuse',
                error: 'Seuls les administrateurs Discord ou l owner en DB peuvent modifier ce serveur.'
            });
        }

        req.guildAccess = access;
        return next();
    } catch (error) {
        return next(error);
    }
}

module.exports = {
    getDiscordClient,
    getUserGuildAccess,
    hasAdminPermission,
    requireAdminOrOwner,
    requireAuth,
    requireGuildAccess,
    setDiscordClient
};

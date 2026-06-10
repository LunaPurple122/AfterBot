const path = require('path');
const ejs = require('ejs');
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const pgSession = require('connect-pg-simple')(session);
const { ChannelType, PermissionFlagsBits } = require('discord.js');

const { pool } = require('../database/db');
const {
    getDiscordClient,
    getUserGuildAccess,
    requireAdminOrOwner,
    requireAuth,
    requireGuildAccess,
    setDiscordClient
} = require('./middlewares/auth');
const {
    getAutomodConfig,
    getOverviewData,
    getLogsConfig,
    getServerConfig,
    getStatsDashboardConfig,
    getTicketConfig,
    getTicketPingRoles,
    getTexts,
    getTicketsSummary,
    getWarnings,
    replaceTicketPingRoles,
    updateAutomodConfig,
    updateLogsConfig,
    updateServerFields,
    updateStatsDashboardConfig,
    updateTexts,
    updateTicketConfig
} = require('./services/dashboardData');

const {
    addRoleOption,
    createRolemenu,
    deleteRolemenu,
    getRolemenu,
    getRolemenuRoles,
    listRolemenus,
    removeRoleOption,
    setRolemenuEnabled,
    setRolemenuMessage,
    syncRoleMenu,
    updateRolemenu,
    updateRoleOption
} = require('../modules/rolemenu/services/roleMenuService');
const { buildRolemenuPayload } = require('../modules/rolemenu/services/roleMenuRenderer');

const app = express();
const viewsDir = path.join(__dirname, 'views');
const publicDir = path.join(__dirname, 'public');
const port = Number(process.env.DASHBOARD_PORT || process.env.PORT || 3000);
const baseUrl = (process.env.DASHBOARD_BASE_URL || 'https://bot.afterstation.fr').replace(/\/$/, '');
const callbackUrl = process.env.DISCORD_CALLBACK_URL || `${baseUrl}/auth/discord/callback`;
const sessionSecret = process.env.DASHBOARD_SESSION_SECRET || process.env.SESSION_SECRET || process.env.DISCORD_TOKEN;
let started = false;

function boolValue(value) {
    return value === 'on' || value === 'true' || value === true;
}

function intValue(value, fallback) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function getFlash(req) {
    return {
        success: req.query.success,
        error: req.query.error
    };
}

function redirectWithSuccess(res, url, message) {
    res.redirect(`${url}?success=${encodeURIComponent(message)}`);
}

function redirectWithError(res, url, message) {
    res.redirect(`${url}?error=${encodeURIComponent(message)}`);
}

function arrayValue(value) {
    if (Array.isArray(value)) return value;
    if (!value) return [];
    return [value];
}

function isPromiseLike(value) {
    return Boolean(value && typeof value.then === 'function');
}

function isPlainObject(value) {
    return Object.prototype.toString.call(value) === '[object Object]';
}

function findPromises(value, path = 'data', found = [], seen = new WeakSet()) {
    if (isPromiseLike(value)) {
        found.push(path);
        return found;
    }

    if (Array.isArray(value)) {
        value.forEach((item, index) => {
            findPromises(item, `${path}[${index}]`, found, seen);
        });

        return found;
    }

    if (value && typeof value === 'object') {
        if (seen.has(value)) return found;
        seen.add(value);

        for (const [key, nestedValue] of Object.entries(value)) {
            findPromises(nestedValue, `${path}.${key}`, found, seen);
        }
    }

    return found;
}

function normalizeDashboardLocals(locals) {
    const normalized = { ...locals };

    normalized.config = isPlainObject(normalized.config) ? normalized.config : {};
    normalized.serverConfig = isPlainObject(normalized.serverConfig) ? normalized.serverConfig : {};
    normalized.automod = isPlainObject(normalized.automod) ? normalized.automod : {};
    normalized.currentGuild = isPlainObject(normalized.currentGuild) ? normalized.currentGuild : null;
    normalized.guild = isPlainObject(normalized.guild) ? normalized.guild : normalized.currentGuild;
    normalized.guilds = Array.isArray(normalized.guilds) ? normalized.guilds : [];
    normalized.rolemenus = Array.isArray(normalized.rolemenus) ? normalized.rolemenus : [];
    normalized.warnings = Array.isArray(normalized.warnings) ? normalized.warnings : [];

    normalized.options = isPlainObject(normalized.options) ? normalized.options : {};
    normalized.options.textChannels = Array.isArray(normalized.options.textChannels)
        ? normalized.options.textChannels
        : [];
    normalized.options.categories = Array.isArray(normalized.options.categories)
        ? normalized.options.categories
        : [];
    normalized.options.roles = Array.isArray(normalized.options.roles)
        ? normalized.options.roles
        : [];

    normalized.summary = isPlainObject(normalized.summary) ? normalized.summary : {};
    normalized.summary.tickets = Array.isArray(normalized.summary.tickets)
        ? normalized.summary.tickets
        : [];
    normalized.tickets = isPlainObject(normalized.tickets) ? normalized.tickets : {};
    normalized.tickets.tickets = Array.isArray(normalized.tickets.tickets)
        ? normalized.tickets.tickets
        : [];
    normalized.stats = isPlainObject(normalized.stats) ? normalized.stats : { memberStats: null };
    normalized.texts = isPlainObject(normalized.texts) ? normalized.texts : {};

    return normalized;
}

async function renderDashboard(res, view, locals = {}) {
    const defaultLocals = {
        title: 'AfterBot Dashboard',
        flash: {},
        error: null,
        success: null,
        user: null,
        guild: null,
        guilds: [],
        currentGuild: null,
        body: '',
        botReady: false,
        userAvatarUrl: null,
        config: {},
        options: {
            textChannels: [],
            categories: [],
            roles: []
        },
        serverConfig: {},
        automod: {},
        rolemenus: [],
        tickets: {
            tickets: []
        },
        stats: {
            memberStats: null
        },
        warnings: [],
        summary: {
            config: null,
            tickets: []
        },
        texts: {
            texte_reglement: null,
            ticket_alert_message: null
        }
    };
    const mergedLocals = {
        ...defaultLocals,
        ...locals,
        flash: {
            ...defaultLocals.flash,
            ...(locals.flash || {})
        },
        options: {
            ...defaultLocals.options,
            ...(locals.options || {})
        },
        tickets: {
            ...defaultLocals.tickets,
            ...(locals.tickets || {})
        },
        stats: {
            ...defaultLocals.stats,
            ...(locals.stats || {})
        },
        summary: {
            ...defaultLocals.summary,
            ...(locals.summary || {})
        },
        texts: {
            ...defaultLocals.texts,
            ...(locals.texts || {})
        }
    };
    const unresolvedPromises = findPromises(mergedLocals);

    if (unresolvedPromises.length > 0) {
        console.error('[Dashboard] Promises non resolues envoyees a EJS :', unresolvedPromises);
        throw new Error(
            `Promises non resolues dans les donnees EJS : ${unresolvedPromises.join(', ')}`
        );
    }

    const viewLocals = normalizeDashboardLocals(mergedLocals);

    const body = await ejs.renderFile(
        path.join(viewsDir, `${view}.ejs`),
        viewLocals,
        { async: true }
    );

    const html = await ejs.renderFile(
        path.join(viewsDir, 'layout.ejs'),
        { ...viewLocals, body },
        { async: true }
    );

    console.log(`[Dashboard] Render ${res.req?.originalUrl || view} OK`);

    return res.send(html);
}

function dashboardRenderMiddleware(req, res, next) {
    res.renderDashboard = (view, locals = {}) => {
        return renderDashboard(res, view, {
            user: req.user || null,
            currentGuild: req.currentGuild || null,
            guild: req.currentGuild || null,
            flash: getFlash(req),
            ...locals
        });
    };

    next();
}

function configurePassport() {
    passport.serializeUser((user, done) => done(null, user));
    passport.deserializeUser((user, done) => done(null, user));

    if (!process.env.CLIENT_ID || !process.env.DISCORD_CLIENT_SECRET) {
        console.warn('[Dashboard] OAuth Discord incomplet: CLIENT_ID et DISCORD_CLIENT_SECRET sont requis.');
        return;
    }

    passport.use(new DiscordStrategy({
        clientID: process.env.CLIENT_ID,
        clientSecret: process.env.DISCORD_CLIENT_SECRET,
        callbackURL: callbackUrl,
        scope: ['identify', 'guilds']
    }, (accessToken, refreshToken, profile, done) => {
        return done(null, {
            id: profile.id,
            username: profile.username,
            discriminator: profile.discriminator,
            avatar: profile.avatar,
            guilds: profile.guilds || []
        });
    }));
}

function getAvatarUrl(user) {
    if (!user?.avatar) return null;
    return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64`;
}

function mapChannels(guild, type) {
    return guild.channels.cache
        .filter(channel => channel.type === type)
        .map(channel => ({
            id: channel.id,
            name: channel.name,
            type: channel.type,
            parentId: channel.parentId || null,
            position: channel.position ?? 0
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
}

function mapRoles(guild) {
    return guild.roles.cache
        .filter(role => role.id !== guild.id)
        .map(role => ({
            id: role.id,
            name: role.name,
            position: role.position,
            color: role.hexColor,
            managed: role.managed
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
}

async function withGuildContext(req, res, next) {
    try {
        const guild = req.guildAccess?.botGuild ||
            getDiscordClient()?.guilds?.cache?.get(req.params.guildId);

        if (!guild) {
            return res.status(404).renderDashboard('login', {
                title: 'Serveur introuvable',
                error: 'Le bot n est pas present sur ce serveur.'
            });
        }

        req.currentGuild = {
            id: guild.id,
            name: guild.name,
            iconURL: guild.iconURL?.({ size: 64 }) || null
        };

        req.dashboardOptions = {
            textChannels: mapChannels(guild, ChannelType.GuildText),
            categories: mapChannels(guild, ChannelType.GuildCategory),
            roles: mapRoles(guild)
        };

        return next();
    } catch (error) {
        return next(error);
    }
}

function validateConfig(guild, data) {
    const issues = [];
    const me = guild.members.me;

    function checkChannel(channelId, label, permissions = []) {
        if (!channelId) return;

        const channel = guild.channels.cache.get(channelId);

        if (!channel) {
            issues.push(`${label}: salon introuvable (${channelId}).`);
            return;
        }

        const missing = permissions.filter(permission =>
            !channel.permissionsFor(me)?.has(permission)
        );

        if (missing.length > 0) {
            issues.push(`${label}: permissions bot insuffisantes.`);
        }
    }

    function checkRole(roleId, label) {
        if (!roleId) return;

        const role = guild.roles.cache.get(roleId);

        if (!role) {
            issues.push(`${label}: role introuvable (${roleId}).`);
            return;
        }

        if (!me.permissions.has(PermissionFlagsBits.ManageRoles)) {
            issues.push(`${label}: le bot n a pas ManageRoles.`);
        } else if (role.position >= me.roles.highest.position) {
            issues.push(`${label}: le role est au-dessus du role du bot.`);
        }
    }

    const server = data.serverConfig || {};
    const automod = data.automod || {};
    const ticketConfig = data.tickets?.config || {};
    const statsConfig = data.stats?.config || {};
    const sendPerms = [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.EmbedLinks
    ];

    checkChannel(server.salon_logs_id, 'Logs generaux', sendPerms);
    checkChannel(server.salon_bienvenue_id, 'Bienvenue', sendPerms);
    checkChannel(server.salon_depart_id, 'Depart', sendPerms);
    checkChannel(automod.logs_channel_id, 'Logs automod', sendPerms);
    checkRole(server.role_reglement_id, 'Role reglement');

    if (server.captcha_actif) {
        checkRole(server.role_non_verifie_id, 'Role non verifie');
        checkRole(server.role_membre_id, 'Role membre');

        if (!server.categorie_captcha_id) {
            issues.push('Captcha: categorie manquante.');
        } else if (!guild.channels.cache.get(server.categorie_captcha_id)) {
            issues.push('Captcha: categorie introuvable.');
        }
    }

    if (ticketConfig) {
        checkChannel(ticketConfig.panel_channel_id, 'Tickets panel', sendPerms);
        checkChannel(ticketConfig.logs_channel_id, 'Tickets logs', sendPerms);
        checkChannel(ticketConfig.alert_channel_id, 'Tickets alertes', sendPerms);
        checkRole(ticketConfig.staff_role_id, 'Tickets staff');

        if (ticketConfig.panel_channel_id && (!ticketConfig.staff_role_id || !ticketConfig.category_id)) {
            issues.push('Tickets: configuration incomplete.');
        }
    }

    if (statsConfig?.enabled) {
        checkChannel(statsConfig.leaderboard_channel_id, 'Stats leaderboard', sendPerms);
    }

    return issues;
}

function guildUrl(req, suffix = '') {
    return `/guilds/${req.params.guildId}${suffix}`;
}

app.set('trust proxy', 1);
app.use(express.urlencoded({ extended: false }));
app.use(express.static(publicDir));
app.use(session({
    store: new pgSession({
        pool,
        tableName: 'dashboard_sessions',
        createTableIfMissing: true
    }),
    secret: sessionSecret || 'afterbot-dashboard-dev-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 1000 * 60 * 60 * 24 * 7
    }
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(dashboardRenderMiddleware);

configurePassport();

app.get('/', (req, res) => {
    if (req.isAuthenticated && req.isAuthenticated()) {
        return res.redirect('/guilds');
    }

    return res.renderDashboard('index', {
        title: 'AfterBot'
    });
});

app.get('/login', (req, res) => {
    if (req.isAuthenticated && req.isAuthenticated()) {
        return res.redirect('/guilds');
    }

    return res.renderDashboard('login', {
        title: 'Connexion'
    });
});

app.get('/auth/discord', (req, res, next) => {
    if (!process.env.DISCORD_CLIENT_SECRET) {
        return res.renderDashboard('login', {
            title: 'Connexion',
            error: 'OAuth Discord n est pas configure. Ajoute DISCORD_CLIENT_SECRET dans .env.'
        });
    }

    return passport.authenticate('discord')(req, res, next);
});

app.get('/auth/discord/callback',
    passport.authenticate('discord', {
        failureRedirect: '/login?error=Connexion%20Discord%20refusee'
    }),
    (req, res) => res.redirect('/guilds')
);

app.get('/logout', (req, res, next) => {
    req.logout(error => {
        if (error) return next(error);
        return res.redirect('/');
    });
});

app.get('/guilds', requireAuth, async (req, res, next) => {
    try {
        const client = getDiscordClient();
        const guilds = [];

        for (const oauthGuild of req.user.guilds || []) {
            const access = await getUserGuildAccess(req.user, oauthGuild.id);
            if (!access.allowed) continue;

            guilds.push({
                id: oauthGuild.id,
                name: access.botGuild?.name || oauthGuild.name,
                icon: access.botGuild?.iconURL?.({ size: 64 }) || null,
                iconURL: access.botGuild?.iconURL?.({ size: 64 }) || null,
                owner: access.botGuild?.ownerId || null,
                permissions: oauthGuild.permissions,
                isAdmin: access.isAdmin,
                isDbOwner: access.isDbOwner
            });
        }

        return res.renderDashboard('guilds', {
            title: 'Serveurs',
            guilds,
            botReady: Boolean(client?.isReady?.()),
            userAvatarUrl: getAvatarUrl(req.user)
        });
    } catch (error) {
        return next(error);
    }
});

app.get('/guilds/:guildId',
    requireAuth,
    requireGuildAccess,
    withGuildContext,
    async (req, res, next) => {
        try {
            const overview = await getOverviewData(req.params.guildId, req.guildAccess.botGuild);
            const problems = validateConfig(req.guildAccess.botGuild, overview);

            return res.renderDashboard('guild-dashboard', {
                title: req.currentGuild.name,
                ...overview,
                problems
            });
        } catch (error) {
            return next(error);
        }
    }
);

app.get('/guilds/:guildId/settings', (req, res) => {
    res.redirect(`/guilds/${req.params.guildId}/general`);
});

app.get('/guilds/:guildId/general',
    requireAuth,
    requireGuildAccess,
    requireAdminOrOwner,
    withGuildContext,
    async (req, res, next) => {
        try {
            return res.renderDashboard('settings', {
                title: 'General',
                config: await getServerConfig(req.params.guildId, req.currentGuild.name),
                options: req.dashboardOptions
            });
        } catch (error) {
            return next(error);
        }
    }
);

app.post('/guilds/:guildId/general',
    requireAuth,
    requireGuildAccess,
    requireAdminOrOwner,
    async (req, res, next) => {
        try {
            await updateServerFields(req.params.guildId, {
                automod_actif: boolValue(req.body.automod_actif),
                captcha_actif: boolValue(req.body.captcha_actif)
            });

            return redirectWithSuccess(res, guildUrl(req, '/general'), 'Parametres generaux sauvegardes.');
        } catch (error) {
            return next(error);
        }
    }
);

app.get('/guilds/:guildId/channels',
    requireAuth,
    requireGuildAccess,
    requireAdminOrOwner,
    withGuildContext,
    async (req, res, next) => {
        try {
            return res.renderDashboard('channels', {
                title: 'Salons',
                config: await getServerConfig(req.params.guildId, req.currentGuild.name),
                options: req.dashboardOptions
            });
        } catch (error) {
            return next(error);
        }
    }
);

app.post('/guilds/:guildId/channels',
    requireAuth,
    requireGuildAccess,
    requireAdminOrOwner,
    async (req, res, next) => {
        try {
            await updateServerFields(req.params.guildId, {
                salon_logs_id: req.body.salon_logs_id,
                salon_bienvenue_id: req.body.salon_bienvenue_id,
                salon_depart_id: req.body.salon_depart_id,
                salon_radio_id: req.body.salon_radio_id
            });

            return redirectWithSuccess(res, guildUrl(req, '/channels'), 'Salons sauvegardes.');
        } catch (error) {
            return next(error);
        }
    }
);

app.get('/guilds/:guildId/roles',
    requireAuth,
    requireGuildAccess,
    requireAdminOrOwner,
    withGuildContext,
    async (req, res, next) => {
        try {
            return res.renderDashboard('roles', {
                title: 'Roles',
                config: await getServerConfig(req.params.guildId, req.currentGuild.name),
                statsConfig: await getStatsDashboardConfig(req.params.guildId),
                options: req.dashboardOptions
            });
        } catch (error) {
            return next(error);
        }
    }
);

app.post('/guilds/:guildId/roles',
    requireAuth,
    requireGuildAccess,
    requireAdminOrOwner,
    async (req, res, next) => {
        try {
            await updateServerFields(req.params.guildId, {
                role_non_verifie_id: req.body.role_non_verifie_id,
                role_membre_id: req.body.role_membre_id,
                role_reglement_id: req.body.role_reglement_id
            });

            return redirectWithSuccess(res, guildUrl(req, '/roles'), 'Roles sauvegardes.');
        } catch (error) {
            return next(error);
        }
    }
);

app.get('/guilds/:guildId/welcome',
    requireAuth,
    requireGuildAccess,
    requireAdminOrOwner,
    withGuildContext,
    async (req, res, next) => {
        try {
            return res.renderDashboard('welcome', {
                title: 'Bienvenue',
                config: await getServerConfig(req.params.guildId, req.currentGuild.name),
                options: req.dashboardOptions
            });
        } catch (error) {
            return next(error);
        }
    }
);

app.post('/guilds/:guildId/welcome',
    requireAuth,
    requireGuildAccess,
    requireAdminOrOwner,
    async (req, res, next) => {
        try {
            await updateServerFields(req.params.guildId, {
                salon_bienvenue_id: req.body.salon_bienvenue_id
            });

            return redirectWithSuccess(res, guildUrl(req, '/welcome'), 'Bienvenue sauvegarde.');
        } catch (error) {
            return next(error);
        }
    }
);

app.get('/guilds/:guildId/goodbye',
    requireAuth,
    requireGuildAccess,
    requireAdminOrOwner,
    withGuildContext,
    async (req, res, next) => {
        try {
            return res.renderDashboard('goodbye', {
                title: 'Depart',
                config: await getServerConfig(req.params.guildId, req.currentGuild.name),
                options: req.dashboardOptions
            });
        } catch (error) {
            return next(error);
        }
    }
);

app.post('/guilds/:guildId/goodbye',
    requireAuth,
    requireGuildAccess,
    requireAdminOrOwner,
    async (req, res, next) => {
        try {
            await updateServerFields(req.params.guildId, {
                salon_depart_id: req.body.salon_depart_id
            });

            return redirectWithSuccess(res, guildUrl(req, '/goodbye'), 'Depart sauvegarde.');
        } catch (error) {
            return next(error);
        }
    }
);

app.get('/guilds/:guildId/captcha',
    requireAuth,
    requireGuildAccess,
    requireAdminOrOwner,
    withGuildContext,
    async (req, res, next) => {
        try {
            return res.renderDashboard('captcha', {
                title: 'Captcha',
                config: await getServerConfig(req.params.guildId, req.currentGuild.name),
                options: req.dashboardOptions
            });
        } catch (error) {
            return next(error);
        }
    }
);

app.post('/guilds/:guildId/captcha',
    requireAuth,
    requireGuildAccess,
    requireAdminOrOwner,
    async (req, res, next) => {
        try {
            await updateServerFields(req.params.guildId, {
                captcha_actif: boolValue(req.body.captcha_actif),
                role_non_verifie_id: req.body.role_non_verifie_id,
                role_membre_id: req.body.role_membre_id,
                categorie_captcha_id: req.body.categorie_captcha_id
            });

            return redirectWithSuccess(res, guildUrl(req, '/captcha'), 'Captcha sauvegarde.');
        } catch (error) {
            return next(error);
        }
    }
);

app.get('/guilds/:guildId/reglement',
    requireAuth,
    requireGuildAccess,
    requireAdminOrOwner,
    withGuildContext,
    async (req, res, next) => {
        try {
            return res.renderDashboard('reglement', {
                title: 'Reglement',
                config: await getServerConfig(req.params.guildId, req.currentGuild.name),
                options: req.dashboardOptions
            });
        } catch (error) {
            return next(error);
        }
    }
);

app.post('/guilds/:guildId/reglement',
    requireAuth,
    requireGuildAccess,
    requireAdminOrOwner,
    async (req, res, next) => {
        try {
            await updateServerFields(req.params.guildId, {
                role_reglement_id: req.body.role_reglement_id,
                texte_reglement: req.body.texte_reglement
            });

            return redirectWithSuccess(res, guildUrl(req, '/reglement'), 'Reglement sauvegarde.');
        } catch (error) {
            return next(error);
        }
    }
);

app.get('/guilds/:guildId/automod',
    requireAuth,
    requireGuildAccess,
    requireAdminOrOwner,
    withGuildContext,
    async (req, res, next) => {
        try {
            return res.renderDashboard('automod', {
                title: 'Automod',
                config: await getAutomodConfig(req.params.guildId),
                options: req.dashboardOptions
            });
        } catch (error) {
            return next(error);
        }
    }
);

app.post('/guilds/:guildId/automod',
    requireAuth,
    requireGuildAccess,
    requireAdminOrOwner,
    async (req, res, next) => {
        try {
            await updateAutomodConfig(req.params.guildId, {
                anti_spam_enabled: boolValue(req.body.anti_spam_enabled),
                spam_message_limit: intValue(req.body.spam_message_limit, 5),
                spam_interval: intValue(req.body.spam_interval, 5),
                spam_timeout_minutes: intValue(req.body.spam_timeout_minutes, 5),
                anti_mass_mention_enabled: boolValue(req.body.anti_mass_mention_enabled),
                mass_mention_limit: intValue(req.body.mass_mention_limit, 5),
                mass_mention_timeout_minutes: intValue(req.body.mass_mention_timeout_minutes, 5),
                anti_scam_links_enabled: boolValue(req.body.anti_scam_links_enabled),
                anti_raid_join_enabled: boolValue(req.body.anti_raid_join_enabled),
                raid_join_limit: intValue(req.body.raid_join_limit, 10),
                raid_join_interval: intValue(req.body.raid_join_interval, 10),
                raid_join_action: req.body.raid_join_action || 'lockdown',
                raid_lockdown_minutes: intValue(req.body.raid_lockdown_minutes, 10),
                logs_channel_id: req.body.logs_channel_id
            });

            return redirectWithSuccess(res, guildUrl(req, '/automod'), 'Automod sauvegarde.');
        } catch (error) {
            return next(error);
        }
    }
);

app.get('/guilds/:guildId/logs',
    requireAuth,
    requireGuildAccess,
    requireAdminOrOwner,
    withGuildContext,
    async (req, res, next) => {
        try {
            return res.renderDashboard('logs', {
                title: 'Logs',
                config: await getLogsConfig(req.params.guildId),
                warnings: await getWarnings(req.params.guildId),
                options: req.dashboardOptions
            });
        } catch (error) {
            return next(error);
        }
    }
);

app.post('/guilds/:guildId/logs',
    requireAuth,
    requireGuildAccess,
    requireAdminOrOwner,
    async (req, res, next) => {
        try {
            await updateLogsConfig(req.params.guildId, {
                salon_logs_id: req.body.salon_logs_id,
                automod_logs_channel_id: req.body.automod_logs_channel_id
            });

            return redirectWithSuccess(res, guildUrl(req, '/logs'), 'Logs sauvegardes.');
        } catch (error) {
            return next(error);
        }
    }
);

app.get('/guilds/:guildId/rolemenu',
    requireAuth,
    requireGuildAccess,
    requireAdminOrOwner,
    withGuildContext,
    async (req, res, next) => {
        try {
            const rolemenus = await listRolemenus(req.params.guildId);
            const rolemenuRoles = await Promise.all(
                rolemenus.map(menu => getRolemenuRoles(menu.id))
            );
            const menusWithRoles = rolemenus.map((menu, index) => ({
                ...menu,
                roles: rolemenuRoles[index]
            }));

            return res.renderDashboard('rolemenu', {
                title: 'Role menus',
                rolemenus: menusWithRoles,
                options: req.dashboardOptions
            });
        } catch (error) {
            return next(error);
        }
    }
);

app.post('/guilds/:guildId/rolemenu',
    requireAuth,
    requireGuildAccess,
    requireAdminOrOwner,
    withGuildContext,
    async (req, res, next) => {
        const action = req.body.action;

        try {
            if (action === 'create') {
                await createRolemenu(req.params.guildId, {
                    nomInterne: req.body.nom_interne,
                    titre: req.body.titre,
                    description: req.body.description,
                    placeholder: req.body.placeholder,
                    couleur: req.body.couleur
                });
            }

            if (action === 'update') {
                await updateRolemenu(req.params.guildId, req.body.rolemenu_id, {
                    nomInterne: req.body.nom_interne,
                    titre: req.body.titre,
                    description: req.body.description,
                    placeholder: req.body.placeholder,
                    couleur: req.body.couleur,
                    channelId: req.body.channel_id
                });
            }

            if (action === 'toggle') {
                await setRolemenuEnabled(req.params.guildId, req.body.rolemenu_id, boolValue(req.body.actif));
            }

            if (action === 'delete') {
                await deleteRolemenu(req.params.guildId, req.body.rolemenu_id);
            }

            if (action === 'add-role') {
                await addRoleOption(req.body.rolemenu_id, {
                    roleId: req.body.role_id,
                    label: req.body.label,
                    description: req.body.description,
                    emoji: req.body.emoji,
                    position: intValue(req.body.position, 0)
                });
            }

            if (action === 'update-role') {
                await updateRoleOption(req.body.rolemenu_id, req.body.role_id, {
                    label: req.body.label,
                    description: req.body.description,
                    emoji: req.body.emoji,
                    position: intValue(req.body.position, 0),
                    actif: boolValue(req.body.actif)
                });
            }

            if (action === 'remove-role') {
                await removeRoleOption(req.body.rolemenu_id, req.body.role_id);
            }

            if (action === 'send') {
                const rolemenu = await getRolemenu(req.params.guildId, req.body.rolemenu_id);
                const channel = req.guildAccess.botGuild.channels.cache.get(req.body.channel_id);

                if (!rolemenu || !channel?.isTextBased()) {
                    return redirectWithError(res, guildUrl(req, '/rolemenu'), 'Rolemenu ou salon introuvable.');
                }

                const payload = await buildRolemenuPayload(req.guildAccess.botGuild, rolemenu);
                const message = await channel.send(payload);
                await setRolemenuMessage(req.params.guildId, rolemenu.id, channel.id, message.id);
            }

            if (action === 'sync') {
                const result = await syncRoleMenu(getDiscordClient(), req.params.guildId, req.body.rolemenu_id);

                if (!result.synced && !result.skipped) {
                    return redirectWithError(res, guildUrl(req, '/rolemenu'), result.message);
                }
            }

            return redirectWithSuccess(res, guildUrl(req, '/rolemenu'), 'Rolemenu sauvegarde.');
        } catch (error) {
            console.error('[Dashboard] Rolemenu:', error);
            return redirectWithError(res, guildUrl(req, '/rolemenu'), 'Action rolemenu impossible.');
        }
    }
);

app.get('/guilds/:guildId/tickets',
    requireAuth,
    requireGuildAccess,
    requireAdminOrOwner,
    withGuildContext,
    async (req, res, next) => {
        try {
            return res.renderDashboard('tickets', {
                title: 'Tickets',
                summary: await getTicketsSummary(req.params.guildId),
                config: await getTicketConfig(req.params.guildId),
                pingRoles: await getTicketPingRoles(req.params.guildId),
                options: req.dashboardOptions
            });
        } catch (error) {
            return next(error);
        }
    }
);

app.post('/guilds/:guildId/tickets',
    requireAuth,
    requireGuildAccess,
    requireAdminOrOwner,
    async (req, res, next) => {
        try {
            await updateTicketConfig(req.params.guildId, {
                panel_channel_id: req.body.panel_channel_id,
                staff_role_id: req.body.staff_role_id,
                category_id: req.body.category_id,
                logs_channel_id: req.body.logs_channel_id,
                alert_channel_id: req.body.alert_channel_id,
                alert_message: req.body.alert_message
            });

            await replaceTicketPingRoles(req.params.guildId, arrayValue(req.body.ping_role_ids));

            return redirectWithSuccess(res, guildUrl(req, '/tickets'), 'Tickets sauvegardes.');
        } catch (error) {
            return next(error);
        }
    }
);

app.get('/guilds/:guildId/textes',
    requireAuth,
    requireGuildAccess,
    requireAdminOrOwner,
    withGuildContext,
    async (req, res, next) => {
        try {
            return res.renderDashboard('textes', {
                title: 'Textes',
                texts: await getTexts(req.params.guildId)
            });
        } catch (error) {
            return next(error);
        }
    }
);

app.post('/guilds/:guildId/textes',
    requireAuth,
    requireGuildAccess,
    requireAdminOrOwner,
    async (req, res, next) => {
        try {
            await updateTexts(req.params.guildId, {
                texte_reglement: req.body.texte_reglement,
                ticket_alert_message: req.body.ticket_alert_message
            });

            return redirectWithSuccess(res, guildUrl(req, '/textes'), 'Textes sauvegardes.');
        } catch (error) {
            return next(error);
        }
    }
);

app.get('/guilds/:guildId/stats',
    requireAuth,
    requireGuildAccess,
    requireAdminOrOwner,
    withGuildContext,
    async (req, res, next) => {
        try {
            return res.renderDashboard('stats', {
                title: 'Stats',
                statsConfig: await getStatsDashboardConfig(req.params.guildId),
                options: req.dashboardOptions
            });
        } catch (error) {
            return next(error);
        }
    }
);

app.post('/guilds/:guildId/stats',
    requireAuth,
    requireGuildAccess,
    requireAdminOrOwner,
    async (req, res, next) => {
        try {
            await updateStatsDashboardConfig(req.params.guildId, {
                enabled: boolValue(req.body.enabled),
                leaderboard_channel_id: req.body.leaderboard_channel_id,
                daily_send_time: req.body.daily_send_time,
                admin_role_ids: arrayValue(req.body.admin_role_ids)
            });

            return redirectWithSuccess(res, guildUrl(req, '/stats'), 'Stats sauvegardees.');
        } catch (error) {
            return next(error);
        }
    }
);

app.get('/guilds/:guildId/embeds',
    requireAuth,
    requireGuildAccess,
    requireAdminOrOwner,
    withGuildContext,
    async (req, res) => {
        return res.renderDashboard('embeds', {
            title: 'Embeds'
        });
    }
);

app.use((error, req, res, next) => {
    console.error('[Dashboard] Erreur:', error);
    if (res.headersSent) return next(error);

    if (String(error?.message || '').startsWith('Promises non resolues dans les donnees EJS')) {
        return res.status(500).renderDashboard('login', {
            title: 'Erreur dashboard',
            error: error.message
        });
    }

    return res.status(500).renderDashboard('login', {
        title: 'Erreur',
        error: 'Une erreur est survenue cote dashboard.'
    });
});

function startDashboard(client) {
    if (client) {
        setDiscordClient(client);
    }

    if (started) return app;
    started = true;

    app.listen(port, '0.0.0.0', () => {
        console.log(`[Dashboard] Pret sur http://0.0.0.0:${port}`);
        console.log(`[Dashboard] URL publique: ${baseUrl}`);
        console.log(`[Dashboard] Callback Discord: ${callbackUrl}`);
    });

    return app;
}

startDashboard();

module.exports = {
    app,
    setClient: setDiscordClient,
    startDashboard
};

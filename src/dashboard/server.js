const path = require('path');
const ejs = require('ejs');
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const pgSession = require('connect-pg-simple')(session);
const { ChannelType } = require('discord.js');

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
    getLogsConfig,
    getRolemenus,
    getServerConfig,
    getStatsSummary,
    getTexts,
    getTicketsSummary,
    getWarnings,
    updateAutomodConfig,
    updateLogsConfig,
    updateServerConfig
} = require('./services/dashboardData');

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
    const viewLocals = {
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

    const body = await ejs.renderFile(
        path.join(viewsDir, `${view}.ejs`),
        viewLocals,
        { async: true }
    );

    return res.send(await ejs.renderFile(
        path.join(viewsDir, 'layout.ejs'),
        { ...viewLocals, body },
        { async: true }
    ));
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
            name: channel.name
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
}

function mapRoles(guild) {
    return guild.roles.cache
        .filter(role => role.id !== guild.id)
        .map(role => ({
            id: role.id,
            name: role.name,
            color: role.hexColor
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
                iconURL: access.botGuild?.iconURL?.({ size: 64 }) || null,
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
            const [serverConfig, automod, rolemenus, tickets, stats] = await Promise.all([
                getServerConfig(req.params.guildId, req.currentGuild.name),
                getAutomodConfig(req.params.guildId),
                getRolemenus(req.params.guildId),
                getTicketsSummary(req.params.guildId),
                getStatsSummary(req.params.guildId)
            ]);

            return res.renderDashboard('guild-dashboard', {
                title: req.currentGuild.name,
                serverConfig,
                automod,
                rolemenus,
                tickets,
                stats
            });
        } catch (error) {
            return next(error);
        }
    }
);

app.get('/guilds/:guildId/settings',
    requireAuth,
    requireGuildAccess,
    requireAdminOrOwner,
    withGuildContext,
    async (req, res, next) => {
        try {
            return res.renderDashboard('settings', {
                title: 'Parametres',
                config: await getServerConfig(req.params.guildId, req.currentGuild.name),
                options: req.dashboardOptions
            });
        } catch (error) {
            return next(error);
        }
    }
);

app.post('/guilds/:guildId/settings',
    requireAuth,
    requireGuildAccess,
    requireAdminOrOwner,
    async (req, res, next) => {
        try {
            await updateServerConfig(req.params.guildId, {
                salon_logs_id: req.body.salon_logs_id,
                salon_bienvenue_id: req.body.salon_bienvenue_id,
                salon_depart_id: req.body.salon_depart_id,
                salon_radio_id: req.body.salon_radio_id,
                automod_actif: boolValue(req.body.automod_actif),
                captcha_actif: boolValue(req.body.captcha_actif),
                role_non_verifie_id: req.body.role_non_verifie_id,
                role_membre_id: req.body.role_membre_id,
                categorie_captcha_id: req.body.categorie_captcha_id,
                role_reglement_id: req.body.role_reglement_id,
                texte_reglement: req.body.texte_reglement
            });

            return redirectWithSuccess(res, guildUrl(req, '/settings'), 'Parametres sauvegardes.');
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
    withGuildContext,
    async (req, res, next) => {
        try {
            return res.renderDashboard('rolemenu', {
                title: 'Role menus',
                rolemenus: await getRolemenus(req.params.guildId)
            });
        } catch (error) {
            return next(error);
        }
    }
);

app.get('/guilds/:guildId/tickets',
    requireAuth,
    requireGuildAccess,
    withGuildContext,
    async (req, res, next) => {
        try {
            return res.renderDashboard('tickets', {
                title: 'Tickets',
                summary: await getTicketsSummary(req.params.guildId)
            });
        } catch (error) {
            return next(error);
        }
    }
);

app.get('/guilds/:guildId/textes',
    requireAuth,
    requireGuildAccess,
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

app.get('/guilds/:guildId/embeds',
    requireAuth,
    requireGuildAccess,
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

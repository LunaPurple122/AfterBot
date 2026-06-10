require('dotenv').config();

const { validateEnv } = require('./core/env');
validateEnv();

const { testDatabaseConnection } = require('./database/db');
const { initDatabase } = require('./database/init');
const { envoyerLog } = require('./core/logger');
const {
    recoverActiveVoiceSessions
} = require('./modules/stats/services/voiceSessionService');
const {
    startStatsScheduler
} = require('./modules/stats/services/statsSchedulerService');
const {
    startBumpReminders
} = require('./modules/bump/services/bumpService');

const fs = require('fs');
const path = require('path');

const {
    Client,
    Collection,
    GatewayIntentBits,
    Events,
    Partials
} = require('discord.js');

const {
    isIgnoredInteractionError,
    patchInteractionResponses,
    safeDeferReply,
    safeReply
} = require('./core/interactions');

const client = new Client({
    intents: [
        // Guilds: slash commands, salons, rôles et configuration serveur.
        GatewayIntentBits.Guilds,
        // GuildMessages + MessageContent: automod, captcha, tickets et logs de messages.
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        // GuildMembers: bienvenue/départ, captcha, autoroles, modération membres.
        GatewayIntentBits.GuildMembers,
        // GuildModeration: bans, unbans et audit logs de modération.
        GatewayIntentBits.GuildModeration,
        // GuildVoiceStates: logs des connexions, départs et déplacements vocaux.
        GatewayIntentBits.GuildVoiceStates,
        // GuildExpressions: logs emojis/stickers.
        GatewayIntentBits.GuildExpressions
    ],

    partials: [
        Partials.Message,
        Partials.Channel,
        Partials.Reaction
    ]
});

require('./dashboard/server').setClient(client);

client.commands = new Collection();

const modulesPath = path.join(__dirname, 'modules');

process.on('unhandledRejection', error => {
    console.error(
        'Unhandled rejection:',
        error
    );
});

process.on('uncaughtException', error => {
    console.error(
        'Uncaught exception:',
        error
    );
});

client.on('error', error => {
    console.error(
        'Erreur client Discord:',
        error
    );
});

client.on(Events.InteractionCreate, interaction => {
    patchInteractionResponses(interaction);
});

function recupererFichiers(dossier) {

    let fichiers = [];

    const elements =
        fs.readdirSync(dossier, {
            withFileTypes: true
        });

    for (const element of elements) {

        const chemin =
            path.join(dossier, element.name);

        if (element.isDirectory()) {

            fichiers =
                fichiers.concat(
                    recupererFichiers(chemin)
                );

        } else if (
            element.name.endsWith('.js')
        ) {

            fichiers.push(chemin);
        }
    }

    return fichiers;
}

function normaliserEvents(loadedFile) {
    if (
        loadedFile &&
        loadedFile.name &&
        loadedFile.execute
    ) {
        return [loadedFile];
    }

    return Object.values(loadedFile);
}

function registerEvent(event) {
    const handler = async (...args) => {
        const interaction =
            args.find(arg =>
                arg &&
                typeof arg.isRepliable === 'function' &&
                arg.isRepliable()
            );

        if (interaction) {
            patchInteractionResponses(interaction);
        }

        try {
            await event.execute(...args);
        } catch (error) {
            if (isIgnoredInteractionError(error)) {
                console.warn(
                    `Interaction expirée ou déjà acquittée dans l'event ${event.name} : ${error.message}`
                );
                return;
            }

            console.error(
                `Erreur dans l'event ${event.name} :`,
                error
            );

            if (interaction) {
                await safeReply(interaction, {
                    content:
                        '❌ Une erreur est survenue.',
                    ephemeral: true
                });
            }
        }
    };

    if (event.once) {
        client.once(event.name, handler);
        return;
    }

    client.on(event.name, handler);
}

// COMMANDES
const commandFiles =
    recupererFichiers(modulesPath);

for (const filePath of commandFiles) {

    const command =
        require(filePath);

    if (!command.data) continue;

    client.commands.set(
        command.data.name,
        command
    );

    console.log(
`✅ Commande chargée : ${command.data.name}`
    );
}

// EVENTS CLASSIQUES
const eventsPath =
    path.join(__dirname, 'events');

if (fs.existsSync(eventsPath)) {

    const eventFiles =
        fs.readdirSync(eventsPath)
            .filter(file =>
                file.endsWith('.js')
            );

    for (const file of eventFiles) {

        const filePath =
            path.join(eventsPath, file);

        const loadedFile =
            require(filePath);

        const events =
            normaliserEvents(loadedFile);

        for (const event of events) {

            if (
                !event.name ||
                !event.execute
            ) continue;

            registerEvent(event);

            console.log(
`✅ Event chargé : ${event.name}`
            );
        }
    }
}

// EVENTS MODULES
const moduleEventFiles =
    recupererFichiers(modulesPath);

for (const filePath of moduleEventFiles) {

    if (
        !filePath.includes(
            `${path.sep}events${path.sep}`
        )
    ) continue;

    const loadedFile =
        require(filePath);

    const events =
        normaliserEvents(loadedFile);

    for (const event of events) {

        if (
            !event.name ||
            !event.execute
        ) continue;

        registerEvent(event);

        console.log(
`✅ Event chargé : ${event.name}`
        );
    }
}

client.once(Events.ClientReady, async readyClient => {

    console.log(
`🤖 Connecté en tant que ${readyClient.user.tag}`
    );

    await testDatabaseConnection();

    await initDatabase();

    await recoverActiveVoiceSessions(readyClient);

    startStatsScheduler(readyClient);

    await startBumpReminders(readyClient);
});

client.on(Events.InteractionCreate, async interaction => {

    if (!interaction.isChatInputCommand()) return;

    patchInteractionResponses(interaction);

    envoyerLog(client, interaction.guild?.id, {

        titre: '🤖 Commande utilisée',

        description:
`👤 Utilisateur : ${interaction.user}

⚡ Commande :
/${interaction.commandName}

📍 Salon :
${interaction.channel}`,

        couleur: 0x5865F2,

        auteur: interaction.user
    }).catch(error => {
        console.error(
            `Erreur log commande /${interaction.commandName}:`,
            error
        );
    });

    const command =
        client.commands.get(
            interaction.commandName
        );

    if (!command) return;

    try {
        if (command.deferOnStart) {
            await safeDeferReply(interaction, {
                ephemeral: true
            });
        }

        await command.execute(interaction);

    } catch (error) {
        if (isIgnoredInteractionError(error)) {
            console.warn(
                `Interaction expirée ou déjà acquittée /${interaction.commandName} : ${error.message}`
            );
            return;
        }

        console.error(error);

        await safeReply(interaction, {
            content:
                '❌ Une erreur est survenue.',
            ephemeral: true
        });
    }
});

client.login(process.env.DISCORD_TOKEN);

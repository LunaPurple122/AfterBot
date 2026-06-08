require('dotenv').config();

const { validateEnv } = require('./core/env');
validateEnv();

const { testDatabaseConnection } = require('./database/db');
const { initDatabase } = require('./database/init');
const { envoyerLog } = require('./core/logger');

const fs = require('fs');
const path = require('path');

const {
    Client,
    Collection,
    GatewayIntentBits,
    Events,
    MessageFlags,
    Partials
} = require('discord.js');

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

client.commands = new Collection();

const modulesPath = path.join(__dirname, 'modules');

function isUnknownInteractionError(error) {
    return (
        error?.code === 10062 ||
        String(error?.message || '')
            .includes('Unknown interaction')
    );
}

function normalizeInteractionOptions(options) {
    if (
        !options ||
        typeof options !== 'object' ||
        options.ephemeral !== true
    ) {
        return options;
    }

    const normalized = {
        ...options
    };

    delete normalized.ephemeral;

    normalized.flags =
        Number(normalized.flags || 0) |
        MessageFlags.Ephemeral;

    return normalized;
}

function patchInteractionResponses(interaction) {
    if (interaction.__safeResponsesPatched) {
        return;
    }

    interaction.__safeResponsesPatched = true;

    for (const methodName of [
        'reply',
        'followUp',
        'deferReply'
    ]) {
        if (typeof interaction[methodName] !== 'function') {
            continue;
        }

        const originalMethod =
            interaction[methodName].bind(interaction);

        interaction[methodName] = options =>
            originalMethod(
                normalizeInteractionOptions(options)
            );
    }
}

async function safeDefer(interaction) {
    if (
        interaction.deferred ||
        interaction.replied
    ) {
        return true;
    }

    try {
        await interaction.deferReply({
            flags:
                MessageFlags.Ephemeral
        });

        return true;

    } catch (error) {
        if (isUnknownInteractionError(error)) {
            console.error(
                `Interaction expirée avant defer /${interaction.commandName}:`,
                error
            );
            return false;
        }

        console.error(
            `Erreur defer interaction /${interaction.commandName}:`,
            error
        );
        return false;
    }
}

async function safeReply(interaction, options) {
    const normalizedOptions =
        normalizeInteractionOptions({
            ...options,
            flags:
                Number(options?.flags || 0) |
                MessageFlags.Ephemeral
        });

    try {
        if (interaction.deferred && !interaction.replied) {
            const editOptions = {
                ...normalizedOptions
            };

            delete editOptions.flags;

            return await interaction.editReply(editOptions);
        }

        if (interaction.replied) {
            return await interaction.followUp(normalizedOptions);
        }

        return await interaction.reply(normalizedOptions);

    } catch (error) {
        if (isUnknownInteractionError(error)) {
            console.error(
                `Interaction expirée avant réponse /${interaction.commandName}:`,
                error
            );
            return null;
        }

        console.error(
            `Erreur réponse interaction /${interaction.commandName}:`,
            error
        );
        return null;
    }
}

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
        try {
            await event.execute(...args);
        } catch (error) {
            console.error(
                `Erreur dans l'event ${event.name} :`,
                error
            );
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
            await safeDefer(interaction);
        }

        await command.execute(interaction);

    } catch (error) {

        console.error(error);

        await safeReply(interaction, {
            content:
                '❌ Une erreur est survenue.'
        });
    }
});

client.login(process.env.DISCORD_TOKEN);

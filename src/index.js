require('dotenv').config();

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
    Partials
} = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.GuildExpressions,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences
    ],

    partials: [
        Partials.Message,
        Partials.Channel,
        Partials.Reaction
    ]
});

client.commands = new Collection();

const modulesPath = path.join(__dirname, 'modules');

function recupererCommandes(dossier) {

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
                    recupererCommandes(chemin)
                );

        } else if (
            element.name.endsWith('.js')
        ) {

            fichiers.push(chemin);
        }
    }

    return fichiers;
}

const commandFiles =
    recupererCommandes(modulesPath);

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

client.once(Events.ClientReady, async readyClient => {

    console.log(`🤖 Connecté en tant que ${readyClient.user.tag}`);

    await testDatabaseConnection();

    await initDatabase();
});

client.on(Events.InteractionCreate, async interaction => {

    if (!interaction.isChatInputCommand()) return;

    await envoyerLog(client, interaction.guild.id, {

        titre: '🤖 Commande utilisée',

        description:
`👤 Utilisateur : ${interaction.user}

⚡ Commande :
/${interaction.commandName}

📍 Salon :
${interaction.channel}`,

        couleur: 0x5865F2,

        auteur: interaction.user
    });

    const command =
        client.commands.get(
            interaction.commandName
        );

    if (!command) return;

    try {

        await command.execute(interaction);

    } catch (error) {

        console.error(error);

        if (
            interaction.replied ||
            interaction.deferred
        ) {

            await interaction.followUp({

                content:
                    '❌ Une erreur est survenue.',

                ephemeral: true
            });

        } else {

            await interaction.reply({

                content:
                    '❌ Une erreur est survenue.',

                ephemeral: true
            });
        }
    }
});

const eventsPath = path.join(__dirname, 'events');

if (fs.existsSync(eventsPath)) {

    const eventFiles = fs.readdirSync(eventsPath)
        .filter(file => file.endsWith('.js'));

    for (const file of eventFiles) {

        const filePath =
            path.join(eventsPath, file);

        console.log(filePath);

        const loadedFile =
            require(filePath);

        const events =
            Object.values(loadedFile);

        for (const event of events) {

            if (
                !event.name ||
                !event.execute
            ) continue;

            if (event.once) {

                client.once(event.name, (...args) =>
                    event.execute(...args)
                );

            } else {

                client.on(event.name, (...args) =>
                    event.execute(...args)
                );
            }

            console.log(
                `✅ Event chargé : ${event.name}`
            );
        }
    }
}

client.login(process.env.DISCORD_TOKEN);
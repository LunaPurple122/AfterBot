require('dotenv').config();

const fs = require('fs');
const path = require('path');

const {
    Client,
    Collection,
    GatewayIntentBits,
    Events
} = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences
    ]
});

client.commands = new Collection();

const modulesPath = path.join(__dirname, 'modules');

const modules = fs.readdirSync(modulesPath);

for (const moduleName of modules) {
    const commandsPath = path.join(modulesPath, moduleName, 'commands');

    if (!fs.existsSync(commandsPath)) continue;

    const commandFiles = fs.readdirSync(commandsPath)
        .filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);

        const command = require(filePath);

        client.commands.set(command.data.name, command);

        console.log(`✅ Commande chargée : ${command.data.name}`);
    }
}

client.once(Events.ClientReady, readyClient => {
    console.log(`🤖 Connecté en tant que ${readyClient.user.tag}`);
});

client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);

    if (!command) return;

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);

        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({
                content: '❌ Une erreur est survenue.',
                ephemeral: true
            });
        } else {
            await interaction.reply({
                content: '❌ Une erreur est survenue.',
                ephemeral: true
            });
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
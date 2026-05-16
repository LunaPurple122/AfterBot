require('dotenv').config();

const fs = require('fs');
const path = require('path');

const { REST, Routes } = require('discord.js');

const commands = [];

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

        commands.push(command.data.toJSON());

        console.log(`✅ Commande préparée : ${command.data.name}`);
    }
}

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log('🔄 Déploiement des commandes slash...');

        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands },
        );

        console.log('✅ Commandes déployées.');
    } catch (error) {
        console.error(error);
    }
})();
require('dotenv').config();

const fs = require('fs');
const path = require('path');

const { REST, Routes } = require('discord.js');

const commands = [];

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

    commands.push(
        command.data.toJSON()
    );

    console.log(
        `✅ Commande préparée : ${command.data.name}`
    );
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
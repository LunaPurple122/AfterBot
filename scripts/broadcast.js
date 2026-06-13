require('dotenv').config();

const readline = require('readline');
const { pool } = require('../src/database/db');
const {
    createBroadcastJob,
    ensureBroadcastTable
} = require('../src/core/broadcastService');

const MAX_TITLE_LENGTH = 256;
const MAX_MESSAGE_LENGTH = 4096;

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true
});

function ask(question) {
    return new Promise(resolve => {
        rl.question(question, answer => {
            resolve(answer);
        });
    });
}

async function askRequiredTitle() {
    while (true) {
        const title =
            (await ask('Titre du broadcast: ')).trim();

        if (!title) {
            console.log('Le titre ne peut pas etre vide.');
            continue;
        }

        if (title.length > MAX_TITLE_LENGTH) {
            console.log(
                `Le titre depasse ${MAX_TITLE_LENGTH} caracteres.`
            );
            continue;
        }

        return title;
    }
}

async function askMultilineMessage() {
    while (true) {
        console.log(
            'Message multi-lignes. Termine la saisie avec une ligne contenant seulement .send'
        );

        const lines = [];

        while (true) {
            const line = await ask('> ');

            if (line === '.send') {
                break;
            }

            lines.push(line);
        }

        const message =
            lines.join('\n').trim();

        if (!message) {
            console.log('Le message ne peut pas etre vide.');
            continue;
        }

        if (message.length > MAX_MESSAGE_LENGTH) {
            console.log(
                `Le message fait ${message.length} caracteres. La limite Discord embed est ${MAX_MESSAGE_LENGTH}. Raccourcis-le.`
            );
            continue;
        }

        return message;
    }
}

async function askYesNo(question) {
    while (true) {
        const answer =
            (await ask(`${question} (o/n): `))
                .trim()
                .toLowerCase();

        if (['o', 'oui', 'y', 'yes'].includes(answer)) {
            return true;
        }

        if (['n', 'non', 'no'].includes(answer)) {
            return false;
        }

        console.log('Reponds par oui ou non.');
    }
}

async function main() {
    await ensureBroadcastTable();

    console.log('=== Broadcast global AfterBot ===');

    const title =
        await askRequiredTitle();

    const message =
        await askMultilineMessage();

    const sendToLogs =
        await askYesNo('Envoyer dans les salons de logs ?');

    const sendToOwners =
        await askYesNo('Envoyer en MP aux proprietaires des serveurs ?');

    console.log('\nResume:');
    console.log(`Titre: ${title}`);
    console.log(`Longueur message: ${message.length}/${MAX_MESSAGE_LENGTH}`);
    console.log(`Salons de logs: ${sendToLogs ? 'oui' : 'non'}`);
    console.log(`MP proprietaires: ${sendToOwners ? 'oui' : 'non'}`);

    const confirmed =
        await askYesNo('Confirmer la creation du broadcast ?');

    if (!confirmed) {
        console.log('Broadcast annule.');
        return;
    }

    const job =
        await createBroadcastJob({
            title,
            message,
            sendToLogs,
            sendToOwners
        });

    console.log(
        `Broadcast cree en pending avec l'id ${job.id}. Le bot le traitera sous 10 secondes.`
    );
}

main()
    .catch(error => {
        console.error('Creation du broadcast impossible:', error);
        process.exitCode = 1;
    })
    .finally(async () => {
        rl.close();
        await pool.end();
    });

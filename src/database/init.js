const fs = require('fs');

const path = require('path');

const { pool } =
    require('./db');

async function initDatabase() {

    // TABLE PRINCIPALE
    await pool.query(`

        CREATE TABLE IF NOT EXISTS serveurs (

            id SERIAL PRIMARY KEY,

            serveur_id VARCHAR(32)
                UNIQUE NOT NULL,

            nom VARCHAR(255),

            salon_logs_id VARCHAR(32),

            salon_bienvenue_id VARCHAR(32),

            salon_radio_id VARCHAR(32),

            automod_active BOOLEAN
                DEFAULT false,

            captcha_actif BOOLEAN
                DEFAULT false,

            cree_le TIMESTAMP
                DEFAULT CURRENT_TIMESTAMP,

            modifie_le TIMESTAMP
                DEFAULT CURRENT_TIMESTAMP
        );
    `);

    console.log(
        '✅ Table serveurs prête'
    );

    // MODULES
    const modulesPath =
        path.join(
            __dirname,
            '..',
            'modules'
        );

    const modules =
        fs.readdirSync(modulesPath);

    for (const moduleName of modules) {

        const initPath =
            path.join(

                modulesPath,

                moduleName,

                'database',

                'init.js'
            );

        if (
            !fs.existsSync(initPath)
        ) continue;

        try {

            const moduleInit =
                require(initPath);

            // initModule()
            const initFunction =
                Object.values(
                    moduleInit
                )[0];

            if (
                typeof initFunction ===
                'function'
            ) {

                await initFunction();

                console.log(
`✅ Database module chargé :
${moduleName}`
                );
            }

        } catch (error) {

            console.error(

`❌ Erreur database module :
${moduleName}`,

                error
            );
        }
    }
}

module.exports = {
    initDatabase,
};
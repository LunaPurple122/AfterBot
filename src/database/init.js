const fs = require('fs');

const path = require('path');

const { pool } =
    require('./db');

async function createUniqueIndexIfNoDuplicates({
    tableName,
    indexName,
    columns,
    whereClause = ''
}) {
    const duplicateResult = await pool.query(`
        SELECT ${columns.join(', ')}, COUNT(*) AS total
        FROM ${tableName}
        ${whereClause}
        GROUP BY ${columns.join(', ')}
        HAVING COUNT(*) > 1
        LIMIT 1;
    `);

    if (duplicateResult.rows.length > 0) {
        console.error(
            `Index unique ${indexName} ignoré: doublons existants dans ${tableName}.`
        );
        return;
    }

    await pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS ${indexName}
        ON ${tableName} (${columns.join(', ')})
        ${whereClause};
    `);
}

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

            salon_depart_id VARCHAR(32),

            salon_radio_id VARCHAR(32),

            automod_actif BOOLEAN
                DEFAULT false,

            captcha_actif BOOLEAN
                DEFAULT false,

            role_non_verifie_id VARCHAR(32),

            role_membre_id VARCHAR(32),

            categorie_captcha_id VARCHAR(32),

            role_reglement_id VARCHAR(32),

            cree_le TIMESTAMP
                DEFAULT CURRENT_TIMESTAMP,

            modifie_le TIMESTAMP
                DEFAULT CURRENT_TIMESTAMP
        );
    `);

    await pool.query(`
        ALTER TABLE IF EXISTS serveurs
        ADD COLUMN IF NOT EXISTS salon_depart_id VARCHAR(32),
        ADD COLUMN IF NOT EXISTS salon_radio_id VARCHAR(32),
        ADD COLUMN IF NOT EXISTS automod_actif BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS captcha_actif BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS role_non_verifie_id VARCHAR(32),
        ADD COLUMN IF NOT EXISTS role_membre_id VARCHAR(32),
        ADD COLUMN IF NOT EXISTS categorie_captcha_id VARCHAR(32),
        ADD COLUMN IF NOT EXISTS role_reglement_id VARCHAR(32);
    `);

    await pool.query(`
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_name = 'serveurs'
                AND column_name = 'automod_active'
            ) THEN
                UPDATE serveurs
                SET automod_actif = COALESCE(automod_actif, false)
                    OR COALESCE(automod_active, false);
            END IF;
        END $$;
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_serveurs_salon_logs
        ON serveurs (salon_logs_id);
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
    createUniqueIndexIfNoDuplicates
};

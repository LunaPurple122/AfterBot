const { pool } =
    require('../../../database/db');

const {
    createUniqueIndexIfNoDuplicates
} = require('../../../database/init');

async function initRolemenuTables() {

    await pool.query(`

        CREATE TABLE IF NOT EXISTS rolemenus (

            id SERIAL PRIMARY KEY,

            guild_id VARCHAR(32)
                NOT NULL,

            channel_id VARCHAR(32),

            message_id VARCHAR(32),

            nom_interne VARCHAR(100)
                NOT NULL,

            titre TEXT
                NOT NULL,

            description TEXT,

            placeholder TEXT
                DEFAULT 'Choisis un rôle',

            couleur VARCHAR(16),

            actif BOOLEAN
                DEFAULT TRUE,

            cree_le TIMESTAMP
                DEFAULT CURRENT_TIMESTAMP,

            modifie_le TIMESTAMP
                DEFAULT CURRENT_TIMESTAMP
        );
    `);

    await pool.query(`
        ALTER TABLE IF EXISTS rolemenus
        ADD COLUMN IF NOT EXISTS guild_id VARCHAR(32),
        ADD COLUMN IF NOT EXISTS channel_id VARCHAR(32),
        ADD COLUMN IF NOT EXISTS message_id VARCHAR(32),
        ADD COLUMN IF NOT EXISTS nom_interne VARCHAR(100),
        ADD COLUMN IF NOT EXISTS titre TEXT,
        ADD COLUMN IF NOT EXISTS description TEXT,
        ADD COLUMN IF NOT EXISTS placeholder TEXT DEFAULT 'Choisis un rôle',
        ADD COLUMN IF NOT EXISTS couleur VARCHAR(16),
        ADD COLUMN IF NOT EXISTS actif BOOLEAN DEFAULT TRUE,
        ADD COLUMN IF NOT EXISTS cree_le TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ADD COLUMN IF NOT EXISTS modifie_le TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    `);

    await pool.query(`

        CREATE TABLE IF NOT EXISTS rolemenu_roles (

            id SERIAL PRIMARY KEY,

            rolemenu_id INTEGER
                NOT NULL
                REFERENCES rolemenus(id)
                ON DELETE CASCADE,

            role_id VARCHAR(32)
                NOT NULL,

            label VARCHAR(100)
                NOT NULL,

            description VARCHAR(100),

            emoji VARCHAR(64),

            position INTEGER
                DEFAULT 0,

            actif BOOLEAN
                DEFAULT TRUE,

            cree_le TIMESTAMP
                DEFAULT CURRENT_TIMESTAMP,

            modifie_le TIMESTAMP
                DEFAULT CURRENT_TIMESTAMP,

            UNIQUE (rolemenu_id, role_id)
        );
    `);

    await pool.query(`
        ALTER TABLE IF EXISTS rolemenu_roles
        ADD COLUMN IF NOT EXISTS rolemenu_id INTEGER,
        ADD COLUMN IF NOT EXISTS role_id VARCHAR(32),
        ADD COLUMN IF NOT EXISTS label VARCHAR(100),
        ADD COLUMN IF NOT EXISTS description VARCHAR(100),
        ADD COLUMN IF NOT EXISTS emoji VARCHAR(64),
        ADD COLUMN IF NOT EXISTS position INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS actif BOOLEAN DEFAULT TRUE,
        ADD COLUMN IF NOT EXISTS cree_le TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ADD COLUMN IF NOT EXISTS modifie_le TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    `);

    await pool.query(`
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM pg_constraint
                WHERE conname = 'fk_rolemenu_roles_rolemenu'
            ) THEN
                ALTER TABLE rolemenu_roles
                ADD CONSTRAINT fk_rolemenu_roles_rolemenu
                FOREIGN KEY (rolemenu_id)
                REFERENCES rolemenus(id)
                ON DELETE CASCADE;
            END IF;
        EXCEPTION WHEN others THEN
            RAISE NOTICE 'Contrainte FK rolemenu_roles ignorée: %', SQLERRM;
        END $$;
    `);

    await createUniqueIndexIfNoDuplicates({
        tableName: 'rolemenu_roles',
        indexName: 'idx_rolemenu_roles_unique_menu_role',
        columns: ['rolemenu_id', 'role_id']
    });

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_rolemenus_guild_id
        ON rolemenus (guild_id);
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_rolemenus_channel_id
        ON rolemenus (channel_id);
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_rolemenus_message_id
        ON rolemenus (message_id);
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_rolemenu_roles_rolemenu_id
        ON rolemenu_roles (rolemenu_id);
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_rolemenu_roles_role_id
        ON rolemenu_roles (role_id);
    `);

    console.log(
        '✅ Tables rolemenu prêtes'
    );
}

module.exports = {
    initRolemenuTables
};

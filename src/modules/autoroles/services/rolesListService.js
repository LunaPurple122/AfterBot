const { EmbedBuilder } = require('discord.js');

const { pool } = require('../../../database/db');

const ALTIA_PURPLE =
    0xB99CFF;

const DEFAULT_CATEGORY_NAME =
    'Autoroles';

const CATEGORY_NAME_COLUMNS = [
    'categorie',
    'category',
    'categorie_nom',
    'nom_categorie',
    'category_name',
    'category_label',
    'categorie_label',
    'groupe'
];

const CATEGORY_ORDER_COLUMNS = [
    'categorie_ordre',
    'ordre_categorie',
    'category_order',
    'category_position',
    'categorie_position'
];

const ROLE_ORDER_COLUMNS = [
    'ordre',
    'position',
    'role_ordre',
    'ordre_role',
    'role_position'
];

function firstPresentValue(row, columns) {
    for (const column of columns) {
        if (
            Object.prototype.hasOwnProperty.call(row, column) &&
            row[column] !== null &&
            row[column] !== undefined &&
            String(row[column]).trim() !== ''
        ) {
            return row[column];
        }
    }

    return null;
}

function toNumberOrNull(value) {
    if (value === null || value === undefined || value === '') {
        return null;
    }

    const number =
        Number(value);

    return Number.isFinite(number)
        ? number
        : null;
}

function compareNullableNumber(left, right) {
    if (left !== null && right !== null) {
        return left - right;
    }

    if (left !== null) return -1;
    if (right !== null) return 1;

    return 0;
}

function compareText(left, right) {
    return String(left || '').localeCompare(
        String(right || ''),
        'fr',
        {
            sensitivity: 'base'
        }
    );
}

function getRoleSortPosition(role) {
    if (!role) return Number.NEGATIVE_INFINITY;

    return role.position ?? 0;
}

function makeRoleEntry(row, guild) {
    const role =
        guild.roles.cache.get(row.role_id);

    return {
        id:
            row.role_id,
        name:
            role?.name || 'Rôle supprimé/introuvable',
        mention:
            role ? `<@&${row.role_id}>` : null,
        exists:
            Boolean(role),
        discordPosition:
            getRoleSortPosition(role),
        order:
            toNumberOrNull(
                firstPresentValue(
                    row,
                    ROLE_ORDER_COLUMNS
                )
            )
    };
}

function categoryKey(name, order) {
    return `${order ?? 'none'}:${name}`;
}

function buildCategories(rows, guild) {
    const categoriesByKey =
        new Map();

    for (const row of rows) {
        const name =
            String(
                firstPresentValue(
                    row,
                    CATEGORY_NAME_COLUMNS
                ) || DEFAULT_CATEGORY_NAME
            ).trim();

        const order =
            toNumberOrNull(
                firstPresentValue(
                    row,
                    CATEGORY_ORDER_COLUMNS
                )
            );

        const key =
            categoryKey(name, order);

        if (!categoriesByKey.has(key)) {
            categoriesByKey.set(key, {
                name,
                order,
                roles: []
            });
        }

        categoriesByKey
            .get(key)
            .roles
            .push(
                makeRoleEntry(row, guild)
            );
    }

    const categories =
        [...categoriesByKey.values()];

    for (const category of categories) {
        category.roles.sort((left, right) => {
            const orderCompare =
                compareNullableNumber(
                    left.order,
                    right.order
                );

            if (orderCompare !== 0) return orderCompare;

            if (
                left.discordPosition !== right.discordPosition
            ) {
                return right.discordPosition - left.discordPosition;
            }

            return compareText(
                left.name,
                right.name
            );
        });
    }

    categories.sort((left, right) => {
        const orderCompare =
            compareNullableNumber(
                left.order,
                right.order
            );

        if (orderCompare !== 0) return orderCompare;

        return compareText(
            left.name,
            right.name
        );
    });

    return categories;
}

async function getConfiguredAutoroleCategories(guild) {
    await guild.roles.fetch();

    const result =
        await pool.query(
            `
            SELECT *
            FROM autoroles
            WHERE serveur_id = $1
            ORDER BY id ASC
            `,
            [
                guild.id
            ]
        );

    return buildCategories(
        result.rows,
        guild
    );
}

function roleDisplayLine(role) {
    if (!role.exists) {
        return `⚠️ Rôle supprimé/introuvable — \`${role.id}\``;
    }

    return `${role.mention} — \`${role.id}\``;
}

function splitLines(lines, maxLength) {
    const chunks = [];
    let current = '';

    for (const line of lines) {
        const next =
            current
                ? `${current}\n${line}`
                : line;

        if (next.length > maxLength) {
            if (current) {
                chunks.push(current);
            }

            current =
                line.length > maxLength
                    ? line.slice(0, maxLength - 1)
                    : line;

            continue;
        }

        current = next;
    }

    if (current) {
        chunks.push(current);
    }

    return chunks;
}

function makeBaseEmbed() {
    return new EmbedBuilder()
        .setTitle('📋 Liste des rôles configurés')
        .setDescription(
            'Rôles récupérés depuis la configuration autorole du serveur.'
        )
        .setColor(ALTIA_PURPLE)
        .setFooter({
            text:
                'Spatioport Altia • Autoroles'
        });
}

function buildRolesListEmbeds(categories) {
    const embeds = [];

    if (categories.length === 0) {
        return [
            makeBaseEmbed()
                .addFields({
                    name:
                        'Aucune configuration',
                    value:
                        'Aucune catégorie ou aucun rôle autorole n’est configuré pour ce serveur.'
                })
        ];
    }

    for (const category of categories) {
        const lines =
            category.roles.length > 0
                ? category.roles.map(roleDisplayLine)
                : ['Aucun rôle dans cette catégorie.'];

        const chunks =
            splitLines(lines, 1000);

        chunks.forEach((chunk, index) => {
            const name =
                index === 0
                    ? category.name
                    : `${category.name} (suite)`;

            embeds.push(
                makeBaseEmbed()
                    .addFields({
                        name,
                        value:
                            chunk
                    })
            );
        });
    }

    return embeds;
}

function buildExportBuffer(categories, guild) {
    const lines = [
        'Liste des rôles configurés',
        `Serveur : ${guild.name}`,
        `ID serveur : ${guild.id}`,
        `Généré le : ${new Date().toISOString()}`,
        '',
        '=================================================='
    ];

    const missingRoles = [];

    if (categories.length === 0) {
        lines.push(
            '',
            'Aucune catégorie ou aucun rôle autorole n’est configuré.'
        );
    }

    for (const category of categories) {
        const existingRoles =
            category.roles.filter(role => role.exists);

        const missing =
            category.roles.filter(role => !role.exists);

        missingRoles.push(...missing);

        lines.push(
            '',
            category.name,
            ''
        );

        if (existingRoles.length === 0) {
            lines.push(
                '- Aucun rôle existant dans cette catégorie.'
            );
        }

        for (const role of existingRoles) {
            lines.push(
                `- Nom du rôle : ${role.name}`,
                `  ID : ${role.id}`,
                `  Mention : <@&${role.id}>`,
                '  Existe sur Discord : oui',
                ''
            );
        }

        lines.push(
            '=================================================='
        );
    }

    if (missingRoles.length > 0) {
        lines.push(
            '',
            '⚠️ Rôles introuvables',
            ''
        );

        for (const role of missingRoles) {
            lines.push(
                '- Nom du rôle : Rôle supprimé/introuvable',
                `  ID : ${role.id}`,
                '  Mention : N/A',
                '  Existe sur Discord : non',
                ''
            );
        }

        lines.push(
            '=================================================='
        );
    }

    return Buffer.from(
        lines.join('\n'),
        'utf8'
    );
}

function buildRawBuffer(categories) {
    const lines = [];

    if (categories.length === 0) {
        lines.push(
            'Aucun rôle autorole configuré.'
        );
    }

    for (const category of categories) {
        lines.push(
            `[${category.name}]`
        );

        if (category.roles.length === 0) {
            lines.push(
                'Aucun rôle = N/A'
            );
        }

        for (const role of category.roles) {
            lines.push(
                `${role.name} = ${role.id}`
            );
        }

        lines.push('');
    }

    return Buffer.from(
        lines.join('\n').trimEnd() + '\n',
        'utf8'
    );
}

module.exports = {
    buildExportBuffer,
    buildRawBuffer,
    buildRolesListEmbeds,
    getConfiguredAutoroleCategories
};

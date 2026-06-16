const { EmbedBuilder } = require('discord.js');

const { pool } = require('../../../database/db');

const ALTIA_PURPLE =
    0xB99CFF;

const UNCATEGORIZED_NAME =
    'Sans catégorie';

function compareRolesTopToBottom(left, right) {
    if (left.position !== right.position) {
        return right.position - left.position;
    }

    return left.name.localeCompare(
        right.name,
        'fr',
        {
            sensitivity: 'base'
        }
    );
}

function makeRoleEntry(role) {
    return {
        id:
            role.id,
        name:
            role.name,
        mention:
            `<@&${role.id}>`,
        position:
            role.position ?? 0
    };
}

function makeCategory(name, id = null, position = null) {
    return {
        id,
        name,
        position,
        roles: []
    };
}

async function getAutoroleCategoryIds(guildId) {
    const result =
        await pool.query(
            `
            SELECT role_id
            FROM autoroles
            WHERE serveur_id = $1
            ORDER BY id ASC
            `,
            [
                guildId
            ]
        );

    return result.rows
        .map(row => row.role_id)
        .filter(Boolean);
}

function getSortedGuildRoles(guild) {
    return [...guild.roles.cache.values()]
        .filter(role => role.id !== guild.id)
        .sort(compareRolesTopToBottom);
}

function shouldIncludeNormalRole(role, categoryIds) {
    if (categoryIds.has(role.id)) {
        return false;
    }

    if (role.managed) {
        return false;
    }

    return true;
}

function addMissingCategories(categories, categoryIds, guild) {
    const existingCategoryIds =
        new Set(
            categories
                .map(category => category.id)
                .filter(Boolean)
        );

    for (const categoryId of categoryIds) {
        if (existingCategoryIds.has(categoryId)) {
            continue;
        }

        const role =
            guild.roles.cache.get(categoryId);

        categories.push(
            makeCategory(
                role?.name || `Rôle catégorie introuvable (${categoryId})`,
                categoryId,
                role?.position ?? null
            )
        );
    }
}

async function getConfiguredAutoroleCategories(guild) {
    await guild.roles.fetch();

    const categoryIds =
        new Set(
            await getAutoroleCategoryIds(guild.id)
        );

    if (categoryIds.size === 0) {
        return [];
    }

    const categories = [];
    let currentCategory =
        makeCategory(UNCATEGORIZED_NAME);

    for (const role of getSortedGuildRoles(guild)) {
        if (categoryIds.has(role.id)) {
            if (
                currentCategory.name !== UNCATEGORIZED_NAME ||
                currentCategory.roles.length > 0
            ) {
                categories.push(currentCategory);
            }

            currentCategory =
                makeCategory(
                    role.name,
                    role.id,
                    role.position ?? 0
                );

            continue;
        }

        if (!shouldIncludeNormalRole(role, categoryIds)) {
            continue;
        }

        currentCategory.roles.push(
            makeRoleEntry(role)
        );
    }

    if (
        currentCategory.name !== UNCATEGORIZED_NAME ||
        currentCategory.roles.length > 0
    ) {
        categories.push(currentCategory);
    }

    addMissingCategories(
        categories,
        categoryIds,
        guild
    );

    return categories;
}

function roleDisplayLine(role) {
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
        .setTitle('📋 Liste des rôles du serveur')
        .setDescription(
            'Rôles classés par séparateurs autorole et position Discord.'
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
                        'Aucune catégorie',
                    value:
                        'Aucun rôle autorole séparateur n’est configuré pour ce serveur.'
                })
        ];
    }

    for (const category of categories) {
        const lines =
            category.roles.length > 0
                ? category.roles.map(roleDisplayLine)
                : ['Aucun rôle trouvé dans cette catégorie.'];

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
        'Liste des rôles du serveur classés par catégories',
        `Serveur : ${guild.name}`,
        `ID serveur : ${guild.id}`,
        `Généré le : ${new Date().toISOString()}`,
        '',
        '=================================================='
    ];

    if (categories.length === 0) {
        lines.push(
            '',
            'Aucun rôle autorole séparateur n’est configuré.',
            '',
            '=================================================='
        );
    }

    for (const category of categories) {
        lines.push(
            '',
            category.name,
            ''
        );

        if (category.roles.length === 0) {
            lines.push(
                'Aucun rôle trouvé dans cette catégorie.',
                ''
            );
        }

        for (const role of category.roles) {
            lines.push(
                `- Nom du rôle : ${role.name}`,
                `  ID : ${role.id}`,
                `  Mention : <@&${role.id}>`,
                `  Position Discord : ${role.position}`,
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
            'Aucun rôle autorole séparateur configuré.'
        );
    }

    for (const category of categories) {
        lines.push(
            `[${category.name}]`
        );

        if (category.roles.length === 0) {
            lines.push(
                'Aucun rôle trouvé dans cette catégorie.'
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

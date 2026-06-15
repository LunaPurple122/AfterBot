const {
    ChannelType,
    PermissionFlagsBits
} = require('discord.js');

const { pool } =
    require('../../../database/db');

const VALID_MODES =
    new Set(['append', 'sync', 'dryRun']);

const VALID_CHANNEL_TYPES =
    new Set(['text', 'voice']);

const CREATED_TYPES = {
    role: 'role',
    category: 'category',
    text: 'text_channel',
    voice: 'voice_channel'
};

const DANGEROUS_ALLOWED_PERMISSIONS =
    new Set([
        'Administrator',
        'ManageGuild',
        'ManageRoles',
        'ManageChannels',
        'ManageWebhooks',
        'BanMembers',
        'KickMembers',
        'ModerateMembers'
    ]);

const DISCORD_ID_REGEX =
    /^\d{17,20}$/;

const ROLE_MENTION_REGEX =
    /^<@&(\d{17,20})>$/;

const PERMISSION_ALIASES = {
    Video: 'Stream'
};

function normalizePermissionName(permissionName) {
    return PERMISSION_ALIASES[permissionName] || permissionName;
}

function getPermissionFlag(permissionName) {
    const normalizedName =
        normalizePermissionName(permissionName);

    return PermissionFlagsBits[normalizedName];
}

function truncate(text, maxLength = 1900) {
    if (text.length <= maxLength) return text;

    return `${text.slice(0, maxLength - 40)}\n... sortie tronquee`;
}

function asArray(value) {
    return Array.isArray(value) ? value : [];
}

function normalizeMode(mode) {
    if (!mode) return 'append';

    return String(mode).trim();
}

function ensureGuildOwner(interaction) {
    if (!interaction.inGuild() || !interaction.guild) {
        return {
            ok: false,
            message:
                'Cette commande doit etre utilisee dans un serveur.'
        };
    }

    if (interaction.user.id !== interaction.guild.ownerId) {
        return {
            ok: false,
            message:
                'Seul le proprietaire du serveur peut utiliser Create Altia.'
        };
    }

    return {
        ok: true
    };
}

function parseJsonContent(rawContent) {
    try {
        const parsed = JSON.parse(rawContent);

        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            return {
                error:
                    'Le JSON racine doit etre un objet.'
            };
        }

        return {
            value: parsed
        };
    } catch (error) {
        return {
            error:
                `JSON invalide : ${error.message}`
        };
    }
}

function validatePermissionList(list, path, errors) {
    const permissions =
        asArray(list);

    if (!Array.isArray(list || [])) {
        errors.push(`${path} doit etre un tableau.`);
        return [];
    }

    const converted = [];

    for (const permissionName of permissions) {
        const normalizedName =
            normalizePermissionName(permissionName);

        if (
            typeof permissionName !== 'string' ||
            !getPermissionFlag(permissionName)
        ) {
            errors.push(`Permission inconnue : ${path}.${permissionName}`);
            continue;
        }

        converted.push(normalizedName);
    }

    return converted;
}

function validatePermissions(permissions, path, errors) {
    if (permissions === undefined) return;

    if (
        !permissions ||
        typeof permissions !== 'object' ||
        Array.isArray(permissions)
    ) {
        errors.push(`${path} doit etre un objet.`);
        return;
    }

    for (const [roleName, overwrite] of Object.entries(permissions)) {
        if (!roleName.trim()) {
            errors.push(`${path} contient un nom de role vide.`);
            continue;
        }

        if (
            !overwrite ||
            typeof overwrite !== 'object' ||
            Array.isArray(overwrite)
        ) {
            errors.push(`${path}.${roleName} doit etre un objet.`);
            continue;
        }

        const allow =
            validatePermissionList(
                overwrite.allow,
                `${path}.${roleName}.allow`,
                errors
            );

        const deny =
            validatePermissionList(
                overwrite.deny,
                `${path}.${roleName}.deny`,
                errors
            );

        for (const permissionName of allow) {
            if (DANGEROUS_ALLOWED_PERMISSIONS.has(permissionName)) {
                errors.push(
                    `Permission dangereuse refusee en allow : ${permissionName}`
                );
            }
        }

        for (const permissionName of allow) {
            if (deny.includes(permissionName)) {
                errors.push(
                    `Permission contradictoire pour ${roleName} : ${permissionName}`
                );
            }
        }
    }
}

function validateProject(project) {
    const errors = [];
    const mode =
        normalizeMode(project.mode);

    if (!VALID_MODES.has(mode)) {
        errors.push(
            'mode doit etre append, sync ou dryRun.'
        );
    }

    if (
        project.roles !== undefined &&
        !Array.isArray(project.roles)
    ) {
        errors.push('roles doit etre un tableau.');
    }

    for (const [index, role] of asArray(project.roles).entries()) {
        if (!role || typeof role !== 'object' || Array.isArray(role)) {
            errors.push(`roles[${index}] doit etre un objet.`);
            continue;
        }

        if (!role.name || typeof role.name !== 'string') {
            errors.push(`roles[${index}].name est requis.`);
        } else if (role.name === '@everyone') {
            errors.push(
                `roles[${index}].name ne peut pas etre @everyone.`
            );
        }

        if (
            role.color !== undefined &&
            !/^#[0-9a-fA-F]{6}$/.test(role.color)
        ) {
            errors.push(
                `roles[${index}].color doit etre au format #RRGGBB.`
            );
        }
    }

    if (
        project.categories !== undefined &&
        !Array.isArray(project.categories)
    ) {
        errors.push('categories doit etre un tableau.');
    }

    for (const [categoryIndex, category] of asArray(project.categories).entries()) {
        if (
            !category ||
            typeof category !== 'object' ||
            Array.isArray(category)
        ) {
            errors.push(`categories[${categoryIndex}] doit etre un objet.`);
            continue;
        }

        if (!category.name || typeof category.name !== 'string') {
            errors.push(`categories[${categoryIndex}].name est requis.`);
        }

        validatePermissions(
            category.permissions,
            `categories[${categoryIndex}].permissions`,
            errors
        );

        if (
            category.channels !== undefined &&
            !Array.isArray(category.channels)
        ) {
            errors.push(
                `categories[${categoryIndex}].channels doit etre un tableau.`
            );
        }

        for (const [channelIndex, channel] of asArray(category.channels).entries()) {
            if (
                !channel ||
                typeof channel !== 'object' ||
                Array.isArray(channel)
            ) {
                errors.push(
                    `categories[${categoryIndex}].channels[${channelIndex}] doit etre un objet.`
                );
                continue;
            }

            if (!channel.name || typeof channel.name !== 'string') {
                errors.push(
                    `categories[${categoryIndex}].channels[${channelIndex}].name est requis.`
                );
            }

            if (!VALID_CHANNEL_TYPES.has(channel.type)) {
                errors.push(
                    `categories[${categoryIndex}].channels[${channelIndex}].type doit etre text ou voice.`
                );
            }

            validatePermissions(
                channel.permissions,
                `categories[${categoryIndex}].channels[${channelIndex}].permissions`,
                errors
            );
        }
    }

    return {
        ok:
            errors.length === 0,
        errors,
        mode:
            VALID_MODES.has(mode) ? mode : 'append',
        project: {
            ...project,
            mode:
                VALID_MODES.has(mode) ? mode : 'append'
        }
    };
}

function resolveRole(guild, roleReference) {
    const value =
        String(roleReference || '').trim();

    if (value === '@everyone') {
        return {
            role:
                guild.roles.everyone,
            method:
                '@everyone',
            reference:
                value
        };
    }

    if (DISCORD_ID_REGEX.test(value)) {
        return {
            role:
                guild.roles.cache.get(value) || null,
            method:
                'recherche par ID',
            reference:
                value
        };
    }

    const mentionMatch =
        value.match(ROLE_MENTION_REGEX);

    if (mentionMatch) {
        return {
            role:
                guild.roles.cache.get(mentionMatch[1]) || null,
            method:
                'recherche par mention',
            reference:
                value
        };
    }

    return {
        role:
            guild.roles.cache.find(role =>
                role.name === value
            ) || null,
        method:
            'recherche par nom',
        reference:
            value
    };
}

function formatMissingRoleError(resolution) {
    return [
        'role introuvable :',
        resolution.reference,
        '',
        `Methode utilisee : ${resolution.method}`
    ].join('\n');
}

function findRole(guild, roleReference) {
    return resolveRole(guild, roleReference).role;
}

function findCategory(guild, name) {
    return guild.channels.cache.find(channel =>
        channel.type === ChannelType.GuildCategory &&
        channel.name === name
    ) || null;
}

function findChannelInCategory(guild, category, name, type) {
    const expectedType =
        type === 'voice'
            ? ChannelType.GuildVoice
            : ChannelType.GuildText;

    return guild.channels.cache.find(channel =>
        channel.type === expectedType &&
        channel.name === name &&
        channel.parentId === category?.id
    ) || null;
}

function canManageRole(guild, role) {
    if (!role || role.id === guild.id) return true;

    const botRole =
        guild.members.me?.roles?.highest;

    return Boolean(
        botRole &&
        role.position < botRole.position &&
        !role.managed
    );
}

function rolePayload(role) {
    const payload = {};

    if (role.color) payload.color = role.color;
    if (role.hoist !== undefined) payload.hoist = Boolean(role.hoist);
    if (role.mentionable !== undefined) {
        payload.mentionable = Boolean(role.mentionable);
    }

    return payload;
}

function channelPayload(channel) {
    const payload = {};

    if (
        channel.topic !== undefined &&
        channel.type === 'text'
    ) {
        payload.topic = String(channel.topic).slice(0, 1024);
    }

    if (
        channel.nsfw !== undefined &&
        channel.type === 'text'
    ) {
        payload.nsfw = Boolean(channel.nsfw);
    }

    if (
        channel.rateLimitPerUser !== undefined &&
        channel.type === 'text'
    ) {
        payload.rateLimitPerUser =
            Math.max(
                0,
                Math.min(21600, Number(channel.rateLimitPerUser) || 0)
            );
    }

    if (
        channel.userLimit !== undefined &&
        channel.type === 'voice'
    ) {
        payload.userLimit =
            Math.max(
                0,
                Math.min(99, Number(channel.userLimit) || 0)
            );
    }

    return payload;
}

function buildPermissionOverwrites(guild, permissions, errors) {
    const overwrites = [];

    if (!permissions) return overwrites;

    for (const [roleName, overwrite] of Object.entries(permissions)) {
        const resolution =
            resolveRole(guild, roleName);

        const role =
            resolution.role;

        if (!role) {
            errors.push(
                formatMissingRoleError(resolution)
            );
            continue;
        }

        overwrites.push({
            id:
                role.id,
            allow:
                asArray(overwrite.allow).map(name =>
                    getPermissionFlag(name)
                ),
            deny:
                asArray(overwrite.deny).map(name =>
                    getPermissionFlag(name)
                )
        });
    }

    return overwrites;
}

async function applyPermissionSync(target, guild, permissions, errors) {
    if (!permissions) return;

    for (const [roleName, overwrite] of Object.entries(permissions)) {
        const resolution =
            resolveRole(guild, roleName);

        const role =
            resolution.role;

        if (!role) {
            errors.push(
                formatMissingRoleError(resolution)
            );
            continue;
        }

        const values = {};

        for (const permissionName of asArray(overwrite.allow)) {
            values[normalizePermissionName(permissionName)] = true;
        }

        for (const permissionName of asArray(overwrite.deny)) {
            values[normalizePermissionName(permissionName)] = false;
        }

        await target.permissionOverwrites.edit(role, values);
    }
}

function projectDeclaresRole(project, roleName) {
    const resolution =
        {
            reference:
                String(roleName || '').trim()
        };

    if (
        DISCORD_ID_REGEX.test(resolution.reference) ||
        ROLE_MENTION_REGEX.test(resolution.reference) ||
        resolution.reference === '@everyone'
    ) {
        return false;
    }

    return asArray(project.roles).some(role =>
        role?.name === resolution.reference
    );
}

function collectPermissionRoleErrors(guild, project, permissions, errors) {
    if (!permissions) return;

    for (const roleName of Object.keys(permissions)) {
        const resolution =
            resolveRole(guild, roleName);

        if (
            !resolution.role &&
            !projectDeclaresRole(project, roleName)
        ) {
            errors.push(
                `! ${formatMissingRoleError(resolution)}`
            );
        }
    }
}

function buildPreview(guild, project) {
    const created = [];
    const modified = [];
    const skipped = [];
    const errors = [];
    const mode =
        normalizeMode(project.mode);

    for (const roleConfig of asArray(project.roles)) {
        const role =
            findRole(guild, roleConfig.name);

        if (!role) {
            created.push(`+ role ${roleConfig.name}`);
            continue;
        }

        if (mode === 'sync') {
            if (!canManageRole(guild, role)) {
                errors.push(`! role impossible a gerer : ${role.name}`);
            } else {
                modified.push(`~ role ${role.name}`);
            }
        } else {
            skipped.push(`= role ${role.name} deja existant`);
        }
    }

    for (const categoryConfig of asArray(project.categories)) {
        const category =
            findCategory(guild, categoryConfig.name);

        if (!category) {
            created.push(`+ categorie ${categoryConfig.name}`);
        } else if (mode === 'sync') {
            if (categoryConfig.permissions) {
                modified.push(`~ permissions de ${category.name}`);
            } else {
                skipped.push(`= categorie ${category.name} deja existante`);
            }
        } else {
            skipped.push(`= categorie ${category.name} deja existante`);
        }

        collectPermissionRoleErrors(
            guild,
            project,
            categoryConfig.permissions,
            errors
        );

        for (const channelConfig of asArray(categoryConfig.channels)) {
            const existingChannel =
                category
                    ? findChannelInCategory(
                        guild,
                        category,
                        channelConfig.name,
                        channelConfig.type
                    )
                    : null;

            if (!existingChannel) {
                created.push(`+ salon ${channelConfig.name}`);
            } else if (mode === 'sync') {
                modified.push(`~ salon ${channelConfig.name}`);

                if (channelConfig.permissions) {
                    modified.push(`~ permissions de ${channelConfig.name}`);
                }
            } else {
                skipped.push(`= salon ${channelConfig.name} deja existant`);
            }

            collectPermissionRoleErrors(
                guild,
                project,
                channelConfig.permissions,
                errors
            );
        }
    }

    return {
        created,
        modified,
        skipped,
        errors
    };
}

function formatPreview(preview, title = 'Preview Create Altia') {
    const sections = [
        ['Creations', preview.created],
        ['Modifications', preview.modified],
        ['Ignores', preview.skipped],
        ['Erreurs', preview.errors]
    ];

    const content =
        sections
            .map(([sectionTitle, lines]) =>
                `**${sectionTitle}**\n${lines.length ? lines.join('\n') : 'Aucun'}`
            )
            .join('\n\n');

    return truncate(`**${title}**\n\n${content}`);
}

async function storeImport({
    guildId,
    ownerId,
    sourceType,
    project
}) {
    const result =
        await pool.query(`
            INSERT INTO create_imports (
                guild_id,
                owner_id,
                mode,
                source_type,
                json_content
            )
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, imported_at, mode
        `, [
            guildId,
            ownerId,
            project.mode,
            sourceType,
            project
        ]);

    return result.rows[0];
}

async function getLatestImport(guildId) {
    const result =
        await pool.query(`
            SELECT *
            FROM create_imports
            WHERE guild_id = $1
            ORDER BY imported_at DESC, id DESC
            LIMIT 1
        `, [guildId]);

    return result.rows[0] || null;
}

async function getLatestAppliedImport(guildId) {
    const result =
        await pool.query(`
            SELECT *
            FROM create_imports
            WHERE guild_id = $1
            AND applied = true
            ORDER BY applied_at DESC, id DESC
            LIMIT 1
        `, [guildId]);

    return result.rows[0] || null;
}

async function fetchHistory(guildId) {
    const result =
        await pool.query(`
            SELECT id, imported_at, mode, source_type, applied, applied_at
            FROM create_imports
            WHERE guild_id = $1
            ORDER BY imported_at DESC, id DESC
            LIMIT 10
        `, [guildId]);

    return result.rows;
}

async function recordCreatedObject({
    importId,
    guildId,
    discordId,
    type,
    name
}) {
    await pool.query(`
        INSERT INTO create_created_objects (
            import_id,
            guild_id,
            discord_id,
            type,
            name
        )
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT DO NOTHING
    `, [
        importId,
        guildId,
        discordId,
        type,
        name
    ]);
}

async function applyProject(guild, importRow, user) {
    const project =
        importRow.json_content;

    const validation =
        validateProject(project);

    if (!validation.ok) {
        return {
            ok: false,
            message:
                validation.errors.join('\n')
        };
    }

    if (validation.mode === 'dryRun') {
        return {
            ok: true,
            message:
                'Mode dryRun : aucune modification appliquee.'
        };
    }

    const preview =
        buildPreview(guild, validation.project);

    if (preview.errors.length > 0) {
        return {
            ok: false,
            message:
                preview.errors.join('\n')
        };
    }

    const mode =
        validation.mode;

    const created = [];
    const updated = [];

    for (const roleConfig of asArray(project.roles)) {
        const existingRole =
            findRole(guild, roleConfig.name);

        if (existingRole) {
            if (mode === 'sync') {
                if (!canManageRole(guild, existingRole)) {
                    throw new Error(
                        `Role impossible a gerer : ${existingRole.name}`
                    );
                }

                await existingRole.edit(
                    rolePayload(roleConfig),
                    `Create Altia sync par ${user.tag}`
                );

                updated.push(`role ${existingRole.name}`);
            }

            continue;
        }

        const role =
            await guild.roles.create({
                name:
                    roleConfig.name,
                ...rolePayload(roleConfig),
                reason:
                    `Create Altia par ${user.tag}`
            });

        await recordCreatedObject({
            importId:
                importRow.id,
            guildId:
                guild.id,
            discordId:
                role.id,
            type:
                CREATED_TYPES.role,
            name:
                role.name
        });

        created.push(`role ${role.name}`);
    }

    for (const categoryConfig of asArray(project.categories)) {
        let category =
            findCategory(guild, categoryConfig.name);

        if (!category) {
            const overwrites =
                buildPermissionOverwrites(
                    guild,
                    categoryConfig.permissions,
                    []
                );

            category =
                await guild.channels.create({
                    name:
                        categoryConfig.name,
                    type:
                        ChannelType.GuildCategory,
                    permissionOverwrites:
                        overwrites,
                    reason:
                        `Create Altia par ${user.tag}`
                });

            await recordCreatedObject({
                importId:
                    importRow.id,
                guildId:
                    guild.id,
                discordId:
                    category.id,
                type:
                    CREATED_TYPES.category,
                name:
                    category.name
            });

            created.push(`categorie ${category.name}`);
        } else if (mode === 'sync' && categoryConfig.permissions) {
            await applyPermissionSync(
                category,
                guild,
                categoryConfig.permissions,
                []
            );

            updated.push(`categorie ${category.name}`);
        }

        for (const channelConfig of asArray(categoryConfig.channels)) {
            let channel =
                findChannelInCategory(
                    guild,
                    category,
                    channelConfig.name,
                    channelConfig.type
                );

            const type =
                channelConfig.type === 'voice'
                    ? ChannelType.GuildVoice
                    : ChannelType.GuildText;

            if (!channel) {
                const overwrites =
                    buildPermissionOverwrites(
                        guild,
                        channelConfig.permissions,
                        []
                    );

                channel =
                    await guild.channels.create({
                        name:
                            channelConfig.name,
                        type,
                        parent:
                            category.id,
                        permissionOverwrites:
                            overwrites,
                        ...channelPayload(channelConfig),
                        reason:
                            `Create Altia par ${user.tag}`
                    });

                await recordCreatedObject({
                    importId:
                        importRow.id,
                    guildId:
                        guild.id,
                    discordId:
                        channel.id,
                    type:
                        channelConfig.type === 'voice'
                            ? CREATED_TYPES.voice
                            : CREATED_TYPES.text,
                    name:
                        channel.name
                });

                created.push(`salon ${channel.name}`);
                continue;
            }

            if (mode !== 'sync') continue;

            await channel.edit({
                parent:
                    category.id,
                position:
                    channelConfig.position,
                ...channelPayload(channelConfig),
                reason:
                    `Create Altia sync par ${user.tag}`
            });

            if (channelConfig.permissions) {
                await applyPermissionSync(
                    channel,
                    guild,
                    channelConfig.permissions,
                    []
                );
            }

            updated.push(`salon ${channel.name}`);
        }
    }

    await pool.query(`
        UPDATE create_imports
        SET applied = true,
            applied_at = CURRENT_TIMESTAMP
        WHERE id = $1
    `, [importRow.id]);

    return {
        ok: true,
        message:
            truncate(
                `Apply termine.\n\nCrees:\n${created.length ? created.join('\n') : 'Aucun'}\n\nModifies:\n${updated.length ? updated.join('\n') : 'Aucun'}`
            )
    };
}

async function rollbackLatest(guild) {
    const importRow =
        await getLatestAppliedImport(guild.id);

    if (!importRow) {
        return {
            ok: false,
            message:
                'Aucun apply a rollback.'
        };
    }

    const result =
        await pool.query(`
            SELECT *
            FROM create_created_objects
            WHERE import_id = $1
            AND guild_id = $2
        `, [
            importRow.id,
            guild.id
        ]);

    const order = {
        text_channel: 1,
        voice_channel: 1,
        category: 2,
        role: 3
    };

    const objects =
        result.rows.sort((a, b) =>
            order[a.type] - order[b.type]
        );

    const deleted = [];
    const skipped = [];

    for (const object of objects) {
        if (object.type === 'role') {
            const role =
                guild.roles.cache.get(object.discord_id);

            if (!role) {
                skipped.push(`${object.type} ${object.name} introuvable`);
                continue;
            }

            if (!canManageRole(guild, role)) {
                skipped.push(`role ${object.name} impossible a gerer`);
                continue;
            }

            await role.delete('Create Altia rollback');
            deleted.push(`role ${object.name}`);
            continue;
        }

        const channel =
            guild.channels.cache.get(object.discord_id);

        if (!channel) {
            skipped.push(`${object.type} ${object.name} introuvable`);
            continue;
        }

        await channel.delete('Create Altia rollback');
        deleted.push(`${object.type} ${object.name}`);
    }

    return {
        ok: true,
        message:
            truncate(
                `Rollback termine pour import #${importRow.id}.\n\nSupprimes:\n${deleted.length ? deleted.join('\n') : 'Aucun'}\n\nIgnores:\n${skipped.length ? skipped.join('\n') : 'Aucun'}`
            )
    };
}

module.exports = {
    applyProject,
    buildPreview,
    ensureGuildOwner,
    fetchHistory,
    formatPreview,
    getLatestImport,
    parseJsonContent,
    rollbackLatest,
    storeImport,
    truncate,
    validateProject
};

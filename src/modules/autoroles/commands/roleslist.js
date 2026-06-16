const {
    AttachmentBuilder,
    PermissionFlagsBits,
    SlashCommandBuilder
} = require('discord.js');

const {
    safeDeferReply,
    safeFollowUp,
    safeReply
} = require('../../../core/interactions');

const {
    buildExportBuffer,
    buildRawBuffer,
    buildRolesListEmbeds,
    getConfiguredAutoroleCategories
} = require('../services/rolesListService');

function canUseRolesList(member) {
    return Boolean(
        member?.permissions?.has(PermissionFlagsBits.Administrator) ||
        member?.permissions?.has(PermissionFlagsBits.ManageRoles)
    );
}

async function sendEmbeds(interaction, embeds) {
    const chunks = [];

    for (let index = 0; index < embeds.length; index += 10) {
        chunks.push(
            embeds.slice(index, index + 10)
        );
    }

    await safeReply(interaction, {
        embeds:
            chunks.shift() || []
    });

    for (const chunk of chunks) {
        await safeFollowUp(interaction, {
            embeds:
                chunk,
            ephemeral:
                true
        });
    }
}

async function handleList(interaction) {
    const deferred =
        await safeDeferReply(interaction, {
            ephemeral: true
        });

    if (!deferred) return null;

    const categories =
        await getConfiguredAutoroleCategories(
            interaction.guild
        );

    const embeds =
        buildRolesListEmbeds(categories);

    return sendEmbeds(
        interaction,
        embeds
    );
}

async function handleExport(interaction) {
    const deferred =
        await safeDeferReply(interaction, {
            ephemeral: true
        });

    if (!deferred) return null;

    const categories =
        await getConfiguredAutoroleCategories(
            interaction.guild
        );

    const buffer =
        buildExportBuffer(
            categories,
            interaction.guild
        );

    const attachment =
        new AttachmentBuilder(buffer, {
            name:
                `roles-list-${interaction.guild.id}.txt`
        });

    return safeReply(interaction, {
        content:
            'Export TXT généré depuis la configuration autorole.',
        files:
            [
                attachment
            ]
    });
}

async function handleRaw(interaction) {
    const deferred =
        await safeDeferReply(interaction, {
            ephemeral: true
        });

    if (!deferred) return null;

    const categories =
        await getConfiguredAutoroleCategories(
            interaction.guild
        );

    const buffer =
        buildRawBuffer(categories);

    const attachment =
        new AttachmentBuilder(buffer, {
            name:
                `roles-raw-${interaction.guild.id}.txt`
        });

    return safeReply(interaction, {
        content:
            'Export brut généré depuis la configuration autorole.',
        files:
            [
                attachment
            ]
    });
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('roleslist')
        .setDescription(
            'Lister ou exporter les rôles configurés dans les autoroles.'
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription(
                    'Afficher les rôles configurés par catégorie.'
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('export')
                .setDescription(
                    'Exporter les rôles configurés dans un fichier TXT.'
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('raw')
                .setDescription(
                    'Exporter les IDs de rôles dans un TXT simplifié.'
                )
        )
        .setDefaultMemberPermissions(
            PermissionFlagsBits.Administrator |
            PermissionFlagsBits.ManageRoles
        ),

    async execute(interaction) {
        try {
            if (!interaction.guild) {
                return safeReply(interaction, {
                    content:
                        'Cette commande doit être utilisée dans un serveur.',
                    ephemeral:
                        true
                });
            }

            if (!canUseRolesList(interaction.member)) {
                return safeReply(interaction, {
                    content:
                        'Tu dois être administrateur ou posséder la permission ManageRoles pour utiliser cette commande.',
                    ephemeral:
                        true
                });
            }

            const subcommand =
                interaction.options.getSubcommand();

            if (subcommand === 'list') {
                return handleList(interaction);
            }

            if (subcommand === 'export') {
                return handleExport(interaction);
            }

            if (subcommand === 'raw') {
                return handleRaw(interaction);
            }

            return safeReply(interaction, {
                content:
                    'Sous-commande roleslist inconnue.',
                ephemeral:
                    true
            });

        } catch (error) {
            console.error(
                'Erreur commande roleslist :',
                error
            );

            return safeReply(interaction, {
                content:
                    'Impossible de récupérer la liste des rôles configurés.',
                ephemeral:
                    true
            });
        }
    }
};

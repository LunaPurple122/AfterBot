const {
    ChannelType,
    PermissionFlagsBits,
    SlashCommandBuilder
} = require('discord.js');

const {
    safeDeferReply,
    safeReply
} = require('../../../core/interactions');

const {
    addAccess,
    addPingRole,
    buildEmbed,
    canManageRod,
    closeRequest,
    DEFAULT_ALERT_MESSAGE,
    DEFAULT_REQUEST_MESSAGE,
    DEFAULT_STAFF_MESSAGE,
    formatDate,
    getConfig,
    getRequestById,
    hasRequiredBotPermissions,
    listAccess,
    listOpenRequests,
    listPingRoles,
    mentionAccess,
    removeAccess,
    removePingRole,
    saveConfig
} = require('../services/rodService');

async function canSetupRod(interaction) {
    if (interaction.user.id === interaction.guild.ownerId) {
        return true;
    }

    return Boolean(
        interaction.memberPermissions?.has(
            PermissionFlagsBits.Administrator
        )
    );
}

function truncateText(value, maxLength = 3900) {
    const text =
        String(value || '');

    if (text.length <= maxLength) {
        return text;
    }

    return `${text.slice(0, maxLength - 20)}\n... contenu raccourci`;
}

async function requireSetupPermission(interaction) {
    if (await canSetupRod(interaction)) {
        return true;
    }

    await safeReply(interaction, {
        content:
            'Commande reservee aux administrateurs ou au proprietaire du serveur.',
        ephemeral: true
    });

    return false;
}

async function requireManagerPermission(interaction, request = null) {
    if (await canManageRod(interaction.member, request)) {
        return true;
    }

    await safeReply(interaction, {
        content:
            'Tu n as pas l autorisation de gerer les demandes ROD.',
        ephemeral: true
    });

    return false;
}

function renderConfigSummary({
    config,
    pingRoles
}) {
    if (!config) {
        return 'Le module ROD n est pas encore configure.';
    }

    const roles =
        pingRoles.length > 0
            ? pingRoles.map(row => `<@&${row.role_id}>`).join('\n')
            : 'Aucun role ping configure.';

    return truncateText(`Role declencheur: <@&${config.trigger_role_id}>
Categorie: <#${config.category_id}>
Salon d alerte: <#${config.alert_channel_id}>
Salon d archives: <#${config.archive_channel_id}>

Roles ping/staff:
${roles}

Message d alerte:
${config.alert_message || DEFAULT_ALERT_MESSAGE}

Message demande:
${config.request_message || DEFAULT_REQUEST_MESSAGE}

Message staff:
${config.staff_message || DEFAULT_STAFF_MESSAGE}`);
}

async function handleSetupConfig(interaction) {
    if (!await requireSetupPermission(interaction)) {
        return null;
    }

    const deferred =
        await safeDeferReply(interaction, {
            ephemeral: true
        });

    if (!deferred) return null;

    if (!hasRequiredBotPermissions(interaction.guild)) {
        return safeReply(interaction, {
            content:
                'Permissions bot insuffisantes. Il faut ManageChannels, ViewChannel, SendMessages, ReadMessageHistory, AttachFiles, Connect et Speak.'
        });
    }

    const triggerRole =
        interaction.options.getRole('trigger_role');

    const category =
        interaction.options.getChannel('category');

    const alertChannel =
        interaction.options.getChannel('alert_channel');

    const archiveChannel =
        interaction.options.getChannel('archive_channel');

    await saveConfig({
        guildId: interaction.guild.id,
        triggerRoleId: triggerRole.id,
        categoryId: category.id,
        alertChannelId: alertChannel.id,
        archiveChannelId: archiveChannel.id,
        alertMessage:
            interaction.options.getString('alert_message'),
        requestMessage:
            interaction.options.getString('request_message'),
        staffMessage:
            interaction.options.getString('staff_message')
    });

    const config =
        await getConfig(interaction.guild.id);

    const pingRoles =
        await listPingRoles(interaction.guild.id);

    return safeReply(interaction, {
        embeds: [
            buildEmbed(
                'Configuration ROD enregistree',
                renderConfigSummary({
                    config,
                    pingRoles
                }),
                0x57F287
            )
        ]
    });
}

async function handleSetupShow(interaction) {
    if (!await requireSetupPermission(interaction)) {
        return null;
    }

    const config =
        await getConfig(interaction.guild.id);

    const pingRoles =
        await listPingRoles(interaction.guild.id);

    return safeReply(interaction, {
        embeds: [
            buildEmbed(
                'Configuration ROD',
                renderConfigSummary({
                    config,
                    pingRoles
                }),
                0x5865F2
            )
        ],
        ephemeral: true
    });
}

async function handlePingRole(interaction, subcommand) {
    if (!await requireSetupPermission(interaction)) {
        return null;
    }

    if (subcommand === 'ping-role-add') {
        const role =
            interaction.options.getRole('role');

        if (role.id === interaction.guild.id) {
            return safeReply(interaction, {
                content:
                    'Le role @everyone ne peut pas etre ajoute.',
                ephemeral: true
            });
        }

        await addPingRole(
            interaction.guild.id,
            role.id
        );

        return safeReply(interaction, {
            content:
                `Role ping/staff ajoute : ${role}.`,
            ephemeral: true
        });
    }

    if (subcommand === 'ping-role-remove') {
        const role =
            interaction.options.getRole('role');

        const removed =
            await removePingRole(
                interaction.guild.id,
                role.id
            );

        return safeReply(interaction, {
            content: removed
                ? `Role ping/staff retire : ${role}.`
                : `Ce role n etait pas configure : ${role}.`,
            ephemeral: true
        });
    }

    const roles =
        await listPingRoles(interaction.guild.id);

    return safeReply(interaction, {
        content: roles.length > 0
            ? `Roles ping/staff configures :\n${roles.map(row => `- <@&${row.role_id}>`).join('\n')}`
            : 'Aucun role ping/staff configure.',
        ephemeral: true
    });
}

async function getRequestFromOption(interaction) {
    const requestId =
        interaction.options.getString('demande');

    if (!/^\d+$/.test(requestId || '')) {
        await safeReply(interaction, {
            content:
                'ID de demande invalide.',
            ephemeral: true
        });

        return null;
    }

    const request =
        await getRequestById(
            interaction.guild.id,
            requestId
        );

    if (!request) {
        await safeReply(interaction, {
            content:
                'Demande introuvable.',
            ephemeral: true
        });
    }

    return request;
}

function getTargetFromOptions(interaction) {
    const user =
        interaction.options.getUser('utilisateur');

    const role =
        interaction.options.getRole('role');

    if ((user && role) || (!user && !role)) {
        return null;
    }

    if (user) {
        return {
            type: 'user',
            id: user.id,
            mention: `${user}`
        };
    }

    return {
        type: 'role',
        id: role.id,
        mention: `${role}`
    };
}

async function handleAddRemove(interaction, action) {
    const request =
        await getRequestFromOption(interaction);

    if (!request) return null;

    if (!await requireManagerPermission(interaction, request)) {
        return null;
    }

    const target =
        getTargetFromOptions(interaction);

    if (!target) {
        return safeReply(interaction, {
            content:
                'Indique exactement un utilisateur ou un role.',
            ephemeral: true
        });
    }

    const deferred =
        await safeDeferReply(interaction, {
            ephemeral: true
        });

    if (!deferred) return null;

    if (action === 'add') {
        await addAccess({
            guild: interaction.guild,
            request,
            targetType: target.type,
            targetId: target.id,
            addedBy: interaction.user
        });

        return safeReply(interaction, {
            content:
                `${target.mention} a ete ajoute a la demande ${request.id}.`
        });
    }

    await removeAccess({
        guild: interaction.guild,
        request,
        targetType: target.type,
        targetId: target.id
    });

    return safeReply(interaction, {
        content:
            `${target.mention} a ete retire de la demande ${request.id}.`
    });
}

async function handleList(interaction) {
    if (!await requireManagerPermission(interaction)) {
        return null;
    }

    const requests =
        await listOpenRequests(interaction.guild.id);

    const description =
        requests.length === 0
            ? 'Aucune demande ouverte.'
            : requests.map(request =>
                `ID: \`${request.id}\`
Membre: <@${request.requester_user_id}>
Salon: ${request.request_channel_id ? `<#${request.request_channel_id}>` : 'supprime'}
Date: ${formatDate(request.created_at)}
Statut: ${request.status}
Staff: ${request.staff_channel_id ? 'oui' : 'non'}
Vocal: ${request.voice_channel_id ? 'oui' : 'non'}`
            ).join('\n\n');

    return safeReply(interaction, {
        embeds: [
            buildEmbed(
                'Demandes ROD ouvertes',
                truncateText(description),
                0x5865F2
            )
        ],
        ephemeral: true
    });
}

async function handleInfo(interaction) {
    const request =
        await getRequestFromOption(interaction);

    if (!request) return null;

    if (!await requireManagerPermission(interaction, request)) {
        return null;
    }

    const accessRows =
        await listAccess(request.id);

    const description =
`ID: \`${request.id}\`
Membre: <@${request.requester_user_id}> (${request.requester_user_id})
Statut: ${request.status}
Salon demande: ${request.request_channel_id ? `<#${request.request_channel_id}>` : 'aucun'}
Salon staff: ${request.staff_channel_id ? `<#${request.staff_channel_id}>` : 'aucun'}
Vocal: ${request.voice_channel_id ? `<#${request.voice_channel_id}>` : 'aucun'}
Premiere reponse recue: ${request.first_message_received ? 'oui' : 'non'}
Creee le: ${formatDate(request.created_at)}
Cloturee le: ${formatDate(request.closed_at)}
Cloturee par: ${request.closed_by ? `<@${request.closed_by}>` : 'personne'}
Raison: ${request.close_reason || 'aucune'}

Participants ajoutes:
${accessRows.length > 0 ? accessRows.map(mentionAccess).join('\n') : 'Aucun'}`;

    return safeReply(interaction, {
        embeds: [
            buildEmbed(
                'Details demande ROD',
                description,
                0x5865F2
            )
        ],
        ephemeral: true
    });
}

async function handleDelete(interaction) {
    const request =
        await getRequestFromOption(interaction);

    if (!request) return null;

    if (!await requireManagerPermission(interaction, request)) {
        return null;
    }

    if (request.status !== 'open') {
        return safeReply(interaction, {
            content:
                'Cette demande est deja fermee ou supprimee.',
            ephemeral: true
        });
    }

    const reason =
        interaction.options.getString('raison') ||
        'Suppression manuelle';

    const deferred =
        await safeDeferReply(interaction, {
            ephemeral: true
        });

    if (!deferred) return null;

    await closeRequest({
        guild: interaction.guild,
        request,
        reason,
        closedBy: interaction.user,
        status: 'deleted'
    });

    return safeReply(interaction, {
        content:
            `Demande ${request.id} supprimee, transcript archive.`
    });
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rod')
        .setDescription('Gerer les demandes de nouveaux roles.')
        .addSubcommandGroup(group =>
            group
                .setName('setup')
                .setDescription('Configurer le module ROD.')
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('config')
                        .setDescription('Configurer le module en une seule fois.')
                        .addRoleOption(option =>
                            option
                                .setName('trigger_role')
                                .setDescription('Role qui declenche une demande')
                                .setRequired(true)
                        )
                        .addChannelOption(option =>
                            option
                                .setName('category')
                                .setDescription('Categorie des salons ROD')
                                .addChannelTypes(ChannelType.GuildCategory)
                                .setRequired(true)
                        )
                        .addChannelOption(option =>
                            option
                                .setName('alert_channel')
                                .setDescription('Salon des alertes staff')
                                .addChannelTypes(ChannelType.GuildText)
                                .setRequired(true)
                        )
                        .addChannelOption(option =>
                            option
                                .setName('archive_channel')
                                .setDescription('Salon des archives')
                                .addChannelTypes(ChannelType.GuildText)
                                .setRequired(true)
                        )
                        .addStringOption(option =>
                            option
                                .setName('alert_message')
                                .setDescription('Message d alerte personnalise')
                                .setRequired(false)
                        )
                        .addStringOption(option =>
                            option
                                .setName('request_message')
                                .setDescription('Message d accueil de la demande')
                                .setRequired(false)
                        )
                        .addStringOption(option =>
                            option
                                .setName('staff_message')
                                .setDescription('Message du salon staff')
                                .setRequired(false)
                        )
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('ping-role-add')
                        .setDescription('Ajouter un role a ping et staff.')
                        .addRoleOption(option =>
                            option
                                .setName('role')
                                .setDescription('Role a ajouter')
                                .setRequired(true)
                        )
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('ping-role-remove')
                        .setDescription('Retirer un role ping/staff.')
                        .addRoleOption(option =>
                            option
                                .setName('role')
                                .setDescription('Role a retirer')
                                .setRequired(true)
                        )
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('ping-role-list')
                        .setDescription('Lister les roles ping/staff.')
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('show')
                        .setDescription('Afficher la configuration complete.')
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('delete')
                .setDescription('Supprimer manuellement une demande.')
                .addStringOption(option =>
                    option
                        .setName('demande')
                        .setDescription('ID de la demande')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName('raison')
                        .setDescription('Raison de suppression')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Ajouter un utilisateur ou un role a une demande.')
                .addStringOption(option =>
                    option
                        .setName('demande')
                        .setDescription('ID de la demande')
                        .setRequired(true)
                )
                .addUserOption(option =>
                    option
                        .setName('utilisateur')
                        .setDescription('Utilisateur a ajouter')
                        .setRequired(false)
                )
                .addRoleOption(option =>
                    option
                        .setName('role')
                        .setDescription('Role a ajouter')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Retirer un utilisateur ou un role d une demande.')
                .addStringOption(option =>
                    option
                        .setName('demande')
                        .setDescription('ID de la demande')
                        .setRequired(true)
                )
                .addUserOption(option =>
                    option
                        .setName('utilisateur')
                        .setDescription('Utilisateur a retirer')
                        .setRequired(false)
                )
                .addRoleOption(option =>
                    option
                        .setName('role')
                        .setDescription('Role a retirer')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('Lister les demandes ouvertes.')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('info')
                .setDescription('Afficher les details d une demande.')
                .addStringOption(option =>
                    option
                        .setName('demande')
                        .setDescription('ID de la demande')
                        .setRequired(true)
                )
        ),

    async execute(interaction) {
        if (!interaction.inGuild()) {
            return safeReply(interaction, {
                content:
                    'Cette commande doit etre utilisee dans un serveur.',
                ephemeral: true
            });
        }

        const group =
            interaction.options.getSubcommandGroup(false);

        const subcommand =
            interaction.options.getSubcommand();

        try {
            if (group === 'setup') {
                if (subcommand === 'config') {
                    return handleSetupConfig(interaction);
                }

                if (subcommand === 'show') {
                    return handleSetupShow(interaction);
                }

                return handlePingRole(
                    interaction,
                    subcommand
                );
            }

            if (subcommand === 'add') {
                return handleAddRemove(interaction, 'add');
            }

            if (subcommand === 'remove') {
                return handleAddRemove(interaction, 'remove');
            }

            if (subcommand === 'list') {
                return handleList(interaction);
            }

            if (subcommand === 'info') {
                return handleInfo(interaction);
            }

            if (subcommand === 'delete') {
                return handleDelete(interaction);
            }

            return safeReply(interaction, {
                content:
                    'Sous-commande ROD inconnue.',
                ephemeral: true
            });

        } catch (error) {
            console.error(
                'Erreur commande ROD :',
                error
            );

            return safeReply(interaction, {
                content:
                    'Impossible de traiter la commande ROD.',
                ephemeral: true
            });
        }
    }
};

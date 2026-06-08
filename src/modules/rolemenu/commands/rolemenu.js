const {
    ChannelType,
    MessageFlags,
    PermissionFlagsBits,
    SlashCommandBuilder
} = require('discord.js');

const {
    requireBotPermission
} = require('../../../core/permissions');

const {
    MAX_OPTIONS,
    addRoleOption,
    createRolemenu,
    deleteRolemenu,
    getRolemenu,
    getRolemenuRoles,
    listRolemenus,
    removeRoleOption,
    setRolemenuEnabled,
    setRolemenuMessage,
    syncRoleMenu,
    updateRolemenu,
    updateRoleOption
} = require('../services/roleMenuService');

const {
    buildRolemenuPayload
} = require('../services/roleMenuRenderer');

function getRolemenuId(interaction) {
    return interaction.options.getInteger(
        'rolemenu_id'
    );
}

function formatRolemenuLine(menu) {
    return `#${menu.id} - ${menu.nom_interne} (${menu.actif ? 'actif' : 'inactif'})`;
}

function humanSyncError(error) {
    switch (error.message) {
        case 'ROLEMENU_NO_OPTIONS':
            return 'Ce rolemenu n’a aucune option active.';
        case 'ROLEMENU_TOO_MANY_OPTIONS':
            return `Ce rolemenu dépasse la limite de ${MAX_OPTIONS} options.`;
        case 'ROLEMENU_MESSAGE_NOT_SENT':
            return 'Ce rolemenu n’a pas encore été envoyé.';
        case 'ROLEMENU_CHANNEL_NOT_FOUND':
            return 'Salon rolemenu introuvable.';
        case 'ROLEMENU_MESSAGE_NOT_FOUND':
            return 'Message rolemenu introuvable.';
        case 'ROLEMENU_NOT_FOUND':
            return 'Rolemenu introuvable.';
        default:
            return 'Synchronisation impossible.';
    }
}

function formatSyncResult(result) {
    if (!result) return '';

    if (result.synced) {
        return '\n🔄 Message synchronisé.';
    }

    if (result.skipped) {
        return '';
    }

    return `\n⚠️ ${result.message}`;
}

async function replyWithSync(interaction, rolemenu, content) {
    if (
        !interaction.deferred &&
        !interaction.replied
    ) {
        await interaction.deferReply({
            flags:
                MessageFlags.Ephemeral
        });
    }

    const syncResult =
        await syncRoleMenu(
            interaction.client,
            interaction.guild.id,
            rolemenu.id
        );

    return interaction.editReply({
        content:
            `${content}${formatSyncResult(syncResult)}`
    });
}

module.exports = {

    data: new SlashCommandBuilder()

        .setName('rolemenu')

        .setDescription(
            'Gestion des rolemenus.'
        )

        .addSubcommand(subcommand =>
            subcommand
                .setName('create')
                .setDescription('Créer un rolemenu.')
                .addStringOption(option =>
                    option
                        .setName('nom')
                        .setDescription('Nom interne')
                        .setRequired(true)
                        .setMaxLength(100)
                )
                .addStringOption(option =>
                    option
                        .setName('titre')
                        .setDescription('Titre affiché')
                        .setRequired(true)
                        .setMaxLength(256)
                )
                .addStringOption(option =>
                    option
                        .setName('description')
                        .setDescription('Description affichée')
                        .setRequired(false)
                        .setMaxLength(4000)
                )
                .addStringOption(option =>
                    option
                        .setName('placeholder')
                        .setDescription('Placeholder du menu')
                        .setRequired(false)
                        .setMaxLength(100)
                )
                .addStringOption(option =>
                    option
                        .setName('couleur')
                        .setDescription('Couleur hexadécimale, exemple #5865F2')
                        .setRequired(false)
                        .setMaxLength(7)
                )
        )

        .addSubcommand(subcommand =>
            subcommand
                .setName('send')
                .setDescription('Envoyer un rolemenu dans un salon.')
                .addIntegerOption(option =>
                    option
                        .setName('rolemenu_id')
                        .setDescription('ID du rolemenu')
                        .setRequired(true)
                )
                .addChannelOption(option =>
                    option
                        .setName('salon')
                        .setDescription('Salon cible')
                        .addChannelTypes(
                            ChannelType.GuildText,
                            ChannelType.GuildAnnouncement
                        )
                        .setRequired(true)
                )
        )

        .addSubcommand(subcommand =>
            subcommand
                .setName('edit')
                .setDescription('Modifier un rolemenu.')
                .addIntegerOption(option =>
                    option
                        .setName('rolemenu_id')
                        .setDescription('ID du rolemenu')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName('nom')
                        .setDescription('Nom interne')
                        .setRequired(false)
                        .setMaxLength(100)
                )
                .addStringOption(option =>
                    option
                        .setName('titre')
                        .setDescription('Titre affiché')
                        .setRequired(false)
                        .setMaxLength(256)
                )
                .addStringOption(option =>
                    option
                        .setName('description')
                        .setDescription('Description affichée')
                        .setRequired(false)
                        .setMaxLength(4000)
                )
                .addStringOption(option =>
                    option
                        .setName('placeholder')
                        .setDescription('Placeholder du menu')
                        .setRequired(false)
                        .setMaxLength(100)
                )
                .addStringOption(option =>
                    option
                        .setName('couleur')
                        .setDescription('Couleur hexadécimale, exemple #5865F2')
                        .setRequired(false)
                        .setMaxLength(7)
                )
                .addChannelOption(option =>
                    option
                        .setName('salon')
                        .setDescription('Salon cible')
                        .addChannelTypes(
                            ChannelType.GuildText,
                            ChannelType.GuildAnnouncement
                        )
                        .setRequired(false)
                )
        )

        .addSubcommand(subcommand =>
            subcommand
                .setName('delete')
                .setDescription('Supprimer un rolemenu.')
                .addIntegerOption(option =>
                    option
                        .setName('rolemenu_id')
                        .setDescription('ID du rolemenu')
                        .setRequired(true)
                )
        )

        .addSubcommand(subcommand =>
            subcommand
                .setName('enable')
                .setDescription('Activer un rolemenu.')
                .addIntegerOption(option =>
                    option
                        .setName('rolemenu_id')
                        .setDescription('ID du rolemenu')
                        .setRequired(true)
                )
        )

        .addSubcommand(subcommand =>
            subcommand
                .setName('disable')
                .setDescription('Désactiver un rolemenu.')
                .addIntegerOption(option =>
                    option
                        .setName('rolemenu_id')
                        .setDescription('ID du rolemenu')
                        .setRequired(true)
                )
        )

        .addSubcommand(subcommand =>
            subcommand
                .setName('add_role')
                .setDescription('Ajouter une option de rôle.')
                .addIntegerOption(option =>
                    option
                        .setName('rolemenu_id')
                        .setDescription('ID du rolemenu')
                        .setRequired(true)
                )
                .addRoleOption(option =>
                    option
                        .setName('role')
                        .setDescription('Rôle à proposer')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName('label')
                        .setDescription('Label affiché')
                        .setRequired(true)
                        .setMaxLength(100)
                )
                .addStringOption(option =>
                    option
                        .setName('description')
                        .setDescription('Description courte')
                        .setRequired(false)
                        .setMaxLength(100)
                )
                .addStringOption(option =>
                    option
                        .setName('emoji')
                        .setDescription('Emoji optionnel')
                        .setRequired(false)
                        .setMaxLength(64)
                )
                .addIntegerOption(option =>
                    option
                        .setName('position')
                        .setDescription('Ordre d’affichage')
                        .setRequired(false)
                )
        )

        .addSubcommand(subcommand =>
            subcommand
                .setName('remove_role')
                .setDescription('Retirer une option de rôle.')
                .addIntegerOption(option =>
                    option
                        .setName('rolemenu_id')
                        .setDescription('ID du rolemenu')
                        .setRequired(true)
                )
                .addRoleOption(option =>
                    option
                        .setName('role')
                        .setDescription('Rôle à retirer')
                        .setRequired(true)
                )
        )

        .addSubcommand(subcommand =>
            subcommand
                .setName('edit_role')
                .setDescription('Modifier une option de rôle.')
                .addIntegerOption(option =>
                    option
                        .setName('rolemenu_id')
                        .setDescription('ID du rolemenu')
                        .setRequired(true)
                )
                .addRoleOption(option =>
                    option
                        .setName('role')
                        .setDescription('Rôle à modifier')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName('label')
                        .setDescription('Nouveau label')
                        .setRequired(false)
                        .setMaxLength(100)
                )
                .addStringOption(option =>
                    option
                        .setName('description')
                        .setDescription('Nouvelle description')
                        .setRequired(false)
                        .setMaxLength(100)
                )
                .addStringOption(option =>
                    option
                        .setName('emoji')
                        .setDescription('Nouvel emoji')
                        .setRequired(false)
                        .setMaxLength(64)
                )
                .addIntegerOption(option =>
                    option
                        .setName('position')
                        .setDescription('Nouvelle position')
                        .setRequired(false)
                )
                .addBooleanOption(option =>
                    option
                        .setName('actif')
                        .setDescription('Activer ou désactiver cette option')
                        .setRequired(false)
                )
        )

        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('Lister les rolemenus.')
        )

        .addSubcommand(subcommand =>
            subcommand
                .setName('info')
                .setDescription('Afficher les détails d’un rolemenu.')
                .addIntegerOption(option =>
                    option
                        .setName('rolemenu_id')
                        .setDescription('ID du rolemenu')
                        .setRequired(true)
                )
        )

        .addSubcommand(subcommand =>
            subcommand
                .setName('sync')
                .setDescription('Resynchroniser un rolemenu.')
                .addIntegerOption(option =>
                    option
                        .setName('rolemenu_id')
                        .setDescription('ID du rolemenu')
                        .setRequired(true)
                )
        )

        .addSubcommand(subcommand =>
            subcommand
                .setName('sync_all')
                .setDescription('Resynchroniser tous les rolemenus actifs.')
        )

        .setDefaultMemberPermissions(
            PermissionFlagsBits.ManageRoles
        ),

    async execute(interaction) {

        const subcommand =
            interaction.options.getSubcommand();

        const guildId =
            interaction.guild.id;

        if (subcommand === 'create') {

            const rolemenu =
                await createRolemenu(guildId, {
                    nomInterne:
                        interaction.options.getString('nom'),
                    titre:
                        interaction.options.getString('titre'),
                    description:
                        interaction.options.getString('description'),
                    placeholder:
                        interaction.options.getString('placeholder'),
                    couleur:
                        interaction.options.getString('couleur')
                });

            return replyWithSync(
                interaction,
                rolemenu,
                `✅ Rolemenu créé : #${rolemenu.id}`
            );
        }

        if (subcommand === 'send') {

            if (!await requireBotPermission(
                interaction,
                PermissionFlagsBits.ManageRoles,
                'ManageRoles'
            )) return;

            await interaction.deferReply({
                flags:
                    MessageFlags.Ephemeral
            });

            const rolemenuId =
                getRolemenuId(interaction);

            const channel =
                interaction.options.getChannel('salon');

            const rolemenu =
                await getRolemenu(guildId, rolemenuId);

            if (!rolemenu) {

                return interaction.editReply({

                    content:
                        '❌ Rolemenu introuvable.'
                });
            }

            try {

                const payload =
                    await buildRolemenuPayload(
                        interaction.guild,
                        rolemenu
                    );

                const message =
                    await channel.send(payload);

                await setRolemenuMessage(
                    guildId,
                    rolemenuId,
                    channel.id,
                    message.id
                );

                return interaction.editReply({

                    content:
                        `✅ Rolemenu envoyé dans ${channel}.`
                });

            } catch (error) {

                console.error(`Erreur envoi rolemenu ${rolemenuId}:`, error);

                return interaction.editReply({

                    content:
                        `❌ ${humanSyncError(error)}`
                });
            }
        }

        if (subcommand === 'edit') {

            const channel =
                interaction.options.getChannel('salon');

            const rolemenu =
                await updateRolemenu(
                    guildId,
                    getRolemenuId(interaction),
                    {
                        nomInterne:
                            interaction.options.getString('nom'),
                        titre:
                            interaction.options.getString('titre'),
                        description:
                            interaction.options.getString('description'),
                        placeholder:
                            interaction.options.getString('placeholder'),
                        couleur:
                            interaction.options.getString('couleur'),
                        channelId:
                            channel?.id
                    }
                );

            if (!rolemenu) {

                return interaction.reply({

                    content:
                        '❌ Rolemenu introuvable.',

                    ephemeral: true
                });
            }

            return replyWithSync(
                interaction,
                rolemenu,
                `✅ Rolemenu modifié : #${rolemenu.id}`
            );
        }

        if (subcommand === 'delete') {

            const deleted =
                await deleteRolemenu(
                    guildId,
                    getRolemenuId(interaction)
                );

            return interaction.reply({

                content:
                    deleted
                        ? `✅ Rolemenu supprimé : #${deleted.id}`
                        : '❌ Rolemenu introuvable.',

                ephemeral: true
            });
        }

        if (
            subcommand === 'enable' ||
            subcommand === 'disable'
        ) {

            const rolemenu =
                await setRolemenuEnabled(
                    guildId,
                    getRolemenuId(interaction),
                    subcommand === 'enable'
                );

            if (!rolemenu) {

                return interaction.reply({

                    content:
                        '❌ Rolemenu introuvable.',

                    ephemeral: true
                });
            }

            return replyWithSync(
                interaction,
                rolemenu,
                `✅ Rolemenu ${subcommand === 'enable' ? 'activé' : 'désactivé'} : #${rolemenu.id}`
            );
        }

        if (subcommand === 'add_role') {

            const rolemenu =
                await getRolemenu(
                    guildId,
                    getRolemenuId(interaction)
                );

            const role =
                interaction.options.getRole('role');

            if (!rolemenu) {

                return interaction.reply({
                    content: '❌ Rolemenu introuvable.',
                    ephemeral: true
                });
            }

            if (role.id === interaction.guild.id) {

                return interaction.reply({
                    content: '❌ @everyone ne peut pas être ajouté.',
                    ephemeral: true
                });
            }

            try {

                const option =
                    await addRoleOption(rolemenu.id, {
                        roleId: role.id,
                        label:
                            interaction.options.getString('label'),
                        description:
                            interaction.options.getString('description'),
                        emoji:
                            interaction.options.getString('emoji'),
                        position:
                            interaction.options.getInteger('position') ?? 0
                    });

                return replyWithSync(
                    interaction,
                    rolemenu,
                    `✅ Rôle ajouté au rolemenu : ${role} (#${option.id})`
                );

            } catch (error) {

                console.error(`Erreur ajout rôle rolemenu ${rolemenu.id}:`, error);

                return interaction.reply({
                    content:
                        error.message === 'ROLEMENU_TOO_MANY_OPTIONS'
                            ? `❌ Limite de ${MAX_OPTIONS} rôles atteinte.`
                            : '❌ Impossible d’ajouter ce rôle.',
                    ephemeral: true
                });
            }
        }

        if (subcommand === 'remove_role') {

            const rolemenu =
                await getRolemenu(
                    guildId,
                    getRolemenuId(interaction)
                );

            const role =
                interaction.options.getRole('role');

            if (!rolemenu) {
                return interaction.reply({
                    content: '❌ Rolemenu introuvable.',
                    ephemeral: true
                });
            }

            const removed =
                await removeRoleOption(
                    rolemenu.id,
                    role.id
                );

            if (!removed) {

                return interaction.reply({
                    content:
                        '❌ Ce rôle n’est pas dans ce rolemenu.',
                    ephemeral: true
                });
            }

            return replyWithSync(
                interaction,
                rolemenu,
                `✅ Rôle retiré du rolemenu : ${role}`
            );
        }

        if (subcommand === 'edit_role') {

            const rolemenu =
                await getRolemenu(
                    guildId,
                    getRolemenuId(interaction)
                );

            const role =
                interaction.options.getRole('role');

            if (!rolemenu) {
                return interaction.reply({
                    content: '❌ Rolemenu introuvable.',
                    ephemeral: true
                });
            }

            const updated =
                await updateRoleOption(
                    rolemenu.id,
                    role.id,
                    {
                        label:
                            interaction.options.getString('label'),
                        description:
                            interaction.options.getString('description'),
                        emoji:
                            interaction.options.getString('emoji'),
                        position:
                            interaction.options.getInteger('position'),
                        actif:
                            interaction.options.getBoolean('actif')
                    }
                );

            if (!updated) {

                return interaction.reply({
                    content:
                        '❌ Option introuvable.',
                    ephemeral: true
                });
            }

            return replyWithSync(
                interaction,
                rolemenu,
                `✅ Option modifiée : ${role}`
            );
        }

        if (subcommand === 'list') {

            const rolemenus =
                await listRolemenus(guildId);

            return interaction.reply({
                content:
                    rolemenus.length > 0
                        ? rolemenus.map(formatRolemenuLine).join('\n')
                        : 'Aucun rolemenu configuré.',
                ephemeral: true
            });
        }

        if (subcommand === 'info') {

            const rolemenu =
                await getRolemenu(
                    guildId,
                    getRolemenuId(interaction)
                );

            if (!rolemenu) {
                return interaction.reply({
                    content: '❌ Rolemenu introuvable.',
                    ephemeral: true
                });
            }

            const options =
                await getRolemenuRoles(rolemenu.id);

            const roles =
                options.length > 0
                    ? options
                        .map(option =>
                            `${option.position}. <@&${option.role_id}> - ${option.label} (${option.actif ? 'actif' : 'inactif'})`
                        )
                        .join('\n')
                    : 'Aucun rôle.';

            return interaction.reply({
                content:
`#${rolemenu.id} - ${rolemenu.nom_interne}
Titre : ${rolemenu.titre}
Salon : ${rolemenu.channel_id ? `<#${rolemenu.channel_id}>` : 'Non envoyé'}
Message : ${rolemenu.message_id || 'Non envoyé'}
État : ${rolemenu.actif ? 'actif' : 'inactif'}

${roles}`,
                ephemeral: true
            });
        }

        if (subcommand === 'sync') {

            const rolemenuId =
                getRolemenuId(interaction);

            await interaction.deferReply({
                flags:
                    MessageFlags.Ephemeral
            });

            try {

                const syncResult =
                    await syncRoleMenu(
                    interaction.client,
                    guildId,
                    rolemenuId
                );

                if (!syncResult.synced) {

                    return interaction.editReply({
                        content:
                            `❌ ${syncResult.message}`
                    });
                }

                return interaction.editReply({
                    content:
                        `✅ Rolemenu synchronisé : #${rolemenuId}`
                });

            } catch (error) {

                console.error(`Erreur sync rolemenu ${rolemenuId}:`, error);

                return interaction.editReply({
                    content:
                        `❌ ${humanSyncError(error)}`
                });
            }
        }

        if (subcommand === 'sync_all') {

            await interaction.deferReply({
                flags:
                    MessageFlags.Ephemeral
            });

            const rolemenus =
                await listRolemenus(guildId, true);

            let success = 0;
            let failed = 0;

            for (const rolemenu of rolemenus) {

                try {

                    const syncResult =
                        await syncRoleMenu(
                        interaction.client,
                        guildId,
                        rolemenu.id
                    );

                    if (syncResult.synced || syncResult.skipped) {
                        success++;
                    } else {
                        failed++;
                    }

                } catch (error) {

                    failed++;

                    console.error(
                        `Erreur sync_all rolemenu ${rolemenu.id}:`,
                        error
                    );
                }
            }

            return interaction.editReply({
                content:
`✅ Synchronisation terminée.

Réussites : ${success}
Échecs : ${failed}`
            });
        }
    }
};

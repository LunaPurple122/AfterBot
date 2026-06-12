const {
    ChannelType,
    PermissionFlagsBits,
    SlashCommandBuilder
} = require('discord.js');

const {
    addAllowedRole,
    addPingRole,
    canManageBump,
    canUseBumpOk,
    getBumpConfig,
    isSupportedReminderChannel,
    launchBumpReminders,
    listAllowedRoles,
    listPingRoles,
    removeAllowedRole,
    removePingRole,
    upsertBumpChannel,
    upsertBumpMessage
} = require('../services/bumpService');

function isAdmin(member) {
    return member?.permissions?.has(
        PermissionFlagsBits.Administrator
    );
}

function formatRoleList(roleIds, emptyMessage) {
    if (roleIds.length === 0) {
        return emptyMessage;
    }

    return roleIds
        .map(roleId => `<@&${roleId}>`)
        .join('\n');
}

async function ensureGuild(interaction) {
    if (interaction.guild) {
        return true;
    }

    await interaction.reply({
        content:
            '❌ Cette commande doit être utilisée sur un serveur.',
        ephemeral: true
    });

    return false;
}

async function ensureAdmin(interaction) {
    if (isAdmin(interaction.member)) {
        return true;
    }

    await interaction.reply({
        content:
            '❌ Cette commande est réservée aux administrateurs.',
        ephemeral: true
    });

    return false;
}

async function ensureManager(interaction) {
    if (await canManageBump(interaction.member)) {
        return true;
    }

    await interaction.reply({
        content:
            '❌ Tu n’as pas la permission de configurer le bump.',
        ephemeral: true
    });

    return false;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('bump')
        .setDescription('Gestion des rappels bump.')

        .addSubcommand(subcommand =>
            subcommand
                .setName('ok')
                .setDescription('Lancer ou relancer les rappels bump.')
        )

        .addSubcommand(subcommand =>
            subcommand
                .setName('chanel')
                .setDescription('Définir le salon des rappels bump.')
                .addChannelOption(option =>
                    option
                        .setName('salon')
                        .setDescription('Salon où envoyer les rappels')
                        .addChannelTypes(
                            ChannelType.GuildText,
                            ChannelType.GuildAnnouncement
                        )
                        .setRequired(true)
                )
        )

        .addSubcommandGroup(group =>
            group
                .setName('message')
                .setDescription('Configurer les messages de rappel.')
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('2heures')
                        .setDescription('Définir le message envoyé après 2h.')
                        .addStringOption(option =>
                            option
                                .setName('message')
                                .setDescription('Message du rappel 2h')
                                .setRequired(true)
                                .setMaxLength(1900)
                        )
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('4heures')
                        .setDescription('Définir le message envoyé après 4h.')
                        .addStringOption(option =>
                            option
                                .setName('message')
                                .setDescription('Message du rappel 4h')
                                .setRequired(true)
                                .setMaxLength(1900)
                        )
                )
        )

        .addSubcommandGroup(group =>
            group
                .setName('role')
                .setDescription('Gérer les rôles autorisés à utiliser /bump ok.')
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('add')
                        .setDescription('Ajouter un rôle autorisé.')
                        .addRoleOption(option =>
                            option
                                .setName('role')
                                .setDescription('Rôle à autoriser')
                                .setRequired(true)
                        )
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('remove')
                        .setDescription('Retirer un rôle autorisé.')
                        .addRoleOption(option =>
                            option
                                .setName('role')
                                .setDescription('Rôle à retirer')
                                .setRequired(true)
                        )
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('list')
                        .setDescription('Lister les rôles autorisés.')
                )
        )

        .addSubcommandGroup(group =>
            group
                .setName('pingrole')
                .setDescription('Gérer les rôles ping dans les rappels.')
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('add')
                        .setDescription('Ajouter un rôle à ping.')
                        .addRoleOption(option =>
                            option
                                .setName('role')
                                .setDescription('Rôle à ping')
                                .setRequired(true)
                        )
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('remove')
                        .setDescription('Retirer un rôle ping.')
                        .addRoleOption(option =>
                            option
                                .setName('role')
                                .setDescription('Rôle à retirer')
                                .setRequired(true)
                        )
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('list')
                        .setDescription('Lister les rôles ping.')
                )
        ),

    async execute(interaction) {
        if (!await ensureGuild(interaction)) {
            return;
        }

        const group =
            interaction.options.getSubcommandGroup(false);

        const subcommand =
            interaction.options.getSubcommand();

        const guildId =
            interaction.guild.id;

        if (!group && subcommand === 'ok') {
            if (!await canUseBumpOk(interaction.member)) {
                return interaction.reply({
                    content:
                        '❌ Tu n’as pas la permission de lancer les rappels bump.',
                    ephemeral: true
                });
            }

            const config =
                await getBumpConfig(guildId);

            if (
                !config?.channel_id ||
                !config?.message_2h ||
                !config?.message_4h
            ) {
                return interaction.reply({
                    content:
                        '❌ Configuration incomplète : configure le salon et les messages 2h/4h avant de lancer les rappels.',
                    ephemeral: true
                });
            }

            await launchBumpReminders(
                interaction.client,
                guildId,
                interaction.user.id
            );

            return interaction.reply({
                content:
                    '✅ Les rappels bump 2h et 4h sont lancés.'
            });
        }

        if (!group && subcommand === 'chanel') {
            if (!await ensureManager(interaction)) {
                return;
            }

            const channel =
                interaction.options.getChannel('salon');

            if (!isSupportedReminderChannel(channel)) {
                return interaction.reply({
                    content:
                        '❌ Choisis un salon textuel valide.',
                    ephemeral: true
                });
            }

            await upsertBumpChannel(
                guildId,
                channel.id
            );

            return interaction.reply({
                content:
                    `✅ Salon des rappels bump défini : ${channel}`,
                ephemeral: true
            });
        }

        if (group === 'message') {
            if (!await ensureManager(interaction)) {
                return;
            }

            const reminderType =
                subcommand === '2heures'
                    ? '2h'
                    : '4h';

            const message =
                interaction.options.getString('message');

            await upsertBumpMessage(
                guildId,
                reminderType,
                message
            );

            return interaction.reply({
                content:
                    `✅ Message ${subcommand} enregistré.`,
                ephemeral: true
            });
        }

        if (group === 'role') {
            if (subcommand !== 'list' && !await ensureAdmin(interaction)) {
                return;
            }

            if (subcommand === 'add') {
                const role =
                    interaction.options.getRole('role');

                await addAllowedRole(
                    guildId,
                    role.id
                );

                return interaction.reply({
                    content:
                        `✅ Rôle autorisé ajouté : ${role}`,
                    ephemeral: true
                });
            }

            if (subcommand === 'remove') {
                const role =
                    interaction.options.getRole('role');

                const removed =
                    await removeAllowedRole(
                        guildId,
                        role.id
                    );

                return interaction.reply({
                    content:
                        removed
                            ? `✅ Rôle autorisé retiré : ${role}`
                            : '❌ Ce rôle n’était pas autorisé.',
                    ephemeral: true
                });
            }

            const roles =
                await listAllowedRoles(guildId);

            return interaction.reply({
                content:
                    formatRoleList(
                        roles,
                        'Aucun rôle autorisé configuré.'
                    ),
                ephemeral: true
            });
        }

        if (group === 'pingrole') {
            if (subcommand !== 'list' && !await ensureAdmin(interaction)) {
                return;
            }

            if (subcommand === 'add') {
                const role =
                    interaction.options.getRole('role');

                await addPingRole(
                    guildId,
                    role.id
                );

                return interaction.reply({
                    content:
                        `✅ Rôle ping ajouté : ${role}`,
                    ephemeral: true
                });
            }

            if (subcommand === 'remove') {
                const role =
                    interaction.options.getRole('role');

                const removed =
                    await removePingRole(
                        guildId,
                        role.id
                    );

                return interaction.reply({
                    content:
                        removed
                            ? `✅ Rôle ping retiré : ${role}`
                            : '❌ Ce rôle n’était pas configuré comme rôle ping.',
                    ephemeral: true
                });
            }

            const roles =
                await listPingRoles(guildId);

            return interaction.reply({
                content:
                    formatRoleList(
                        roles,
                        'Aucun rôle ping configuré.'
                    ),
                ephemeral: true
            });
        }
    }
};

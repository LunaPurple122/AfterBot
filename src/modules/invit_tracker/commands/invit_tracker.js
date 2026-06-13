const {
    ChannelType,
    EmbedBuilder,
    PermissionFlagsBits,
    SlashCommandBuilder
} = require('discord.js');

const {
    addReward,
    getInvitedBy,
    getInviteInfo,
    getInviteRows,
    getJoinInfo,
    getLeaderboard,
    getStats,
    hasManageGuild,
    listRewards,
    removeReward,
    resetConfig,
    setEnabled,
    setLogChannel,
    syncGuildInvites
} = require('../services/inviteTrackerService');

function isAdmin(member) {
    return member?.permissions?.has(
        PermissionFlagsBits.Administrator
    );
}

async function ensureGuild(interaction) {
    if (interaction.guild) {
        return true;
    }

    await interaction.reply({
        content: 'Cette commande doit etre utilisee sur un serveur.',
        ephemeral: true
    });

    return false;
}

async function ensureAdmin(interaction) {
    if (isAdmin(interaction.member)) {
        return true;
    }

    await interaction.reply({
        content: 'Cette commande est reservee aux administrateurs.',
        ephemeral: true
    });

    return false;
}

function formatDate(value) {
    if (!value) {
        return 'Jamais';
    }

    const time =
        new Date(value).getTime();

    if (Number.isNaN(time)) {
        return 'Inconnue';
    }

    return `<t:${Math.floor(time / 1000)}:f>`;
}

function numberValue(value) {
    return Number(value || 0).toLocaleString('fr-FR');
}

function trimLines(lines, limit = 20) {
    if (lines.length <= limit) {
        return lines.join('\n');
    }

    return [
        ...lines.slice(0, limit),
        `... et ${lines.length - limit} lignes supplementaires.`
    ].join('\n');
}

function statusLabel(row) {
    return row.is_present
        ? 'present'
        : 'parti';
}

function buildStatsEmbed(user, stats) {
    return new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`Stats invitations - ${user.tag}`)
        .addFields(
            {
                name: 'Liens crees',
                value: numberValue(stats.links_created),
                inline: true
            },
            {
                name: 'Invites total',
                value: numberValue(stats.total_invited),
                inline: true
            },
            {
                name: 'Encore presents',
                value: numberValue(stats.active_invited),
                inline: true
            },
            {
                name: 'Ont quitte',
                value: numberValue(stats.left_invited),
                inline: true
            },
            {
                name: 'Liens actifs',
                value: numberValue(stats.active_links),
                inline: true
            }
        )
        .setTimestamp();
}

async function handleListInvit(interaction) {
    const user =
        interaction.options.getUser('user');

    const rows =
        await getInviteRows(
            interaction.guild.id,
            user?.id || null
        );

    const lines =
        rows.map(row => {
            const creator =
                row.inviter_id
                    ? `<@${row.inviter_id}>`
                    : row.inviter_username || 'Inconnu';

            return [
                `\`${row.invite_code}\``,
                `${numberValue(row.uses)} utilisations`,
                `cree: ${formatDate(row.discord_created_at || row.created_at)}`,
                `expire: ${formatDate(row.expires_at)}`,
                user ? null : `createur: ${creator}`
            ]
                .filter(Boolean)
                .join(' - ');
        });

    const embed =
        new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle(
                user
                    ? `Liens crees par ${user.tag}`
                    : 'Liens invitation du serveur'
            )
            .setDescription(
                lines.length > 0
                    ? trimLines(lines)
                    : 'Aucun lien connu.'
            )
            .setFooter({
                text: `${rows.length} lien(s)`
            })
            .setTimestamp();

    return interaction.reply({
        embeds: [embed],
        ephemeral: true
    });
}

async function handleLeaderboard(interaction) {
    const type =
        interaction.options.getString('type') || 'total';

    const rows =
        await getLeaderboard(
            interaction.guild,
            type
        );

    const lines =
        rows.map((row, index) =>
            `#${index + 1} <@${row.userId}> - ${numberValue(row.value)}`
        );

    const embed =
        new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle(`Classement invitations - ${type}`)
            .setDescription(
                lines.length > 0
                    ? trimLines(lines, 25)
                    : 'Aucun membre trouve.'
            )
            .setFooter({
                text: 'Les membres a 0 invitation sont inclus.'
            })
            .setTimestamp();

    return interaction.reply({
        embeds: [embed]
    });
}

async function handleWho(interaction) {
    const user =
        interaction.options.getUser('user');

    const row =
        await getJoinInfo(
            interaction.guild.id,
            user.id
        );

    if (!row || row.detection_status !== 'detected') {
        return interaction.reply({
            content:
                `Aucune invitation connue pour ${user}. Statut: ${row?.detection_status || 'inconnu'}.`,
            ephemeral: true
        });
    }

    const embed =
        new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle(`Invitation de ${user.tag}`)
            .addFields(
                {
                    name: 'Lien',
                    value: row.invite_code
                        ? `\`${row.invite_code}\``
                        : 'Inconnu',
                    inline: true
                },
                {
                    name: 'Createur',
                    value: row.inviter_id
                        ? `<@${row.inviter_id}>`
                        : row.inviter_username || 'Inconnu',
                    inline: true
                },
                {
                    name: 'Arrivee',
                    value: formatDate(row.joined_at),
                    inline: false
                }
            )
            .setTimestamp();

    return interaction.reply({
        embeds: [embed],
        ephemeral: true
    });
}

async function handleInvited(interaction, onlyLeft = false) {
    const user =
        interaction.options.getUser('user');

    const rows =
        await getInvitedBy(
            interaction.guild.id,
            user.id,
            onlyLeft
        );

    const lines =
        rows.map(row => {
            const base =
                `${row.invited_username || 'Utilisateur inconnu'} (${row.invited_user_id})`;

            return onlyLeft
                ? `${base} - arrivee: ${formatDate(row.joined_at)} - depart: ${formatDate(row.left_at)}`
                : `${base} - arrivee: ${formatDate(row.joined_at)} - ${statusLabel(row)}`;
        });

    const embed =
        new EmbedBuilder()
            .setColor(onlyLeft ? 0xED4245 : 0x5865F2)
            .setTitle(
                onlyLeft
                    ? `Invites partis - ${user.tag}`
                    : `Invites par ${user.tag}`
            )
            .setDescription(
                lines.length > 0
                    ? trimLines(lines)
                    : 'Aucun membre trouve.'
            )
            .setFooter({
                text: `${rows.length} membre(s)`
            })
            .setTimestamp();

    return interaction.reply({
        embeds: [embed],
        ephemeral: true
    });
}

async function handleStats(interaction, forcedUser = null) {
    const user =
        forcedUser ||
        interaction.options.getUser('user') ||
        interaction.user;

    const stats =
        await getStats(
            interaction.guild.id,
            user.id
        );

    return interaction.reply({
        embeds: [
            buildStatsEmbed(
                user,
                stats
            )
        ],
        ephemeral: true
    });
}

async function handleInvite(interaction) {
    const code =
        interaction.options.getString('code');

    const row =
        await getInviteInfo(
            interaction.guild.id,
            code
        );

    if (!row) {
        return interaction.reply({
            content: `Aucun lien connu avec le code \`${code}\`.`,
            ephemeral: true
        });
    }

    const embed =
        new EmbedBuilder()
            .setColor(row.is_active ? 0x57F287 : 0xED4245)
            .setTitle(`Invitation ${row.invite_code}`)
            .addFields(
                {
                    name: 'URL',
                    value: row.invite_url || 'Inconnue',
                    inline: false
                },
                {
                    name: 'Createur',
                    value: row.inviter_id
                        ? `<@${row.inviter_id}>`
                        : row.inviter_username || 'Inconnu',
                    inline: true
                },
                {
                    name: 'Utilisations',
                    value: numberValue(row.uses),
                    inline: true
                },
                {
                    name: 'Max uses',
                    value: row.max_uses
                        ? numberValue(row.max_uses)
                        : 'Illimite',
                    inline: true
                },
                {
                    name: 'Expiration',
                    value: formatDate(row.expires_at),
                    inline: true
                },
                {
                    name: 'Creation',
                    value: formatDate(row.discord_created_at || row.created_at),
                    inline: true
                },
                {
                    name: 'Membres detectes',
                    value: numberValue(row.joined_count),
                    inline: true
                }
            )
            .setTimestamp();

    return interaction.reply({
        embeds: [embed],
        ephemeral: true
    });
}

async function handleReward(interaction, subcommand) {
    if (!await ensureAdmin(interaction)) {
        return;
    }

    if (subcommand === 'add') {
        const count =
            interaction.options.getInteger('count');

        const role =
            interaction.options.getRole('role');

        await addReward(
            interaction.guild.id,
            count,
            role.id
        );

        return interaction.reply({
            content: `Palier ajoute: ${count} invitations actives -> ${role}.`,
            ephemeral: true
        });
    }

    if (subcommand === 'remove') {
        const count =
            interaction.options.getInteger('count');

        const removed =
            await removeReward(
                interaction.guild.id,
                count
            );

        return interaction.reply({
            content: removed
                ? `Palier ${count} supprime.`
                : `Aucun palier configure pour ${count}.`,
            ephemeral: true
        });
    }

    const rewards =
        await listRewards(interaction.guild.id);

    return interaction.reply({
        content: rewards.length > 0
            ? rewards
                .map(row => `${row.invite_count} invitations actives -> <@&${row.role_id}>`)
                .join('\n')
            : 'Aucun palier configure.',
        ephemeral: true
    });
}

async function handleVerify(interaction) {
    if (!await ensureAdmin(interaction)) {
        return;
    }

    if (!hasManageGuild(interaction.guild)) {
        return interaction.reply({
            content:
                'Permission bot manquante: Gérer le serveur / Manage Guild est necessaire pour lire les invitations.',
            ephemeral: true
        });
    }

    await interaction.deferReply({
        ephemeral: true
    });

    const invites =
        await syncGuildInvites(interaction.guild);

    return interaction.editReply({
        content:
            `Verification terminee: ${invites.size} lien(s) synchronise(s).`
    });
}

async function handleConfig(interaction, subcommand) {
    if (!await ensureAdmin(interaction)) {
        return;
    }

    if (subcommand === 'logs') {
        const channel =
            interaction.options.getChannel('channel');

        await setLogChannel(
            interaction.guild.id,
            channel.id
        );

        return interaction.reply({
            content: `Salon logs invit_tracker defini: ${channel}.`,
            ephemeral: true
        });
    }

    if (subcommand === 'enable') {
        await setEnabled(
            interaction.guild.id,
            true
        );

        return interaction.reply({
            content: 'Invite tracker active.',
            ephemeral: true
        });
    }

    if (subcommand === 'disable') {
        await setEnabled(
            interaction.guild.id,
            false
        );

        return interaction.reply({
            content: 'Invite tracker desactive.',
            ephemeral: true
        });
    }

    await resetConfig(interaction.guild.id);

    return interaction.reply({
        content:
            'Configuration invit_tracker reinitialisee. L historique des invitations est conserve.',
        ephemeral: true
    });
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('invit_tracker')
        .setDescription('Suivre les invitations du serveur.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('listinvit')
                .setDescription('Lister les invitations connues.')
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('Createur des invitations')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('leaderboard')
                .setDescription('Afficher le classement des invitations.')
                .addStringOption(option =>
                    option
                        .setName('type')
                        .setDescription('Type de classement')
                        .addChoices(
                            {
                                name: 'total',
                                value: 'total'
                            },
                            {
                                name: 'active',
                                value: 'active'
                            },
                            {
                                name: 'month',
                                value: 'month'
                            }
                        )
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('who')
                .setDescription('Afficher via quel lien un membre a rejoint.')
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('Membre a rechercher')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('inviter')
                .setDescription('Alias de who.')
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('Membre a rechercher')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('invited')
                .setDescription('Lister les membres invites par un utilisateur.')
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('Inviteur')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('stats')
                .setDescription('Afficher les statistiques invitations.')
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('Utilisateur')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('leaves')
                .setDescription('Lister les invites partis.')
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('Inviteur')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('invite')
                .setDescription('Afficher les informations d un lien.')
                .addStringOption(option =>
                    option
                        .setName('code')
                        .setDescription('Code du lien')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('me')
                .setDescription('Afficher vos statistiques invitations.')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('verify')
                .setDescription('Rescanner tous les liens du serveur.')
        )
        .addSubcommandGroup(group =>
            group
                .setName('reward')
                .setDescription('Gerer les recompenses automatiques.')
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('add')
                        .setDescription('Ajouter un palier.')
                        .addIntegerOption(option =>
                            option
                                .setName('count')
                                .setDescription('Nombre d invitations actives')
                                .setMinValue(1)
                                .setRequired(true)
                        )
                        .addRoleOption(option =>
                            option
                                .setName('role')
                                .setDescription('Role a donner')
                                .setRequired(true)
                        )
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('remove')
                        .setDescription('Supprimer un palier.')
                        .addIntegerOption(option =>
                            option
                                .setName('count')
                                .setDescription('Nombre d invitations actives')
                                .setMinValue(1)
                                .setRequired(true)
                        )
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('list')
                        .setDescription('Lister les paliers.')
                )
        )
        .addSubcommandGroup(group =>
            group
                .setName('config')
                .setDescription('Configurer invit_tracker.')
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('logs')
                        .setDescription('Definir le salon logs.')
                        .addChannelOption(option =>
                            option
                                .setName('channel')
                                .setDescription('Salon logs')
                                .addChannelTypes(
                                    ChannelType.GuildText,
                                    ChannelType.GuildAnnouncement
                                )
                                .setRequired(true)
                        )
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('enable')
                        .setDescription('Activer le module.')
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('disable')
                        .setDescription('Desactiver le module.')
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('reset')
                        .setDescription('Reinitialiser la configuration.')
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

        if (group === 'reward') {
            return handleReward(
                interaction,
                subcommand
            );
        }

        if (group === 'config') {
            return handleConfig(
                interaction,
                subcommand
            );
        }

        if (subcommand === 'listinvit') {
            return handleListInvit(interaction);
        }

        if (subcommand === 'leaderboard') {
            return handleLeaderboard(interaction);
        }

        if (
            subcommand === 'who' ||
            subcommand === 'inviter'
        ) {
            return handleWho(interaction);
        }

        if (subcommand === 'invited') {
            return handleInvited(interaction);
        }

        if (subcommand === 'stats') {
            return handleStats(interaction);
        }

        if (subcommand === 'leaves') {
            return handleInvited(
                interaction,
                true
            );
        }

        if (subcommand === 'invite') {
            return handleInvite(interaction);
        }

        if (subcommand === 'me') {
            return handleStats(
                interaction,
                interaction.user
            );
        }

        if (subcommand === 'verify') {
            return handleVerify(interaction);
        }
    }
};

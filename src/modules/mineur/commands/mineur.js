const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    PermissionFlagsBits,
    SlashCommandBuilder,
    TextInputBuilder,
    TextInputStyle
} = require('discord.js');

const {
    safeDeferReply,
    safeReply
} = require('../../../core/interactions');

const {
    requireBotPermission
} = require('../../../core/permissions');

const {
    addMinorRole,
    buildBanListEmbed,
    executeMinorBan,
    getDmMessage,
    getMinorRoleIds,
    listMinorBans,
    listMinorRoles,
    memberCanManageMineur,
    removeMinorRole
} = require('../services/mineurService');

const PAGE_SIZE = 8;
const MAX_DM_LENGTH = 1900;

function buildMessageModal(interaction, currentMessage) {
    const modal =
        new ModalBuilder()
            .setCustomId(`mineur_msg:${interaction.user.id}`)
            .setTitle('Message MP mineur');

    const input =
        new TextInputBuilder()
            .setCustomId('dm_message')
            .setLabel('Message envoye avant le ban')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Explique pourquoi le membre est banni...')
            .setRequired(true)
            .setMaxLength(MAX_DM_LENGTH);

    if (currentMessage) {
        input.setValue(
            currentMessage.slice(
                0,
                MAX_DM_LENGTH
            )
        );
    }

    modal.addComponents(
        new ActionRowBuilder()
            .addComponents(input)
    );

    return modal;
}

function buildPaginationRows(page, totalRows) {
    const totalPages =
        Math.max(
            1,
            Math.ceil(totalRows / PAGE_SIZE)
        );

    return [
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`mineur_bans:${page - 1}`)
                    .setLabel('Precedent')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(page <= 0),
                new ButtonBuilder()
                    .setCustomId(`mineur_bans:${page + 1}`)
                    .setLabel('Suivant')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(page >= totalPages - 1)
            )
    ];
}

async function handleRole(interaction, subcommand) {
    const role =
        interaction.options.getRole('role');

    if (subcommand === 'add') {
        if (role.id === interaction.guild.id) {
            return safeReply(interaction, {
                content:
                    'Le role @everyone ne peut pas etre configure comme role mineur.',
                ephemeral: true
            });
        }

        await addMinorRole(
            interaction.guild.id,
            role.id
        );

        return safeReply(interaction, {
            content:
                `Role mineur ajoute : ${role}.`,
            ephemeral: true
        });
    }

    if (subcommand === 'remove') {
        const removed =
            await removeMinorRole(
                interaction.guild.id,
                role.id
            );

        return safeReply(interaction, {
            content: removed
                ? `Role mineur retire : ${role}.`
                : `Ce role n'etait pas configure : ${role}.`,
            ephemeral: true
        });
    }

    if (subcommand === 'list') {
        const rows =
            await listMinorRoles(interaction.guild.id);

        if (rows.length === 0) {
            return safeReply(interaction, {
                content:
                    'Aucun role mineur configure.',
                ephemeral: true
            });
        }

        const lines =
            rows.map(row => {
                const roleMention =
                    interaction.guild.roles.cache.has(row.role_id)
                        ? `<@&${row.role_id}>`
                        : `Role introuvable (${row.role_id})`;

                return `- ${roleMention}`;
            });

        return safeReply(interaction, {
            content:
                `Roles mineurs configures :\n${lines.join('\n')}`,
            ephemeral: true
        });
    }

    return null;
}

async function handleBanList(interaction) {
    const deferred =
        await safeDeferReply(interaction, {
            ephemeral: true
        });

    if (!deferred) return null;

    const rows =
        await listMinorBans(interaction.guild.id);

    return safeReply(interaction, {
        embeds: [
            buildBanListEmbed(
                rows,
                0,
                PAGE_SIZE
            )
        ],
        components:
            rows.length > PAGE_SIZE
                ? buildPaginationRows(0, rows.length)
                : []
    });
}

async function handleVerify(interaction) {
    const deferred =
        await safeDeferReply(interaction, {
            ephemeral: true
        });

    if (!deferred) return null;

    if (!await requireBotPermission(
        interaction,
        PermissionFlagsBits.BanMembers,
        'Ban Members'
    )) return null;

    const minorRoleIds =
        await getMinorRoleIds(interaction.guild.id);

    if (minorRoleIds.size === 0) {
        return safeReply(interaction, {
            content:
                'Aucun role mineur configure.'
        });
    }

    const members =
        await interaction.guild.members.fetch();

    let checked = 0;
    let banned = 0;
    const errors = [];

    for (const member of members.values()) {
        checked++;

        const triggerRole =
            member.roles.cache.find(role =>
                minorRoleIds.has(role.id)
            );

        if (!triggerRole) continue;

        const result =
            await executeMinorBan(
                member,
                triggerRole
            );

        if (result.success) {
            banned++;
            continue;
        }

        errors.push(
            `${member.user.tag} (${member.id}) : ${result.error || 'erreur inconnue'}`
        );
    }

    const errorLines =
        errors.length > 0
            ? `\n\nErreurs :\n${errors.slice(0, 10).join('\n')}${errors.length > 10 ? `\n... et ${errors.length - 10} autre(s).` : ''}`
            : '';

    return safeReply(interaction, {
        content:
`Verification terminee.

Membres verifies : ${checked}
Membres bannis : ${banned}
Erreurs : ${errors.length}${errorLines}`
    });
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mineur')
        .setDescription('Gerer les roles mineurs et les bans automatiques.')
        .addSubcommandGroup(group =>
            group
                .setName('role')
                .setDescription('Gerer les roles mineurs.')
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('add')
                        .setDescription('Ajouter un role mineur.')
                        .addRoleOption(option =>
                            option
                                .setName('role')
                                .setDescription('Role a interdire')
                                .setRequired(true)
                        )
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('remove')
                        .setDescription('Retirer un role mineur.')
                        .addRoleOption(option =>
                            option
                                .setName('role')
                                .setDescription('Role a retirer')
                                .setRequired(true)
                        )
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('list')
                        .setDescription('Lister les roles mineurs.')
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('msg')
                .setDescription('Definir le message MP envoye avant le ban.')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('msg-edit')
                .setDescription('Modifier le message MP envoye avant le ban.')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('Lister les membres bannis via ce systeme.')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('verif')
                .setDescription('Scanner les membres et bannir ceux avec un role mineur.')
        ),

    async execute(interaction) {
        try {
            const group =
                interaction.options.getSubcommandGroup(false);

            const subcommand =
                interaction.options.getSubcommand();

            if (!await memberCanManageMineur(interaction.member)) {
                return safeReply(interaction, {
                    content:
                        'Tu dois etre administrateur ou posseder le role staff configure pour utiliser cette commande.',
                    ephemeral: true
                });
            }

            if (group === 'role') {
                return handleRole(
                    interaction,
                    subcommand
                );
            }

            if (
                subcommand === 'msg' ||
                subcommand === 'msg-edit'
            ) {
                const currentMessage =
                    await getDmMessage(interaction.guild.id);

                return interaction.showModal(
                    buildMessageModal(
                        interaction,
                        currentMessage
                    )
                );
            }

            if (subcommand === 'list') {
                return handleBanList(interaction);
            }

            if (subcommand === 'verif') {
                return handleVerify(interaction);
            }

            return null;

        } catch (error) {
            console.error(
                'Erreur commande mineur :',
                error
            );

            return safeReply(interaction, {
                content:
                    'Impossible de traiter la commande mineur.',
                ephemeral: true
            });
        }
    }
};

module.exports.PAGE_SIZE = PAGE_SIZE;
module.exports.buildPaginationRows = buildPaginationRows;

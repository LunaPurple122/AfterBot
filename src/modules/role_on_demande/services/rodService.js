const {
    ActionRowBuilder,
    AttachmentBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    EmbedBuilder,
    PermissionFlagsBits,
    PermissionsBitField
} = require('discord.js');

const { pool } =
    require('../../../database/db');

const DEFAULT_REQUEST_MESSAGE =
`**Demande de nouveau role**

Salut !

Decris ici le role que tu aimerais voir ajoute au serveur.

Merci d'indiquer :
- le nom du role ;
- la categorie souhaitee ;
- pourquoi il serait utile ;
- toute information complementaire.

L'equipe sera prevenue des que tu auras envoye ta demande.`;

const DEFAULT_ALERT_MESSAGE =
`**Nouvelle demande de role**

Un membre vient de proposer un nouveau role.

Merci d'examiner la proposition et de determiner si elle merite d'etre ajoutee au Spatioport.`;

const DEFAULT_STAFF_MESSAGE =
`**Discussion staff**

Ce salon est reserve au traitement interne de la demande.

Vous pouvez y discuter de la pertinence du role propose, demander des precisions ou ouvrir un vocal avec le membre concerne.`;

const REQUIRED_BOT_PERMISSIONS = [
    PermissionFlagsBits.ManageChannels,
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.ReadMessageHistory,
    PermissionFlagsBits.AttachFiles,
    PermissionFlagsBits.Connect,
    PermissionFlagsBits.Speak
];

function cleanChannelName(value) {
    const normalized =
        String(value || 'membre')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9-]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .replace(/-{2,}/g, '-');

    return (normalized || 'membre').slice(0, 60);
}

function buildEmbed(title, description, color = 0x3BA55D) {
    return new EmbedBuilder()
        .setColor(color)
        .setTitle(title)
        .setDescription(description)
        .setFooter({
            text: 'Spatioport Altia'
        })
        .setTimestamp();
}

function formatDate(value) {
    if (!value) return 'Inconnue';

    return new Date(value).toLocaleString('fr-FR');
}

function hasRequiredBotPermissions(guild) {
    const botMember =
        guild?.members?.me;

    if (!botMember) return false;

    return REQUIRED_BOT_PERMISSIONS.every(permission =>
        botMember.permissions.has(permission)
    );
}

async function fetchOwner(guild) {
    try {
        return await guild.fetchOwner();
    } catch (error) {
        console.error(
            `Impossible de recuperer le proprietaire du serveur ${guild?.id} :`,
            error
        );

        return null;
    }
}

async function getConfig(guildId) {
    const result =
        await pool.query(`
            SELECT *
            FROM rod_config
            WHERE guild_id = $1
        `, [guildId]);

    return result.rows[0] || null;
}

async function saveConfig({
    guildId,
    triggerRoleId,
    categoryId,
    alertChannelId,
    archiveChannelId,
    alertMessage,
    requestMessage,
    staffMessage
}) {
    await pool.query(`
        INSERT INTO rod_config (
            guild_id,
            trigger_role_id,
            category_id,
            alert_channel_id,
            archive_channel_id,
            alert_message,
            request_message,
            staff_message
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (guild_id)
        DO UPDATE SET
            trigger_role_id = EXCLUDED.trigger_role_id,
            category_id = EXCLUDED.category_id,
            alert_channel_id = EXCLUDED.alert_channel_id,
            archive_channel_id = EXCLUDED.archive_channel_id,
            alert_message = COALESCE(EXCLUDED.alert_message, rod_config.alert_message),
            request_message = COALESCE(EXCLUDED.request_message, rod_config.request_message),
            staff_message = COALESCE(EXCLUDED.staff_message, rod_config.staff_message),
            updated_at = CURRENT_TIMESTAMP
    `, [
        guildId,
        triggerRoleId,
        categoryId,
        alertChannelId,
        archiveChannelId,
        alertMessage,
        requestMessage,
        staffMessage
    ]);
}

async function addPingRole(guildId, roleId) {
    await pool.query(`
        INSERT INTO rod_ping_roles (guild_id, role_id)
        VALUES ($1, $2)
        ON CONFLICT (guild_id, role_id) DO NOTHING
    `, [guildId, roleId]);
}

async function removePingRole(guildId, roleId) {
    const result =
        await pool.query(`
            DELETE FROM rod_ping_roles
            WHERE guild_id = $1
            AND role_id = $2
        `, [guildId, roleId]);

    return result.rowCount > 0;
}

async function listPingRoles(guildId) {
    const result =
        await pool.query(`
            SELECT role_id
            FROM rod_ping_roles
            WHERE guild_id = $1
            ORDER BY created_at ASC
        `, [guildId]);

    return result.rows;
}

async function getOpenRequestForMember(guildId, userId) {
    const result =
        await pool.query(`
            SELECT *
            FROM rod_requests
            WHERE guild_id = $1
            AND requester_user_id = $2
            AND status = 'open'
            LIMIT 1
        `, [guildId, userId]);

    return result.rows[0] || null;
}

async function getOpenRequestByChannel(guildId, channelId) {
    const result =
        await pool.query(`
            SELECT *
            FROM rod_requests
            WHERE guild_id = $1
            AND status = 'open'
            AND (
                request_channel_id = $2
                OR staff_channel_id = $2
                OR voice_channel_id = $2
            )
            LIMIT 1
        `, [guildId, channelId]);

    return result.rows[0] || null;
}

async function getRequestById(guildId, requestId) {
    const result =
        await pool.query(`
            SELECT *
            FROM rod_requests
            WHERE guild_id = $1
            AND id = $2
        `, [guildId, requestId]);

    return result.rows[0] || null;
}

async function listOpenRequests(guildId) {
    const result =
        await pool.query(`
            SELECT *
            FROM rod_requests
            WHERE guild_id = $1
            AND status = 'open'
            ORDER BY created_at ASC
        `, [guildId]);

    return result.rows;
}

async function listAccess(requestId) {
    const result =
        await pool.query(`
            SELECT *
            FROM rod_request_access
            WHERE request_id = $1
            ORDER BY created_at ASC
        `, [requestId]);

    return result.rows;
}

function mentionAccess(row) {
    if (row.target_type === 'role') {
        return `<@&${row.target_id}>`;
    }

    return `<@${row.target_id}>`;
}

async function fetchGuildChannel(guild, channelId) {
    if (!channelId) return null;

    return guild.channels.cache.get(channelId) ||
        await guild.channels.fetch(channelId).catch(() => null);
}

async function buildPermissionOverwrites({
    guild,
    requesterId,
    includeRequester,
    accessRows
}) {
    const owner =
        await fetchOwner(guild);

    const pingRoles =
        await listPingRoles(guild.id);

    const overwrites = [
        {
            id: guild.id,
            deny: [
                PermissionsBitField.Flags.ViewChannel
            ]
        },
        {
            id: guild.client.user.id,
            allow: [
                PermissionsBitField.Flags.ViewChannel,
                PermissionsBitField.Flags.SendMessages,
                PermissionsBitField.Flags.ReadMessageHistory,
                PermissionsBitField.Flags.ManageChannels,
                PermissionsBitField.Flags.Connect,
                PermissionsBitField.Flags.Speak
            ]
        }
    ];

    if (owner) {
        overwrites.push({
            id: owner.id,
            allow: [
                PermissionsBitField.Flags.ViewChannel,
                PermissionsBitField.Flags.SendMessages,
                PermissionsBitField.Flags.ReadMessageHistory,
                PermissionsBitField.Flags.Connect,
                PermissionsBitField.Flags.Speak
            ]
        });
    }

    if (includeRequester && requesterId) {
        overwrites.push({
            id: requesterId,
            allow: [
                PermissionsBitField.Flags.ViewChannel,
                PermissionsBitField.Flags.SendMessages,
                PermissionsBitField.Flags.ReadMessageHistory,
                PermissionsBitField.Flags.Connect,
                PermissionsBitField.Flags.Speak
            ]
        });
    }

    for (const row of pingRoles) {
        overwrites.push({
            id: row.role_id,
            allow: [
                PermissionsBitField.Flags.ViewChannel,
                PermissionsBitField.Flags.SendMessages,
                PermissionsBitField.Flags.ReadMessageHistory,
                PermissionsBitField.Flags.Connect,
                PermissionsBitField.Flags.Speak
            ]
        });
    }

    for (const row of accessRows || []) {
        overwrites.push({
            id: row.target_id,
            allow: [
                PermissionsBitField.Flags.ViewChannel,
                PermissionsBitField.Flags.SendMessages,
                PermissionsBitField.Flags.ReadMessageHistory,
                PermissionsBitField.Flags.Connect,
                PermissionsBitField.Flags.Speak
            ]
        });
    }

    return overwrites;
}

async function canManageRod(member, request = null) {
    if (!member?.guild) return false;

    if (member.id === member.guild.ownerId) return true;

    if (
        member.permissions.has(
            PermissionFlagsBits.Administrator
        )
    ) return true;

    const pingRoles =
        await listPingRoles(member.guild.id);

    if (
        pingRoles.some(row =>
            member.roles.cache.has(row.role_id)
        )
    ) return true;

    if (!request) return false;

    const accessRows =
        await listAccess(request.id);

    return accessRows.some(row =>
        row.target_type === 'user' &&
        row.target_id === member.id
    ) ||
        accessRows.some(row =>
            row.target_type === 'role' &&
            member.roles.cache.has(row.target_id)
        );
}

async function createRequestForMember(member, triggerRole) {
    const guild =
        member.guild;

    const config =
        await getConfig(guild.id);

    if (!config) return null;

    if (config.trigger_role_id !== triggerRole.id) {
        return null;
    }

    if (await getOpenRequestForMember(guild.id, member.id)) {
        return null;
    }

    if (!hasRequiredBotPermissions(guild)) {
        console.error(
            `Permissions bot insuffisantes pour creer une demande ROD sur ${guild.id}.`
        );
        return null;
    }

    const category =
        await fetchGuildChannel(guild, config.category_id);

    if (
        !category ||
        category.type !== ChannelType.GuildCategory
    ) {
        console.error(
            `Categorie ROD invalide pour ${guild.id}.`
        );
        return null;
    }

    const accessRows = [];
    const channelName =
        `demande-nouveau-role-de-${cleanChannelName(member.displayName || member.user.username)}`;

    const requestChannel =
        await guild.channels.create({
            name: channelName.slice(0, 100),
            type: ChannelType.GuildText,
            parent: category.id,
            permissionOverwrites:
                await buildPermissionOverwrites({
                    guild,
                    requesterId: member.id,
                    includeRequester: true,
                    accessRows
                })
        });

    const insertResult =
        await pool.query(`
            INSERT INTO rod_requests (
                guild_id,
                requester_user_id,
                trigger_role_id,
                request_channel_id
            )
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `, [
            guild.id,
            member.id,
            triggerRole.id,
            requestChannel.id
        ]);

    const request =
        insertResult.rows[0];

    await requestChannel.send({
        content: `${member}`,
        embeds: [
            buildEmbed(
                'Demande de nouveau role',
                config.request_message || DEFAULT_REQUEST_MESSAGE,
                0x57F287
            )
        ]
    }).catch(error => {
        console.error(
            `Impossible d'envoyer le message ROD initial ${request.id} :`,
            error
        );
    });

    return request;
}

function buildAlertComponents(request, requestChannel) {
    return [
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setLabel('Rejoindre la demande')
                    .setStyle(ButtonStyle.Link)
                    .setURL(requestChannel.url),
                new ButtonBuilder()
                    .setCustomId(`rod_staff:${request.id}`)
                    .setLabel('Creer un salon staff')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId(`rod_close:${request.id}`)
                    .setLabel('Cloturer la demande')
                    .setStyle(ButtonStyle.Danger)
            )
    ];
}

async function markFirstMessageAndAlert(message, request) {
    const config =
        await getConfig(message.guild.id);

    if (!config || request.first_message_received) {
        return;
    }

    const updateResult =
        await pool.query(`
            UPDATE rod_requests
            SET first_message_received = true,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
            AND first_message_received = false
            RETURNING *
        `, [request.id]);

    if (updateResult.rows.length === 0) return;

    const updatedRequest =
        updateResult.rows[0];

    const owner =
        await fetchOwner(message.guild);

    if (owner) {
        owner.send({
            embeds: [
                buildEmbed(
                    'Nouvelle demande de role',
                    `Une demande ROD a demarre sur ${message.guild.name}.\n\nDemande: ${message.channel}\nMembre: ${message.author}`,
                    0x5865F2
                )
            ]
        }).catch(error => {
            console.error(
                `Impossible d'envoyer le MP ROD au proprietaire ${owner.id} :`,
                error
            );
        });
    }

    const alertChannel =
        await fetchGuildChannel(message.guild, config.alert_channel_id);

    if (!alertChannel?.isTextBased()) return;

    const pingRoles =
        await listPingRoles(message.guild.id);

    const content =
        pingRoles.map(row => `<@&${row.role_id}>`).join(' ');

    const alert =
        await alertChannel.send({
            content: content || null,
            embeds: [
                buildEmbed(
                    'Nouvelle demande de role',
                    `${config.alert_message || DEFAULT_ALERT_MESSAGE}\n\nMembre: ${message.author}\nSalon: ${message.channel}\nDemande ID: \`${request.id}\``,
                    0x5865F2
                )
            ],
            components:
                buildAlertComponents(
                    updatedRequest,
                    message.channel
                ),
            allowedMentions: {
                roles: pingRoles.map(row => row.role_id)
            }
        });

    await pool.query(`
        UPDATE rod_requests
        SET alert_message_id = $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
    `, [alert.id, request.id]);
}

async function createStaffChannel(guild, request) {
    if (request.staff_channel_id) {
        const existing =
            await fetchGuildChannel(
                guild,
                request.staff_channel_id
            );

        if (existing) return existing;
    }

    const config =
        await getConfig(guild.id);

    if (!config) return null;

    const category =
        await fetchGuildChannel(guild, config.category_id);

    if (!category) return null;

    const requester =
        await guild.members.fetch(request.requester_user_id)
            .catch(() => null);

    const accessRows =
        await listAccess(request.id);

    const staffChannel =
        await guild.channels.create({
            name:
                `staff-demande-${cleanChannelName(requester?.displayName || request.requester_user_id)}`.slice(0, 100),
            type: ChannelType.GuildText,
            parent: category.id,
            permissionOverwrites:
                await buildPermissionOverwrites({
                    guild,
                    requesterId: request.requester_user_id,
                    includeRequester: false,
                    accessRows
                })
        });

    await pool.query(`
        UPDATE rod_requests
        SET staff_channel_id = $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
    `, [staffChannel.id, request.id]);

    await staffChannel.send({
        embeds: [
            buildEmbed(
                'Discussion staff',
                config.staff_message || DEFAULT_STAFF_MESSAGE,
                0xFEE75C
            )
        ],
        components: [
            new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`rod_voice:${request.id}`)
                        .setLabel('Ouvrir un vocal pour cette demande')
                        .setStyle(ButtonStyle.Primary)
                )
        ]
    });

    return staffChannel;
}

async function createVoiceChannel(guild, request) {
    if (request.voice_channel_id) {
        const existing =
            await fetchGuildChannel(
                guild,
                request.voice_channel_id
            );

        if (existing) return existing;
    }

    const config =
        await getConfig(guild.id);

    if (!config) return null;

    const category =
        await fetchGuildChannel(guild, config.category_id);

    if (!category) return null;

    const requester =
        await guild.members.fetch(request.requester_user_id)
            .catch(() => null);

    const accessRows =
        await listAccess(request.id);

    const voiceChannel =
        await guild.channels.create({
            name:
                `Vocal - ${cleanChannelName(requester?.displayName || request.requester_user_id)}`.slice(0, 100),
            type: ChannelType.GuildVoice,
            parent: category.id,
            permissionOverwrites:
                await buildPermissionOverwrites({
                    guild,
                    requesterId: request.requester_user_id,
                    includeRequester: true,
                    accessRows
                })
        });

    await pool.query(`
        UPDATE rod_requests
        SET voice_channel_id = $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
    `, [voiceChannel.id, request.id]);

    return voiceChannel;
}

async function fetchMessagesForTranscript(channel) {
    if (!channel?.isTextBased()) return [];

    const messages = [];
    let before;

    while (true) {
        const fetched =
            await channel.messages.fetch({
                limit: 100,
                before
            }).catch(error => {
                console.error(
                    `Impossible de recuperer les messages du salon ${channel.id} :`,
                    error
                );
                return null;
            });

        if (!fetched || fetched.size === 0) break;

        messages.push(...fetched.values());
        before = fetched.last().id;
    }

    return messages.reverse();
}

async function removeTriggerRoleFromRequester(guild, request) {
    const role =
        guild.roles.cache.get(request.trigger_role_id) ||
        await guild.roles.fetch(request.trigger_role_id)
            .catch(() => null);

    const roleResult = {
        success: false,
        removed: false,
        roleName: role?.name || 'Role introuvable',
        roleId: request.trigger_role_id,
        reason: null
    };

    if (!role) {
        roleResult.reason =
            'Role declencheur introuvable.';

        console.error(
            `ROD ${request.id}: role declencheur introuvable (${request.trigger_role_id}).`
        );

        return roleResult;
    }

    const member =
        await guild.members.fetch(request.requester_user_id)
            .catch(error => {
                console.error(
                    `ROD ${request.id}: impossible de recuperer le demandeur ${request.requester_user_id} :`,
                    error
                );

                return null;
            });

    if (!member) {
        roleResult.reason =
            'Membre demandeur introuvable.';

        return roleResult;
    }

    if (!member.roles.cache.has(role.id)) {
        roleResult.success = true;
        roleResult.reason =
            'Le membre ne possedait plus le role declencheur.';

        return roleResult;
    }

    const botMember =
        guild.members.me ||
        await guild.members.fetchMe()
            .catch(error => {
                console.error(
                    `ROD ${request.id}: impossible de recuperer le membre bot :`,
                    error
                );

                return null;
            });

    if (!botMember) {
        roleResult.reason =
            'Membre bot introuvable.';

        return roleResult;
    }

    if (
        !botMember.permissions.has(
            PermissionFlagsBits.ManageRoles
        )
    ) {
        roleResult.reason =
            'Permission ManageRoles manquante.';

        console.error(
            `ROD ${request.id}: permission ManageRoles manquante pour retirer ${role.id}.`
        );

        return roleResult;
    }

    if (role.position >= botMember.roles.highest.position) {
        roleResult.reason =
            'Role du bot trop bas dans la hierarchie Discord.';

        console.error(
            `ROD ${request.id}: role bot trop bas pour retirer ${role.name} (${role.id}).`
        );

        return roleResult;
    }

    try {
        await member.roles.remove(
            role,
            `Cloture demande role_on_demande ${request.id}`
        );

        roleResult.success = true;
        roleResult.removed = true;

        return roleResult;

    } catch (error) {
        roleResult.reason =
            error.message || 'Erreur Discord inconnue.';

        console.error(
            `ROD ${request.id}: impossible de retirer le role declencheur ${role.id} a ${member.id} :`,
            error
        );

        return roleResult;
    }
}

function renderMessage(message) {
    const date =
        new Date(message.createdTimestamp)
            .toLocaleString('fr-FR');

    const attachments =
        message.attachments.size > 0
            ? `\nPieces jointes: ${message.attachments.map(file => file.url).join(', ')}`
            : '';

    const embeds =
        message.embeds.length > 0
            ? `\nEmbeds: ${message.embeds.length}`
            : '';

    return `[${date}] ${message.author.tag} (${message.author.id})
${message.content || '[Message sans texte]'}${attachments}${embeds}`;
}

async function buildTranscript({
    guild,
    request,
    reason,
    closedBy,
    status,
    triggerRoleRemoval
}) {
    const requester =
        await guild.members.fetch(request.requester_user_id)
            .catch(() => null);

    const accessRows =
        await listAccess(request.id);

    const requestChannel =
        await fetchGuildChannel(
            guild,
            request.request_channel_id
        );

    const staffChannel =
        await fetchGuildChannel(
            guild,
            request.staff_channel_id
        );

    const voiceChannel =
        await fetchGuildChannel(
            guild,
            request.voice_channel_id
        );

    const requestMessages =
        await fetchMessagesForTranscript(requestChannel);

    const staffMessages =
        await fetchMessagesForTranscript(staffChannel);

    return `ROLE ON DEMANDE - TRANSCRIPT
==============================

ID de la demande: ${request.id}
Statut final: ${status}
Membre: ${requester?.user?.tag || 'Introuvable'}
ID membre: ${request.requester_user_id}
Date de creation: ${formatDate(request.created_at)}
Date de cloture: ${formatDate(new Date())}
Utilisateur ayant cloture: ${closedBy.tag} (${closedBy.id})
Raison de cloture: ${reason || 'Aucune raison indiquee'}

Participants ajoutes:
${accessRows.length > 0 ? accessRows.map(row => `- ${row.target_type}: ${row.target_id}`).join('\n') : '- Aucun'}

Salons crees:
- demande: ${requestChannel ? `${requestChannel.name} (${requestChannel.id})` : request.request_channel_id || 'Aucun'}
- staff: ${staffChannel ? `${staffChannel.name} (${staffChannel.id})` : request.staff_channel_id || 'Aucun'}
- vocal: ${voiceChannel ? `${voiceChannel.name} (${voiceChannel.id})` : request.voice_channel_id || 'Aucun'}

Gestion du role declencheur
- Role declencheur : ${triggerRoleRemoval?.roleName || 'Inconnu'} (${triggerRoleRemoval?.roleId || request.trigger_role_id})
- Retrait effectue : ${triggerRoleRemoval?.removed ? 'oui' : 'non'}
- Raison si echec : ${triggerRoleRemoval?.removed ? 'Aucune' : (triggerRoleRemoval?.reason || 'Non renseignee')}

MESSAGES DE LA DEMANDE
==============================
${requestMessages.length > 0 ? requestMessages.map(renderMessage).join('\n\n---\n\n') : 'Aucun message recupere.'}

MESSAGES DU SALON STAFF
==============================
${staffMessages.length > 0 ? staffMessages.map(renderMessage).join('\n\n---\n\n') : 'Aucun message staff recupere.'}
`;
}

async function archiveTranscript({
    guild,
    request,
    reason,
    closedBy,
    status,
    triggerRoleRemoval
}) {
    const config =
        await getConfig(guild.id);

    if (!config) return false;

    const archiveChannel =
        await fetchGuildChannel(guild, config.archive_channel_id);

    if (!archiveChannel?.isTextBased()) return false;

    const transcript =
        await buildTranscript({
            guild,
            request,
            reason,
            closedBy,
            status,
            triggerRoleRemoval
        });

    const file =
        new AttachmentBuilder(
            Buffer.from(transcript, 'utf-8'),
            {
                name: `rod-demande-${request.id}.txt`
            }
        );

    await archiveChannel.send({
        embeds: [
            buildEmbed(
                status === 'deleted'
                    ? 'Demande supprimee manuellement'
                    : 'Demande cloturee',
                `Demande ID: \`${request.id}\`\nMembre: <@${request.requester_user_id}>\nPar: ${closedBy}\nRaison: ${reason || 'Aucune raison indiquee'}`,
                status === 'deleted' ? 0xED4245 : 0x57F287
            )
        ],
        files: [file]
    });

    return true;
}

async function deleteCreatedChannels(guild, request) {
    for (const channelId of [
        request.request_channel_id,
        request.staff_channel_id,
        request.voice_channel_id
    ]) {
        const channel =
            await fetchGuildChannel(guild, channelId);

        if (!channel) continue;

        await channel.delete('Nettoyage demande role_on_demande')
            .catch(error => {
                console.error(
                    `Impossible de supprimer le salon ROD ${channel.id} :`,
                    error
                );
            });
    }
}

async function closeRequest({
    guild,
    request,
    reason,
    closedBy,
    status = 'closed'
}) {
    const triggerRoleRemoval =
        await removeTriggerRoleFromRequester(
            guild,
            request
        );

    await archiveTranscript({
        guild,
        request,
        reason,
        closedBy,
        status,
        triggerRoleRemoval
    }).catch(error => {
        console.error(
            `ROD ${request.id}: impossible d'archiver le transcript :`,
            error
        );
    });

    await pool.query(`
        UPDATE rod_requests
        SET status = $1,
            close_reason = $2,
            closed_by = $3,
            closed_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $4
    `, [
        status,
        reason,
        closedBy.id,
        request.id
    ]);

    await deleteCreatedChannels(guild, request);
}

async function applyAccessToChannels(guild, request) {
    const accessRows =
        await listAccess(request.id);

    const channels = [
        {
            id: request.request_channel_id,
            includeRequester: true
        },
        {
            id: request.staff_channel_id,
            includeRequester: false
        },
        {
            id: request.voice_channel_id,
            includeRequester: true
        }
    ];

    for (const item of channels) {
        const channel =
            await fetchGuildChannel(guild, item.id);

        if (!channel) continue;

        await channel.permissionOverwrites.set(
            await buildPermissionOverwrites({
                guild,
                requesterId: request.requester_user_id,
                includeRequester: item.includeRequester,
                accessRows
            })
        ).catch(error => {
            console.error(
                `Impossible de mettre a jour les permissions ROD ${channel.id} :`,
                error
            );
        });
    }
}

async function addAccess({
    guild,
    request,
    targetType,
    targetId,
    addedBy
}) {
    await pool.query(`
        INSERT INTO rod_request_access (
            request_id,
            target_type,
            target_id,
            added_by
        )
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (request_id, target_type, target_id)
        DO NOTHING
    `, [
        request.id,
        targetType,
        targetId,
        addedBy.id
    ]);

    await applyAccessToChannels(guild, request);
}

async function removeAccess({
    guild,
    request,
    targetType,
    targetId
}) {
    await pool.query(`
        DELETE FROM rod_request_access
        WHERE request_id = $1
        AND target_type = $2
        AND target_id = $3
    `, [
        request.id,
        targetType,
        targetId
    ]);

    await applyAccessToChannels(guild, request);
}

module.exports = {
    DEFAULT_ALERT_MESSAGE,
    DEFAULT_REQUEST_MESSAGE,
    DEFAULT_STAFF_MESSAGE,
    addAccess,
    addPingRole,
    archiveTranscript,
    buildEmbed,
    canManageRod,
    closeRequest,
    createRequestForMember,
    createStaffChannel,
    createVoiceChannel,
    fetchGuildChannel,
    formatDate,
    getConfig,
    getOpenRequestByChannel,
    getOpenRequestForMember,
    getRequestById,
    hasRequiredBotPermissions,
    listAccess,
    listOpenRequests,
    listPingRoles,
    markFirstMessageAndAlert,
    mentionAccess,
    removeAccess,
    removePingRole,
    removeTriggerRoleFromRequester,
    saveConfig
};

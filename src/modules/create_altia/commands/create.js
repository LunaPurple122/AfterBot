const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    MessageFlags,
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
} = require('../services/createAltiaService');

const CUSTOM_ID_PREFIX = 'create_altia_gpt:';
const NUKE_BUTTON_PREFIX = 'create_altia_nuke_button:';
const NUKE_MODAL_PREFIX = 'create_altia_nuke_modal:';
const NUKE_CONFIRM_TEXT = 'NUKE SPATIOPORT ALTIA';
const MAX_IMPORT_BYTES = 1024 * 512;

function buildGptModal(userId) {
    return new ModalBuilder()
        .setCustomId(`${CUSTOM_ID_PREFIX}${userId}:${Date.now()}`)
        .setTitle('Create Altia - JSON GPT')
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('json_content')
                    .setLabel('JSON de configuration')
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(true)
                    .setMaxLength(4000)
            )
        );
}

function botCanApply(interaction) {
    const botMember =
        interaction.guild?.members?.me;

    if (!botMember) {
        return 'Membre bot introuvable dans ce serveur.';
    }

    const missing = [];

    if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
        missing.push('ManageRoles');
    }

    if (!botMember.permissions.has(PermissionFlagsBits.ManageChannels)) {
        missing.push('ManageChannels');
    }

    if (missing.length > 0) {
        return `Permissions bot manquantes : ${missing.join(', ')}.`;
    }

    return null;
}

function buildNukeConfirmPayload(userId) {
    const embed =
        new EmbedBuilder()
            .setColor(0xED4245)
            .setTitle('⚠️ ATTENTION')
            .setDescription([
                'Cette action va supprimer la quasi-totalité du contenu du serveur.',
                '',
                'Éléments concernés :',
                '- salons texte',
                '- salons vocaux',
                '- catégories',
                '- rôles',
                '',
                'Cette opération est irréversible.',
                '',
                'Pour confirmer, cliquez sur le bouton :',
                '',
                '🧨 CONFIRMER LE RESET'
            ].join('\n'));

    const row =
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`${NUKE_BUTTON_PREFIX}${userId}:${Date.now()}`)
                .setLabel('🧨 CONFIRMER LE RESET')
                .setStyle(ButtonStyle.Danger)
        );

    return {
        embeds:
            [embed],
        components:
            [row],
        flags:
            MessageFlags.Ephemeral
    };
}

async function readAttachmentJson(attachment) {
    if (!attachment) {
        return {
            error:
                'Fichier JSON requis.'
        };
    }

    if (
        attachment.size &&
        attachment.size > MAX_IMPORT_BYTES
    ) {
        return {
            error:
                'Le fichier JSON depasse 512 Ko.'
        };
    }

    if (
        attachment.name &&
        !attachment.name.toLowerCase().endsWith('.json')
    ) {
        return {
            error:
                'Le fichier doit avoir une extension .json.'
        };
    }

    const response =
        await fetch(attachment.url);

    if (!response.ok) {
        return {
            error:
                `Telechargement impossible : HTTP ${response.status}`
        };
    }

    return {
        value:
            await response.text()
    };
}

async function importProject({
    interaction,
    sourceType,
    rawContent
}) {
    const parsed =
        parseJsonContent(rawContent);

    if (parsed.error) {
        return safeReply(interaction, {
            content:
                `Erreur JSON : ${parsed.error}`,
            flags:
                MessageFlags.Ephemeral
        });
    }

    const validation =
        validateProject(parsed.value);

    if (!validation.ok) {
        return safeReply(interaction, {
            content:
                truncate(
                    `Configuration refusee :\n${validation.errors.join('\n')}`
                ),
            flags:
                MessageFlags.Ephemeral
        });
    }

    const preview =
        buildPreview(
            interaction.guild,
            validation.project
        );

    if (preview.errors.length > 0) {
        return safeReply(interaction, {
            content:
                truncate(
                    `Configuration refusee :\n${preview.errors.join('\n')}`
                ),
            flags:
                MessageFlags.Ephemeral
        });
    }

    const importRow =
        await storeImport({
            guildId:
                interaction.guild.id,
            ownerId:
                interaction.user.id,
            sourceType,
            project:
                validation.project
        });

    return safeReply(interaction, {
        content:
            truncate(
                `Projet Create Altia importe (#${importRow.id}).\nMode : ${importRow.mode}\nSource : ${sourceType}\n\n${formatPreview(preview, 'Apercu rapide')}`
            ),
        flags:
            MessageFlags.Ephemeral
    });
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('create')
        .setDescription('Create Altia: configuration automatique du serveur.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('import')
                .setDescription('Importer un fichier JSON Create Altia.')
                .addAttachmentOption(option =>
                    option
                        .setName('fichier')
                        .setDescription('Fichier JSON a importer')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('gpt')
                .setDescription('Coller un JSON genere par IA dans un modal.')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('preview')
                .setDescription('Afficher ce qui sera cree, modifie ou ignore.')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('apply')
                .setDescription('Appliquer le dernier projet valide.')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('rollback')
                .setDescription('Annuler les objets crees par le dernier apply.')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('history')
                .setDescription('Afficher les derniers projets Create Altia.')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('status')
                .setDescription('Afficher le dernier projet charge et son etat.')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('nuke')
                .setDescription('Reset securise du serveur de test.')
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const ownerCheck =
            ensureGuildOwner(interaction);

        if (!ownerCheck.ok) {
            return safeReply(interaction, {
                content:
                    ownerCheck.message,
                flags:
                    MessageFlags.Ephemeral
            });
        }

        const subcommand =
            interaction.options.getSubcommand();

        if (subcommand === 'gpt') {
            return interaction.showModal(
                buildGptModal(interaction.user.id)
            );
        }

        if (subcommand === 'nuke') {
            return safeReply(
                interaction,
                buildNukeConfirmPayload(interaction.user.id)
            );
        }

        await safeDeferReply(interaction, {
            flags:
                MessageFlags.Ephemeral
        });

        if (subcommand === 'import') {
            const attachment =
                interaction.options.getAttachment('fichier');

            const raw =
                await readAttachmentJson(attachment);

            if (raw.error) {
                return safeReply(interaction, {
                    content:
                        raw.error,
                    flags:
                        MessageFlags.Ephemeral
                });
            }

            return importProject({
                interaction,
                sourceType:
                    'file',
                rawContent:
                    raw.value
            });
        }

        if (subcommand === 'preview') {
            const latest =
                await getLatestImport(interaction.guild.id);

            if (!latest) {
                return safeReply(interaction, {
                    content:
                        'Aucun projet Create Altia charge.',
                    flags:
                        MessageFlags.Ephemeral
                });
            }

            const preview =
                buildPreview(
                    interaction.guild,
                    latest.json_content
                );

            return safeReply(interaction, {
                content:
                    formatPreview(
                        preview,
                        `Preview import #${latest.id} (${latest.mode})`
                    ),
                flags:
                    MessageFlags.Ephemeral
            });
        }

        if (subcommand === 'apply') {
            const permissionError =
                botCanApply(interaction);

            if (permissionError) {
                return safeReply(interaction, {
                    content:
                        permissionError,
                    flags:
                        MessageFlags.Ephemeral
                });
            }

            const latest =
                await getLatestImport(interaction.guild.id);

            if (!latest) {
                return safeReply(interaction, {
                    content:
                        'Aucun projet Create Altia charge.',
                    flags:
                        MessageFlags.Ephemeral
                });
            }

            let result;

            try {
                result =
                    await applyProject(
                        interaction.guild,
                        latest,
                        interaction.user
                    );
            } catch (error) {
                console.error(
                    `Erreur Create Altia apply import #${latest.id}:`,
                    error
                );

                return safeReply(interaction, {
                    content:
                        truncate(
                            `Apply interrompu : ${error.message || error}`
                        ),
                    flags:
                        MessageFlags.Ephemeral
                });
            }

            return safeReply(interaction, {
                content:
                    result.ok
                        ? result.message
                        : `Apply refuse :\n${truncate(result.message)}`,
                flags:
                    MessageFlags.Ephemeral
            });
        }

        if (subcommand === 'rollback') {
            const permissionError =
                botCanApply(interaction);

            if (permissionError) {
                return safeReply(interaction, {
                    content:
                        permissionError,
                    flags:
                        MessageFlags.Ephemeral
                });
            }

            let result;

            try {
                result =
                    await rollbackLatest(interaction.guild);
            } catch (error) {
                console.error(
                    'Erreur Create Altia rollback:',
                    error
                );

                return safeReply(interaction, {
                    content:
                        truncate(
                            `Rollback interrompu : ${error.message || error}`
                        ),
                    flags:
                        MessageFlags.Ephemeral
                });
            }

            return safeReply(interaction, {
                content:
                    result.message,
                flags:
                    MessageFlags.Ephemeral
            });
        }

        if (subcommand === 'history') {
            const rows =
                await fetchHistory(interaction.guild.id);

            if (rows.length === 0) {
                return safeReply(interaction, {
                    content:
                        'Aucun historique Create Altia.',
                    flags:
                        MessageFlags.Ephemeral
                });
            }

            const lines =
                rows.map(row =>
                    `#${row.id} | ${row.mode} | ${row.source_type} | ${row.applied ? `applique ${row.applied_at?.toISOString?.() || row.applied_at}` : 'non applique'}`
                );

            return safeReply(interaction, {
                content:
                    truncate(`Historique Create Altia:\n${lines.join('\n')}`),
                flags:
                    MessageFlags.Ephemeral
            });
        }

        if (subcommand === 'status') {
            const latest =
                await getLatestImport(interaction.guild.id);

            if (!latest) {
                return safeReply(interaction, {
                    content:
                        'Aucun projet Create Altia charge.',
                    flags:
                        MessageFlags.Ephemeral
                });
            }

            return safeReply(interaction, {
                content:
                    truncate(
                        `Dernier projet Create Altia\nImport : #${latest.id}\nMode : ${latest.mode}\nSource : ${latest.source_type}\nApplique : ${latest.applied ? 'oui' : 'non'}\nImporte le : ${latest.imported_at?.toISOString?.() || latest.imported_at}\nApplique le : ${latest.applied_at?.toISOString?.() || latest.applied_at || 'jamais'}`
                    ),
                flags:
                    MessageFlags.Ephemeral
                });
        }

        return safeReply(interaction, {
            content:
                'Sous-commande inconnue.',
            flags:
                MessageFlags.Ephemeral
        });
    },

    CUSTOM_ID_PREFIX,
    NUKE_BUTTON_PREFIX,
    NUKE_CONFIRM_TEXT,
    NUKE_MODAL_PREFIX,
    importProject
};

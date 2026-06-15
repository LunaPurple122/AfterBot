const {
    ActionRowBuilder,
    MessageFlags,
    ModalBuilder,
    PermissionFlagsBits,
    SlashCommandBuilder,
    TextInputBuilder,
    TextInputStyle
} = require('discord.js');

const { envoyerLog } =
    require('../../../../core/logger');

const {
    requireBotPermission
} = require('../../../../core/permissions');

const {
    DEFAULT_BAN_DM,
    buildBanDmEmbed,
    getBanDmConfig
} = require('../../services/banDmService');

const BAN_DM_MODAL_PREFIX =
    'ban_dm_config:';

function buildBanDmModal(userId, config) {
    const customId =
        `${BAN_DM_MODAL_PREFIX}${userId}:${Date.now()}`;

    return new ModalBuilder()
        .setCustomId(customId)
        .setTitle('Message MP de ban')
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('title')
                    .setLabel('Titre')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
                    .setMaxLength(256)
                    .setValue(config.title || DEFAULT_BAN_DM.title)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('description')
                    .setLabel('Message')
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(true)
                    .setMaxLength(4000)
                    .setValue(
                        config.description ||
                        DEFAULT_BAN_DM.description
                    )
            )
        );
}

async function executeBanUser(interaction) {
    const membre =
        interaction.options.getMember('membre');

    const user =
        interaction.options.getUser('membre');

    const raison =
        interaction.options.getString('raison') ||
        'Aucune raison fournie';

    if (!await requireBotPermission(
        interaction,
        PermissionFlagsBits.BanMembers,
        'BanMembers'
    )) return;

    if (!user) {
        return interaction.reply({
            content:
                'Utilisateur introuvable.',
            flags:
                MessageFlags.Ephemeral
        });
    }

    if (user.id === interaction.user.id) {
        return interaction.reply({
            content:
                'Tu ne peux pas te bannir toi-même.',
            flags:
                MessageFlags.Ephemeral
        });
    }

    if (user.id === interaction.guild.ownerId) {
        return interaction.reply({
            content:
                'Impossible de bannir le propriétaire du serveur.',
            flags:
                MessageFlags.Ephemeral
        });
    }

    if (membre) {
        if (
            membre.roles.highest.position >=
            interaction.member.roles.highest.position &&
            interaction.guild.ownerId !== interaction.user.id
        ) {
            return interaction.reply({
                content:
                    'Ce membre possède un rôle supérieur ou égal au tien.',
                flags:
                    MessageFlags.Ephemeral
            });
        }

        if (
            membre.roles.highest.position >=
            interaction.guild.members.me.roles.highest.position
        ) {
            return interaction.reply({
                content:
                    'Mon rôle est trop bas pour bannir ce membre.',
                flags:
                    MessageFlags.Ephemeral
            });
        }

        try {
            const embed =
                await buildBanDmEmbed({
                    guild:
                        interaction.guild,
                    user,
                    moderator:
                        interaction.user,
                    reason:
                        raison
                });

            await membre.send({
                embeds:
                    [embed]
            });

        } catch (error) {
            console.error(
                `Impossible d'envoyer le DM de ban à ${membre.id} :`,
                error
            );
        }
    }

    try {
        await interaction.guild.bans.create(
            user.id,
            {
                reason:
                    `${raison} | Modérateur : ${interaction.user.tag}`
            }
        );

    } catch (error) {
        console.error(error);

        return interaction.reply({
            content:
                'Impossible de bannir cet utilisateur.',
            flags:
                MessageFlags.Ephemeral
        });
    }

    await interaction.reply({
        content:
            `${user.tag} a été banni.\n\nRaison :\n${raison}`
    });

    await envoyerLog(
        interaction.client,
        interaction.guild.id,
        {
            type:
                'punisher',
            titre:
                'Bannissement',
            description:
                [
                    'Utilisateur :',
                    `${user}`,
                    '',
                    'ID :',
                    user.id,
                    '',
                    'Modérateur :',
                    `${interaction.user}`,
                    '',
                    'Raison :',
                    raison
                ].join('\n'),
            couleur:
                0xED4245,
            auteur:
                user
        }
    );
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Bannir un membre ou configurer le MP de ban.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('user')
                .setDescription('Bannir un membre ou un utilisateur par ID.')
                .addUserOption(option =>
                    option
                        .setName('membre')
                        .setDescription('Membre ou utilisateur à bannir')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName('raison')
                        .setDescription('Raison du ban')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('msg')
                .setDescription('Modifier le MP envoyé avant un ban.')
        )
        .setDefaultMemberPermissions(
            PermissionFlagsBits.BanMembers
        ),

    async execute(interaction) {
        const subcommand =
            interaction.options.getSubcommand();

        if (subcommand === 'msg') {
            if (!interaction.memberPermissions?.has(
                PermissionFlagsBits.Administrator
            )) {
                return interaction.reply({
                    content:
                        'Permission requise : Administrateur.',
                    flags:
                        MessageFlags.Ephemeral
                });
            }

            const config =
                await getBanDmConfig(interaction.guild.id);

            return interaction.showModal(
                buildBanDmModal(
                    interaction.user.id,
                    config
                )
            );
        }

        if (subcommand === 'user') {
            return executeBanUser(interaction);
        }

        return interaction.reply({
            content:
                'Sous-commande inconnue.',
            flags:
                MessageFlags.Ephemeral
        });
    },

    BAN_DM_MODAL_PREFIX
};

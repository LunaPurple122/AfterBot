const {
    PermissionFlagsBits,
    SlashCommandBuilder
} = require('discord.js');

const {
    addStatsAdminRole,
    isGuildAdmin,
    listStatsAdminRoles,
    removeStatsAdminRole
} = require('../services/statsPermissionService');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stats-role')
        .setDescription('Gérer les rôles autorisés à modifier les stats.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Autoriser un rôle.')
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
        .setDefaultMemberPermissions(
            PermissionFlagsBits.Administrator
        ),

    async execute(interaction) {
        if (!interaction.guild) {
            return interaction.reply({
                content: '❌ Cette commande doit être utilisée sur un serveur.',
                ephemeral: true
            });
        }

        if (!isGuildAdmin(interaction.member)) {
            return interaction.reply({
                content:
                    '❌ Seuls les administrateurs peuvent gérer les rôles stats.',
                ephemeral: true
            });
        }

        const subcommand =
            interaction.options.getSubcommand();

        if (subcommand === 'add') {
            const role =
                interaction.options.getRole('role');

            await addStatsAdminRole(
                interaction.guild.id,
                role.id
            );

            return interaction.reply({
                content:
                    `✅ ${role} peut maintenant modifier les statistiques.`,
                ephemeral: true
            });
        }

        if (subcommand === 'remove') {
            const role =
                interaction.options.getRole('role');

            await removeStatsAdminRole(
                interaction.guild.id,
                role.id
            );

            return interaction.reply({
                content:
                    `✅ ${role} ne peut plus modifier les statistiques.`,
                ephemeral: true
            });
        }

        const roles =
            await listStatsAdminRoles(
                interaction.guild.id
            );

        const content =
            roles.length > 0
                ? roles.map(row => `<@&${row.role_id}>`).join('\n')
                : 'Aucun rôle stats configuré.';

        return interaction.reply({
            content:
                `Rôles autorisés à modifier les statistiques:\n${content}`,
            ephemeral: true
        });
    }
};

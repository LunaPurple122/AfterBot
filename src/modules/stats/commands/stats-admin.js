const {
    SlashCommandBuilder
} = require('discord.js');

const {
    formatDuration,
    parseDuration
} = require('../services/durationService');

const {
    canManageStats
} = require('../services/statsPermissionService');

const {
    adjustMessageCount,
    adjustVoiceSeconds,
    setMessageCount,
    setVoiceSeconds
} = require('../services/statsService');

function addMemberOption(subcommand) {
    return subcommand
        .addUserOption(option =>
            option
                .setName('membre')
                .setDescription('Membre ciblé')
                .setRequired(true)
        );
}

function addDurationOption(subcommand) {
    return addMemberOption(subcommand)
        .addStringOption(option =>
            option
                .setName('duree')
                .setDescription('Durée au format hh:mm, ex: 27:15')
                .setRequired(true)
        );
}

function addCountOption(subcommand) {
    return addMemberOption(subcommand)
        .addIntegerOption(option =>
            option
                .setName('nombre')
                .setDescription('Nombre de messages')
                .setRequired(true)
                .setMinValue(0)
        );
}

async function rejectUnauthorized(interaction) {
    return interaction.reply({
        content:
            '❌ Vous n’êtes pas autorisé à modifier les statistiques.',
        ephemeral: true
    });
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stats-admin')
        .setDescription('Modifier manuellement les statistiques.')
        .addSubcommand(subcommand =>
            addDurationOption(
                subcommand
                    .setName('add_voctime')
                    .setDescription('Ajouter du temps vocal.')
            )
        )
        .addSubcommand(subcommand =>
            addDurationOption(
                subcommand
                    .setName('remove_voctime')
                    .setDescription('Retirer du temps vocal.')
            )
        )
        .addSubcommand(subcommand =>
            addDurationOption(
                subcommand
                    .setName('set_voctime')
                    .setDescription('Définir le temps vocal.')
            )
        )
        .addSubcommand(subcommand =>
            addCountOption(
                subcommand
                    .setName('add_messages')
                    .setDescription('Ajouter des messages.')
            )
        )
        .addSubcommand(subcommand =>
            addCountOption(
                subcommand
                    .setName('remove_messages')
                    .setDescription('Retirer des messages.')
            )
        )
        .addSubcommand(subcommand =>
            addCountOption(
                subcommand
                    .setName('set_messages')
                    .setDescription('Définir le nombre de messages.')
            )
        ),

    async execute(interaction) {
        if (!interaction.guild) {
            return interaction.reply({
                content: '❌ Cette commande doit être utilisée sur un serveur.',
                ephemeral: true
            });
        }

        if (!await canManageStats(interaction.member)) {
            return rejectUnauthorized(interaction);
        }

        const subcommand =
            interaction.options.getSubcommand();

        const user =
            interaction.options.getUser('membre');

        if (subcommand.endsWith('voctime')) {
            const seconds =
                parseDuration(
                    interaction.options.getString('duree')
                );

            if (seconds === null) {
                return interaction.reply({
                    content:
                        '❌ Durée invalide. Utilisez le format `hh:mm`, par exemple `27:15`.',
                    ephemeral: true
                });
            }

            if (subcommand === 'add_voctime') {
                await adjustVoiceSeconds(
                    interaction.guild.id,
                    user.id,
                    seconds
                );
            }

            if (subcommand === 'remove_voctime') {
                await adjustVoiceSeconds(
                    interaction.guild.id,
                    user.id,
                    -seconds
                );
            }

            if (subcommand === 'set_voctime') {
                await setVoiceSeconds(
                    interaction.guild.id,
                    user.id,
                    seconds
                );
            }

            return interaction.reply({
                content:
                    `✅ Statistiques vocales mises à jour pour ${user}: ${formatDuration(seconds)}.`,
                ephemeral: true
            });
        }

        const amount =
            interaction.options.getInteger('nombre');

        if (subcommand === 'add_messages') {
            await adjustMessageCount(
                interaction.guild.id,
                user.id,
                amount
            );
        }

        if (subcommand === 'remove_messages') {
            await adjustMessageCount(
                interaction.guild.id,
                user.id,
                -amount
            );
        }

        if (subcommand === 'set_messages') {
            await setMessageCount(
                interaction.guild.id,
                user.id,
                amount
            );
        }

        return interaction.reply({
            content:
                `✅ Statistiques messages mises à jour pour ${user}: ${amount.toLocaleString('fr-FR')} messages.`,
            ephemeral: true
        });
    }
};

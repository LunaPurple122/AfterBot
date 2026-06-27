const {
    SlashCommandBuilder
} = require('discord.js');

const {
    getCurrentVoiceChannel,
    isLeader,
    setTemporaryLimit
} = require('../manager/VoiceLimitManager');

const {
    safeReply
} = require('../../../core/interactions');

const {
    handleVoiceInfo
} = require('./voiceInfo');

const {
    handleVoiceReset
} = require('./voiceReset');

const {
    handleVoiceTransfer
} = require('./voiceTransfer');

async function handleLimit(interaction) {
    const channel =
        getCurrentVoiceChannel(interaction.member);

    if (!channel) {
        return safeReply(interaction, {
            content: '❌ Tu dois être connecté à un salon vocal.',
            ephemeral: true
        });
    }

    if (!isLeader(channel, interaction.user.id)) {
        return safeReply(interaction, {
            content: '❌ Seul le premier membre arrivé peut modifier ce salon.',
            ephemeral: true
        });
    }

    const limit =
        interaction.options.getInteger('nombre');

    if (
        !Number.isInteger(limit) ||
        limit < 0 ||
        limit > 99
    ) {
        return safeReply(interaction, {
            content: '❌ La limite doit être comprise entre 0 et 99.',
            ephemeral: true
        });
    }

    try {
        const result =
            await setTemporaryLimit(
                channel,
                limit,
                interaction.member
            );

        return safeReply(interaction, {
            content: result.removed
                ? '✅ Limite temporaire retirée.'
                : `✅ Limite du salon définie à ${limit} participant(s).`,
            ephemeral: true
        });

    } catch (error) {
        if (error.code === 'MISSING_PERMISSION') {
            return safeReply(interaction, {
                content: '❌ Je n’ai pas la permission de modifier ce salon.',
                ephemeral: true
            });
        }

        console.error(
            'Erreur voice limit:',
            error
        );

        return safeReply(interaction, {
            content: '❌ Une erreur est survenue pendant la modification du salon.',
            ephemeral: true
        });
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('voice')
        .setDescription('Gérer temporairement ton salon vocal.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('limit')
                .setDescription('Définir une limite temporaire pour ton salon vocal.')
                .addIntegerOption(option =>
                    option
                        .setName('nombre')
                        .setDescription('Nombre de participants entre 0 et 99. 0 retire la limite temporaire.')
                        .setMinValue(0)
                        .setMaxValue(99)
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('info')
                .setDescription('Afficher les informations temporaires du salon vocal.')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('transfer')
                .setDescription('Transférer la responsabilité à un membre du même vocal.')
                .addUserOption(option =>
                    option
                        .setName('membre')
                        .setDescription('Membre présent dans le même salon vocal.')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('reset')
                .setDescription('Réinitialiser les paramètres temporaires du salon vocal.')
        ),

    async execute(interaction) {
        if (!interaction.guild) {
            return safeReply(interaction, {
                content: 'Cette commande doit être utilisée dans un serveur.',
                ephemeral: true
            });
        }

        const subcommand =
            interaction.options.getSubcommand();

        if (subcommand === 'limit') {
            return handleLimit(interaction);
        }

        if (subcommand === 'info') {
            return handleVoiceInfo(interaction);
        }

        if (subcommand === 'transfer') {
            return handleVoiceTransfer(interaction);
        }

        if (subcommand === 'reset') {
            return handleVoiceReset(interaction);
        }

        return safeReply(interaction, {
            content: 'Sous-commande voice inconnue.',
            ephemeral: true
        });
    }
};

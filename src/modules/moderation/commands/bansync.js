const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    AttachmentBuilder
} = require('discord.js');

const fs = require('fs');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('bansync')
        .setDescription('Synchronisation des bans.')

        .addSubcommand(subcommand =>
            subcommand
                .setName('exporter')
                .setDescription('Exporter les bans du serveur.')
        )

        .addSubcommand(subcommand =>
            subcommand
                .setName('importer')
                .setDescription('Importer une liste de bans.')
                .addAttachmentOption(option =>
                    option
                        .setName('fichier')
                        .setDescription('Fichier JSON exporté')
                        .setRequired(true)
                )
        )

        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'exporter') {
            await interaction.deferReply({ ephemeral: true });

            const bans = await interaction.guild.bans.fetch();

            const ids = bans.map(ban => ({
                id: ban.user.id,
                username: ban.user.tag
            }));

            const filePath = path.join(
                __dirname,
                `bans-${interaction.guild.id}.json`
            );

            fs.writeFileSync(filePath, JSON.stringify(ids, null, 4));

            const attachment = new AttachmentBuilder(filePath);

            await interaction.editReply({
                content: `✅ Export terminé.\n\n👥 ${ids.length} bans exportés.`,
                files: [attachment]
            });

            setTimeout(() => {
                try {
                    fs.unlinkSync(filePath);
                } catch {}
            }, 5000);

            return;
        }

        if (subcommand === 'importer') {
            await interaction.deferReply({ ephemeral: true });

            const fichier = interaction.options.getAttachment('fichier');

            if (!fichier.name.endsWith('.json')) {
                return interaction.editReply({
                    content: '❌ Le fichier doit être un JSON.'
                });
            }

            const response = await fetch(fichier.url);
            const bans = await response.json();

            let succes = 0;
            let erreurs = 0;

            for (const ban of bans) {
                try {
                    await interaction.guild.members.ban(ban.id, {
                        reason: 'Synchronisation de bans'
                    });

                    succes++;
                } catch {
                    erreurs++;
                }
            }

            return interaction.editReply({
                content:
`✅ Import terminé.

🔨 Bans ajoutés : ${succes}
❌ Erreurs : ${erreurs}`
            });
        }
    }
};
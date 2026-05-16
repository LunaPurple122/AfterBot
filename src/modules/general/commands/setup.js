const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { pool } = require('../../../database/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Configure AfterBot pour ce serveur.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const serveurId = interaction.guild.id;
        const nom = interaction.guild.name;

        await pool.query(`
            INSERT INTO serveurs (serveur_id, nom)
            VALUES ($1, $2)
            ON CONFLICT (serveur_id)
            DO UPDATE SET
                nom = EXCLUDED.nom,
                modifie_le = CURRENT_TIMESTAMP;
        `, [serveurId, nom]);

        await interaction.reply({
            content: `✅ Serveur **${nom}** enregistré dans la base de données.`,
            ephemeral: true
        });
    },
};
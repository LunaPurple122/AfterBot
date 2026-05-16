const { EmbedBuilder } = require('discord.js');
const { pool } = require('../database/db');

async function envoyerLog(client, serveurId, options) {

    try {

        const result = await pool.query(`
            SELECT salon_logs_id
            FROM serveurs
            WHERE serveur_id = $1
        `, [serveurId]);

        if (result.rows.length === 0) return;

        const salonLogsId = result.rows[0].salon_logs_id;

        if (!salonLogsId) return;

        const salon = await client.channels.fetch(salonLogsId);

        if (!salon) return;

        const embed = new EmbedBuilder()
            .setTitle(options.titre || 'Log')
            .setDescription(options.description || 'Aucune description')
            .setColor(options.couleur || 0x5865F2)
            .setTimestamp();

        if (options.auteur) {
            embed.setAuthor({
                name: options.auteur.tag,
                iconURL: options.auteur.displayAvatarURL()
            });
        }

        await salon.send({
            embeds: [embed]
        });

    } catch (error) {
        console.error('❌ Erreur logger :', error);
    }
}

module.exports = {
    envoyerLog,
};
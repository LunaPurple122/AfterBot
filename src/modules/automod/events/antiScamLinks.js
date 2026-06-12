const {
    Events,
    PermissionsBitField,
    EmbedBuilder
} = require('discord.js');

const { pool } =
    require('../../../database/db');

const { envoyerLogMessage } =
    require('../../../core/logger');

const scamDomains = [

    'dlscord',
    'd1scord',
    'disc0rd',
    'discord-nitro',
    'discordgift',
    'free-nitro',
    'steamnitro',
    'nitrofree',
    'gift-discord',
    'discord-airdrop',
    'claim-nitro',
    'discordgift.site',
    'discordgift.click',
    'discord-app.net',
    'discord-free.com'
];

module.exports = {

    antiScamLinksEvent: {

        name: Events.MessageCreate,

        async execute(message) {

            if (!message.guild) return;

            if (message.author.bot) return;

            // CONFIG
            const configResult =
                await pool.query(

                    `
                    SELECT *
                    FROM automod_config
                    WHERE serveur_id = $1
                    `,

                    [
                        message.guild.id
                    ]
                );

            const config =
                configResult.rows[0];

            if (!config) return;

            if (
                !config.anti_scam_links_enabled
            ) return;

            // ADMIN BYPASS
            if (
                message.member.permissions.has(
                    PermissionsBitField.Flags.Administrator
                )
            ) return;

            const content =
                message.content.toLowerCase();

            // DETECTION
            const detected =
                scamDomains.some(domain =>
                    content.includes(domain)
                );

            if (!detected) return;

            // DELETE MESSAGE
            try {

                await message.delete();

            } catch (error) {
                console.error(`Impossible de supprimer le message scam ${message.id} :`, error);
            }

            // DM USER
            try {

                const embed =
                    new EmbedBuilder()

                        .setColor(0xED4245)

                        .setTitle(
                            '🚨 Lien frauduleux détecté'
                        )

                        .setDescription(
`Tu as été expulsé de :

🌃 ${message.guild.name}

AfterBot a détecté un lien considéré comme dangereux ou frauduleux.

Si tu penses qu’il s’agit d’une erreur :
contacte le staff du serveur.`
                        );

                await message.author.send({

                    embeds: [embed]
                });

            } catch (error) {
                console.error(`Impossible d'envoyer le DM anti-scam à ${message.author.id} :`, error);
            }

            // KICK
            if (
                !message.guild.members.me.permissions.has(
                    PermissionsBitField.Flags.KickMembers
                )
            ) {

                console.error('Permission bot manquante pour kick anti-scam : KickMembers');

            } else try {

                await message.member.kick(
                    'Automod : lien frauduleux détecté'
                );

            } catch (error) {
                console.error(`Impossible de kick ${message.author.id} après lien frauduleux :`, error);
            }

            // LOG
            await envoyerLogMessage(
                message.client,
                message.guild.id,
                'alerte',
                {

                    content:
`🚨 Lien frauduleux détecté

👤 Membre :
${message.author}

📄 Message :
${message.content}

👢 Action :
Kick automatique`
                }
            );
        }
    }
};

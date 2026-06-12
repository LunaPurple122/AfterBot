const {
    Events,
    PermissionsBitField
} = require('discord.js');

const { pool } =
    require('../../../database/db');

const { envoyerLogMessage } =
    require('../../../core/logger');

const spamCache =
    new Map();

module.exports = {

    antiSpamEvent: {

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
                !config.anti_spam_enabled
            ) return;

            // PERMISSIONS
            if (
                message.member.permissions.has(
                    PermissionsBitField.Flags.Administrator
                )
            ) return;

            const userId =
                message.author.id;

            const now =
                Date.now();

            // CACHE USER
            if (
                !spamCache.has(userId)
            ) {

                spamCache.set(
                    userId,
                    []
                );
            }

            const userMessages =
                spamCache.get(userId);

            // ADD MESSAGE
            userMessages.push({

                timestamp: now,
                message
            });

            // CLEAN OLD
            const filtered =
                userMessages.filter(entry =>

                    now - entry.timestamp <=
                    config.spam_interval * 1000
                );

            spamCache.set(
                userId,
                filtered
            );

            // SPAM DETECTED
            if (
                filtered.length <
                config.spam_message_limit
            ) return;

            // DELETE MESSAGES
            for (const entry of filtered) {

                try {

                    await entry.message.delete();

                } catch (error) {
                    console.error(`Impossible de supprimer le message spam ${entry.message.id} :`, error);
                }
            }

            // TIMEOUT
            if (
                !message.guild.members.me.permissions.has(
                    PermissionsBitField.Flags.ModerateMembers
                )
            ) {

                console.error('Permission bot manquante pour timeout anti-spam : ModerateMembers');

            } else try {

                await message.member.timeout(

                    config.spam_timeout_minutes
                    * 60
                    * 1000,

                    'Automod : spam détecté'
                );

            } catch (error) {
                console.error(`Impossible de timeout ${message.author.id} après spam :`, error);
            }

            // LOG
            await envoyerLogMessage(
                message.client,
                message.guild.id,
                'alerte',
                {

                    content:
`🚨 Spam détecté

👤 Membre :
${message.author}

📄 Messages :
${filtered.length}

⏱️ Intervalle :
${config.spam_interval}s

🔨 Timeout :
${config.spam_timeout_minutes} minutes`
                }
            );

            // RESET CACHE
            spamCache.delete(userId);
        }
    }
};

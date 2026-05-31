const {
    Events,
    PermissionsBitField
} = require('discord.js');

const { pool } =
    require('../../../database/db');

module.exports = {

    antiMassMentionEvent: {

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
                !config.anti_mass_mention_enabled
            ) return;

            // ADMIN BYPASS
            if (
                message.member.permissions.has(
                    PermissionsBitField.Flags.Administrator
                )
            ) return;

            // EVERYONE / HERE
            const hasGlobalMention =
                message.mentions.everyone;

            // USER MENTIONS
            const mentionCount =
                message.mentions.users.size;

            const detected =
                hasGlobalMention ||
                mentionCount >=
                config.mass_mention_limit;

            if (!detected) return;

            // DELETE MESSAGE
            try {

                await message.delete();

            } catch {}

            // TIMEOUT
            try {

                await message.member.timeout(

                    config.mass_mention_timeout_minutes
                    * 60
                    * 1000,

                    'Automod : mass mention détectée'
                );

            } catch {}

            // LOG
            const logsChannel =
                message.guild.channels.cache.get(
                    config.logs_channel_id
                );

            if (logsChannel) {

                await logsChannel.send({

                    content:
`🚨 Mass mention détectée

👤 Membre :
${message.author}

📄 Mentions :
${mentionCount}

⚠️ Everyone/Here :
${hasGlobalMention ? 'Oui' : 'Non'}

🔨 Timeout :
${config.mass_mention_timeout_minutes} minutes`
                });
            }
        }
    }
};
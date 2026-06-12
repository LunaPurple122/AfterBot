const {
    Events,
    PermissionsBitField
} = require('discord.js');

const { pool } =
    require('../../../database/db');

const { envoyerLogMessage } =
    require('../../../core/logger');

const joinCache =
    new Map();

let lockdowns =
    new Map();

module.exports = {

    antiRaidJoinEvent: {

        name: Events.GuildMemberAdd,

        async execute(member) {

            if (!member.guild) return;

            if (member.user.bot) return;

            const configResult =
                await pool.query(

                    `
                    SELECT *
                    FROM automod_config
                    WHERE serveur_id = $1
                    `,

                    [
                        member.guild.id
                    ]
                );

            const config =
                configResult.rows[0];

            if (!config) return;

            if (
                !config.anti_raid_join_enabled
            ) return;

            const guildId =
                member.guild.id;

            const now =
                Date.now();

            if (!joinCache.has(guildId)) {

                joinCache.set(
                    guildId,
                    []
                );
            }

            const joins =
                joinCache.get(guildId);

            joins.push({
                userId: member.id,
                timestamp: now
            });

            const filtered =
                joins.filter(join =>

                    now - join.timestamp <=
                    config.raid_join_interval * 1000
                );

            joinCache.set(
                guildId,
                filtered
            );

            if (
                filtered.length <
                config.raid_join_limit
            ) return;

            if (
                lockdowns.has(guildId)
            ) return;

            lockdowns.set(
                guildId,
                true
            );

            if (
                !member.guild.members.me.permissions.has(
                    PermissionsBitField.Flags.ManageChannels
                )
            ) {

                console.error('Permission bot manquante pour lockdown anti-raid : ManageChannels');

                lockdowns.delete(guildId);

                return;
            }

            await envoyerLogMessage(
                member.client,
                member.guild.id,
                'alerte',
                {

                    content:
`🚨 Raid détecté

👥 Arrivées :
${filtered.length}

⏱️ Intervalle :
${config.raid_join_interval} secondes

🔒 Lockdown :
${config.raid_lockdown_minutes} minutes`
                }
            );

            const channels =
                member.guild.channels.cache.filter(
                    channel =>
                        channel.isTextBased()
                        &&
                        channel.permissionsFor(
                            member.guild.roles.everyone
                        )?.has(
                            PermissionsBitField.Flags.SendMessages
                        )
                );

            for (const channel of channels.values()) {

                try {

                    await channel.permissionOverwrites.edit(

                        member.guild.roles.everyone,

                        {
                            SendMessages: false
                        }
                    );

                } catch (error) {
                    console.error(`Impossible d'activer le lockdown sur le salon ${channel.id} :`, error);
                }
            }

            await envoyerLogMessage(
                member.client,
                member.guild.id,
                'alerte',
                {

                    content:
                        '🔒 Lockdown automatique activé.'
                }
            );

            setTimeout(async () => {

                for (const channel of channels.values()) {

                    try {

                        await channel.permissionOverwrites.edit(

                            member.guild.roles.everyone,

                            {
                                SendMessages: null
                            }
                        );

                    } catch (error) {
                        console.error(`Impossible de désactiver le lockdown sur le salon ${channel.id} :`, error);
                    }
                }

                lockdowns.delete(guildId);

                joinCache.delete(guildId);

                await envoyerLogMessage(
                    member.client,
                    member.guild.id,
                    'alerte',
                    {

                        content:
                            '🔓 Lockdown automatique désactivé.'
                    }
                );

            }, config.raid_lockdown_minutes * 60 * 1000);
        }
    }
};

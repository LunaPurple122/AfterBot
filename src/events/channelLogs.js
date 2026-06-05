const {
    Events,
    AuditLogEvent,
    PermissionFlagsBits
} = require('discord.js');

const { envoyerLog } = require('../core/logger');
const { botHasGuildPermission } = require('../core/permissions');

function canFetchAuditLogs(guild, context) {
    if (
        botHasGuildPermission(
            guild,
            PermissionFlagsBits.ViewAuditLog
        )
    ) return true;

    console.error(`Permission bot manquante pour les audit logs ${context} : ViewAuditLog`);
    return false;
}

module.exports = {

    createEvent: {

        name: Events.ChannelCreate,

        async execute(channel) {

            if (!channel.guild) return;

            let moderateur = null;

            if (canFetchAuditLogs(channel.guild, 'ChannelCreate')) try {

                const fetchedLogs = await channel.guild.fetchAuditLogs({
                    limit: 1,
                    type: AuditLogEvent.ChannelCreate
                });

                const log = fetchedLogs.entries.first();

                if (
                    log &&
                    log.target.id === channel.id &&
                    Date.now() - log.createdTimestamp < 5000
                ) {
                    moderateur = log.executor;
                }

            } catch (error) {
                console.error('Impossible de récupérer les audit logs ChannelCreate :', error);
            }

            await envoyerLog(channel.client, channel.guild.id, {

                titre: '📁 Salon créé',

                description:
`📍 Nom :
${channel.name}

🆔 ID :
${channel.id}

📂 Type :
${channel.type}

${moderateur
? `🛡️ Créé par : ${moderateur}`
: ''}`,

                couleur: 0x57F287
            });
        }
    },

    deleteEvent: {

        name: Events.ChannelDelete,

        async execute(channel) {

            if (!channel.guild) return;

            let moderateur = null;

            if (canFetchAuditLogs(channel.guild, 'ChannelDelete')) try {

                const fetchedLogs = await channel.guild.fetchAuditLogs({
                    limit: 1,
                    type: AuditLogEvent.ChannelDelete
                });

                const log = fetchedLogs.entries.first();

                if (
                    log &&
                    log.target.id === channel.id &&
                    Date.now() - log.createdTimestamp < 5000
                ) {
                    moderateur = log.executor;
                }

            } catch (error) {
                console.error('Impossible de récupérer les audit logs ChannelDelete :', error);
            }

            await envoyerLog(channel.client, channel.guild.id, {

                titre: '🗑️ Salon supprimé',

                description:
`📍 Nom :
${channel.name}

🆔 ID :
${channel.id}

📂 Type :
${channel.type}

${moderateur
? `🛡️ Supprimé par : ${moderateur}`
: ''}`,

                couleur: 0xED4245
            });
        }
    },

    updateEvent: {

        name: Events.ChannelUpdate,

        async execute(oldChannel, newChannel) {

            if (!newChannel.guild) return;

            let moderateur = null;

            if (canFetchAuditLogs(newChannel.guild, 'ChannelUpdate')) try {

                const fetchedLogs = await newChannel.guild.fetchAuditLogs({
                    limit: 1,
                    type: AuditLogEvent.ChannelUpdate
                });

                const log = fetchedLogs.entries.first();

                if (
                    log &&
                    log.target.id === newChannel.id &&
                    Date.now() - log.createdTimestamp < 5000
                ) {
                    moderateur = log.executor;
                }

            } catch (error) {
                console.error('Impossible de récupérer les audit logs ChannelUpdate :', error);
            }

            if (oldChannel.name === newChannel.name) return;

            await envoyerLog(newChannel.client, newChannel.guild.id, {

                titre: '✏️ Salon modifié',

                description:
`📍 Ancien nom :
${oldChannel.name}

📍 Nouveau nom :
${newChannel.name}

🛡️ Modifié par :
${moderateur || 'Inconnu'}`,

                couleur: 0xFEE75C
            });
        }
    }
};

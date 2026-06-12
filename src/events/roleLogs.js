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

        name: Events.GuildRoleCreate,

        async execute(role) {

            let moderateur = null;

            if (canFetchAuditLogs(role.guild, 'RoleCreate')) try {

                const fetchedLogs = await role.guild.fetchAuditLogs({
                    limit: 1,
                    type: AuditLogEvent.RoleCreate
                });

                const log = fetchedLogs.entries.first();

                if (
                    log &&
                    log.target.id === role.id &&
                    Date.now() - log.createdTimestamp < 5000
                ) {
                    moderateur = log.executor;
                }

            } catch (error) {
                console.error('Impossible de récupérer les audit logs RoleCreate :', error);
            }

            await envoyerLog(role.client, role.guild.id, {
                type: 'serveur',

                titre: '🎭 Rôle créé',

                description:
`📍 Nom :
${role.name}

🆔 ID :
${role.id}

${moderateur
? `🛡️ Créé par : ${moderateur}`
: ''}`,

                couleur: 0x57F287
            });
        }
    },

    deleteEvent: {

        name: Events.GuildRoleDelete,

        async execute(role) {

            let moderateur = null;

            if (canFetchAuditLogs(role.guild, 'RoleDelete')) try {

                const fetchedLogs = await role.guild.fetchAuditLogs({
                    limit: 1,
                    type: AuditLogEvent.RoleDelete
                });

                const log = fetchedLogs.entries.first();

                if (
                    log &&
                    log.target.id === role.id &&
                    Date.now() - log.createdTimestamp < 5000
                ) {
                    moderateur = log.executor;
                }

            } catch (error) {
                console.error('Impossible de récupérer les audit logs RoleDelete :', error);
            }

            await envoyerLog(role.client, role.guild.id, {
                type: 'serveur',

                titre: '🗑️ Rôle supprimé',

                description:
`📍 Nom :
${role.name}

🆔 ID :
${role.id}

${moderateur
? `🛡️ Supprimé par : ${moderateur}`
: ''}`,

                couleur: 0xED4245
            });
        }
    },

    updateEvent: {

        name: Events.GuildRoleUpdate,

        async execute(oldRole, newRole) {

            let moderateur = null;

            if (canFetchAuditLogs(newRole.guild, 'RoleUpdate')) try {

                const fetchedLogs = await newRole.guild.fetchAuditLogs({
                    limit: 1,
                    type: AuditLogEvent.RoleUpdate
                });

                const log = fetchedLogs.entries.first();

                if (
                    log &&
                    log.target.id === newRole.id &&
                    Date.now() - log.createdTimestamp < 5000
                ) {
                    moderateur = log.executor;
                }

            } catch (error) {
                console.error('Impossible de récupérer les audit logs RoleUpdate :', error);
            }

            if (oldRole.name === newRole.name) return;

            await envoyerLog(newRole.client, newRole.guild.id, {
                type: 'serveur',

                titre: '✏️ Rôle modifié',

                description:
`📍 Ancien nom :
${oldRole.name}

📍 Nouveau nom :
${newRole.name}

🛡️ Modifié par :
${moderateur || 'Inconnu'}`,

                couleur: 0xFEE75C
            });
        }
    }
};

const {
    Events,
    AuditLogEvent
} = require('discord.js');

const { envoyerLog } = require('../core/logger');

module.exports = {

    createEvent: {

        name: Events.GuildRoleCreate,

        async execute(role) {

            let moderateur = null;

            try {

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

            } catch {}

            await envoyerLog(role.client, role.guild.id, {

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

            try {

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

            } catch {}

            await envoyerLog(role.client, role.guild.id, {

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

            try {

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

            } catch {}

            if (oldRole.name === newRole.name) return;

            await envoyerLog(newRole.client, newRole.guild.id, {

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
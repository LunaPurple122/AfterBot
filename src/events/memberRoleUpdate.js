const {
    Events,
    AuditLogEvent
} = require('discord.js');

const { envoyerLog } = require('../core/logger');

module.exports = {

    updateEvent: {

        name: Events.GuildMemberUpdate,

        async execute(oldMember, newMember) {

            const anciensRoles = oldMember.roles.cache;
            const nouveauxRoles = newMember.roles.cache;

            // RÔLES AJOUTÉS
            const rolesAjoutes = nouveauxRoles.filter(
                role => !anciensRoles.has(role.id)
            );

            // RÔLES RETIRÉS
            const rolesRetires = anciensRoles.filter(
                role => !nouveauxRoles.has(role.id)
            );

            if (
                rolesAjoutes.size === 0 &&
                rolesRetires.size === 0
            ) return;

            let moderateur = null;

            try {

                const fetchedLogs = await newMember.guild.fetchAuditLogs({
                    limit: 1,
                    type: AuditLogEvent.MemberRoleUpdate
                });

                const log = fetchedLogs.entries.first();

                if (
                    log &&
                    log.target.id === newMember.id &&
                    Date.now() - log.createdTimestamp < 5000
                ) {
                    moderateur = log.executor;
                }

            } catch {}

            let description = `👤 Membre : ${newMember.user}\n\n`;

            if (rolesAjoutes.size > 0) {

                description +=
`✅ Rôles ajoutés :
${rolesAjoutes.map(role => role).join(', ')}

`;
            }

            if (rolesRetires.size > 0) {

                description +=
`❌ Rôles retirés :
${rolesRetires.map(role => role).join(', ')}

`;
            }

            description +=
`🛡️ Modifié par :
${moderateur || 'Inconnu'}`;

            await envoyerLog(newMember.client, newMember.guild.id, {

                titre: '🎭 Mise à jour des rôles',

                description,

                couleur: 0x5865F2,

                auteur: newMember.user
            });
        }
    }
};
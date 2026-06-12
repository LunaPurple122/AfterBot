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

            if (canFetchAuditLogs(newMember.guild, 'MemberRoleUpdate')) try {

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

            } catch (error) {
                console.error('Impossible de récupérer les audit logs MemberRoleUpdate :', error);
            }

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
                type: 'user',

                titre: '🎭 Mise à jour des rôles',

                description,

                couleur: 0x5865F2,

                auteur: newMember.user
            });
        }
    }
};

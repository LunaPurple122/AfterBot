const {
    Events,
    AuditLogEvent
} = require('discord.js');

const { envoyerLog } = require('../core/logger');

module.exports = {

    // BAN
    banEvent: {

        name: Events.GuildBanAdd,

        async execute(ban) {

            let moderateur = null;

            try {

                const fetchedLogs = await ban.guild.fetchAuditLogs({
                    limit: 1,
                    type: AuditLogEvent.MemberBanAdd
                });

                const log = fetchedLogs.entries.first();

                if (
                    log &&
                    log.target.id === ban.user.id &&
                    Date.now() - log.createdTimestamp < 5000
                ) {
                    moderateur = log.executor;
                }

            } catch {}

            await envoyerLog(ban.client, ban.guild.id, {

                titre: '🔨 Membre banni',

                description:
`👤 Utilisateur :
${ban.user}

🆔 ID :
${ban.user.id}

🛡️ Banni par :
${moderateur || 'Inconnu'}

📄 Raison :
${ban.reason || '*Aucune raison fournie*'}`,

                couleur: 0xED4245,

                auteur: ban.user
            });
        }
    },

    // UNBAN
    unbanEvent: {

        name: Events.GuildBanRemove,

        async execute(ban) {

            let moderateur = null;

            try {

                const fetchedLogs = await ban.guild.fetchAuditLogs({
                    limit: 1,
                    type: AuditLogEvent.MemberBanRemove
                });

                const log = fetchedLogs.entries.first();

                if (
                    log &&
                    log.target.id === ban.user.id &&
                    Date.now() - log.createdTimestamp < 5000
                ) {
                    moderateur = log.executor;
                }

            } catch {}

            await envoyerLog(ban.client, ban.guild.id, {

                titre: '🔓 Membre débanni',

                description:
`👤 Utilisateur :
${ban.user}

🆔 ID :
${ban.user.id}

🛡️ Débanni par :
${moderateur || 'Inconnu'}`,

                couleur: 0x57F287,

                auteur: ban.user
            });
        }
    },

    // KICK
    kickEvent: {

        name: Events.GuildMemberRemove,

        async execute(member) {

            try {

                const fetchedLogs = await member.guild.fetchAuditLogs({
                    limit: 1,
                    type: AuditLogEvent.MemberKick
                });

                const log = fetchedLogs.entries.first();

                if (
                    log &&
                    log.target.id === member.id &&
                    Date.now() - log.createdTimestamp < 5000
                ) {

                    await envoyerLog(member.client, member.guild.id, {

                        titre: '🔨 Membre expulsé',

                        description:
`👤 Membre :
${member.user}

🛡️ Expulsé par :
${log.executor}

📄 Raison :
${log.reason || '*Aucune raison fournie*'}`,

                        couleur: 0xED4245,

                        auteur: member.user
                    });
                }

            } catch {}
        }
    },

    // TIMEOUT / UNTIMEOUT
    timeoutEvent: {

        name: Events.GuildMemberUpdate,

        async execute(oldMember, newMember) {

            // TIMEOUT
            if (
                !oldMember.communicationDisabledUntil &&
                newMember.communicationDisabledUntil
            ) {

                let moderateur = null;

                try {

                    const fetchedLogs = await newMember.guild.fetchAuditLogs({
                        limit: 1,
                        type: AuditLogEvent.MemberUpdate
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

                await envoyerLog(newMember.client, newMember.guild.id, {

                    titre: '⏳ Membre timeout',

                    description:
`👤 Membre :
${newMember.user}

🛡️ Timeout par :
${moderateur || 'Inconnu'}

⏰ Jusqu’au :
<t:${Math.floor(newMember.communicationDisabledUntilTimestamp / 1000)}:F>`,

                    couleur: 0xED4245,

                    auteur: newMember.user
                });
            }

            // UNTIMEOUT
            else if (
                oldMember.communicationDisabledUntil &&
                !newMember.communicationDisabledUntil
            ) {

                let moderateur = null;

                try {

                    const fetchedLogs = await newMember.guild.fetchAuditLogs({
                        limit: 1,
                        type: AuditLogEvent.MemberUpdate
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

                await envoyerLog(newMember.client, newMember.guild.id, {

                    titre: '🔊 Membre untimeout',

                    description:
`👤 Membre :
${newMember.user}

🛡️ Untimeout par :
${moderateur || 'Inconnu'}`,

                    couleur: 0x57F287,

                    auteur: newMember.user
                });
            }
        }
    },

    // BULK DELETE
    bulkDeleteEvent: {

        name: Events.MessageBulkDelete,

        async execute(messages, channel) {

            if (!channel.guild) return;

            let moderateur = null;

            try {

                const fetchedLogs = await channel.guild.fetchAuditLogs({
                    limit: 1,
                    type: AuditLogEvent.MessageBulkDelete
                });

                const log = fetchedLogs.entries.first();

                if (
                    log &&
                    Date.now() - log.createdTimestamp < 5000
                ) {
                    moderateur = log.executor;
                }

            } catch {}

            await envoyerLog(channel.client, channel.guild.id, {

                titre: '🧹 Suppression massive',

                description:
`📍 Salon :
${channel}

🗑️ Messages supprimés :
${messages.size}

🛡️ Effectué par :
${moderateur || 'Inconnu'}`,

                couleur: 0xED4245
            });
        }
    }
};
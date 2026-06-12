const {
    Events,
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

    // CHANGEMENT PSEUDO SERVEUR
    nicknameUpdateEvent: {

        name: Events.GuildMemberUpdate,

        async execute(oldMember, newMember) {

            if (oldMember.nickname !== newMember.nickname) {

                let moderateur = null;

                if (canFetchAuditLogs(newMember.guild, 'MemberUpdate')) try {

                    const fetchedLogs = await newMember.guild.fetchAuditLogs({
                        limit: 1,
                        type: 24
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
                    console.error('Impossible de récupérer les audit logs MemberUpdate :', error);
                }

                await envoyerLog(newMember.client, newMember.guild.id, {
                    type: 'user',

                    titre: '✏️ Pseudo serveur modifié',

                    description:
`👤 Membre :
${newMember.user}

📛 Ancien pseudo :
${oldMember.nickname || oldMember.user.username}

📛 Nouveau pseudo :
${newMember.nickname || newMember.user.username}

🛡️ Modifié par :
${moderateur || newMember.user}`,

                    couleur: 0xFEE75C,

                    auteur: newMember.user
                });
            }
        }
    },

    // CHANGEMENT USERNAME
    usernameUpdateEvent: {

        name: Events.UserUpdate,

        async execute(oldUser, newUser) {

            if (oldUser.username !== newUser.username) {

                const mutualGuilds = newUser.client.guilds.cache.filter(
                    guild => guild.members.cache.has(newUser.id)
                );

                for (const guild of mutualGuilds.values()) {

                    await envoyerLog(newUser.client, guild.id, {
                        type: 'user',

                        titre: '👤 Username modifié',

                        description:
`👤 Utilisateur :
${newUser}

📛 Ancien username :
${oldUser.username}

📛 Nouveau username :
${newUser.username}`,

                        couleur: 0x5865F2,

                        auteur: newUser
                    });
                }
            }
        }
    },

    // CHANGEMENT AVATAR
    avatarUpdateEvent: {

        name: Events.UserUpdate,

        async execute(oldUser, newUser) {

            if (
                oldUser.displayAvatarURL() !==
                newUser.displayAvatarURL()
            ) {

                const mutualGuilds = newUser.client.guilds.cache.filter(
                    guild => guild.members.cache.has(newUser.id)
                );

                for (const guild of mutualGuilds.values()) {

                    await envoyerLog(newUser.client, guild.id, {
                        type: 'user',

                        titre: '🖼️ Avatar modifié',

                        description:
`👤 Utilisateur :
${newUser}`,

                        couleur: 0x5865F2,

                        auteur: newUser
                    });
                }
            }
        }
    }
};

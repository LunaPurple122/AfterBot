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

    // BOT AJOUTÉ
    botAddEvent: {

        name: Events.GuildMemberAdd,

        async execute(member) {

            if (!member.user.bot) return;

            let moderateur = null;

            if (canFetchAuditLogs(member.guild, 'BotAdd')) try {

                const fetchedLogs = await member.guild.fetchAuditLogs({
                    limit: 1,
                    type: AuditLogEvent.BotAdd
                });

                const log = fetchedLogs.entries.first();

                if (
                    log &&
                    log.target.id === member.id &&
                    Date.now() - log.createdTimestamp < 5000
                ) {
                    moderateur = log.executor;
                }

            } catch (error) {
                console.error('Impossible de récupérer les audit logs BotAdd :', error);
            }

            await envoyerLog(member.client, member.guild.id, {
                type: 'serveur',

                titre: '🤖 Bot ajouté',

                description:
`🤖 Bot :
${member.user}

🆔 ID :
${member.id}

🛡️ Ajouté par :
${moderateur || 'Inconnu'}`,

                couleur: 0x5865F2,

                auteur: member.user
            });
        }
    },

    // EMOJI CRÉÉ
    emojiCreateEvent: {

        name: Events.GuildEmojiCreate,

        async execute(emoji) {

            let moderateur = null;

            if (canFetchAuditLogs(emoji.guild, 'EmojiCreate')) try {

                const fetchedLogs = await emoji.guild.fetchAuditLogs({
                    limit: 1,
                    type: AuditLogEvent.EmojiCreate
                });

                const log = fetchedLogs.entries.first();

                if (
                    log &&
                    log.target.id === emoji.id &&
                    Date.now() - log.createdTimestamp < 5000
                ) {
                    moderateur = log.executor;
                }

            } catch (error) {
                console.error('Impossible de récupérer les audit logs EmojiCreate :', error);
            }

            await envoyerLog(emoji.client, emoji.guild.id, {
                type: 'serveur',

                titre: '😀 Emoji créé',

                description:
`😀 Emoji :
${emoji}

📛 Nom :
${emoji.name}

🛡️ Créé par :
${moderateur || 'Inconnu'}`,

                couleur: 0x57F287
            });
        }
    },

    // EMOJI SUPPRIMÉ
    emojiDeleteEvent: {

        name: Events.GuildEmojiDelete,

        async execute(emoji) {

            let moderateur = null;

            if (canFetchAuditLogs(emoji.guild, 'EmojiDelete')) try {

                const fetchedLogs = await emoji.guild.fetchAuditLogs({
                    limit: 1,
                    type: AuditLogEvent.EmojiDelete
                });

                const log = fetchedLogs.entries.first();

                if (
                    log &&
                    log.target.id === emoji.id &&
                    Date.now() - log.createdTimestamp < 5000
                ) {
                    moderateur = log.executor;
                }

            } catch (error) {
                console.error('Impossible de récupérer les audit logs EmojiDelete :', error);
            }

            await envoyerLog(emoji.client, emoji.guild.id, {
                type: 'serveur',

                titre: '🗑️ Emoji supprimé',

                description:
`📛 Nom :
${emoji.name}

🛡️ Supprimé par :
${moderateur || 'Inconnu'}`,

                couleur: 0xED4245
            });
        }
    },

    // EMOJI MODIFIÉ
    emojiUpdateEvent: {

        name: Events.GuildEmojiUpdate,

        async execute(oldEmoji, newEmoji) {

            if (oldEmoji.name === newEmoji.name) return;

            let moderateur = null;

            if (canFetchAuditLogs(newEmoji.guild, 'EmojiUpdate')) try {

                const fetchedLogs = await newEmoji.guild.fetchAuditLogs({
                    limit: 1,
                    type: AuditLogEvent.EmojiUpdate
                });

                const log = fetchedLogs.entries.first();

                if (
                    log &&
                    log.target.id === newEmoji.id &&
                    Date.now() - log.createdTimestamp < 5000
                ) {
                    moderateur = log.executor;
                }

            } catch (error) {
                console.error('Impossible de récupérer les audit logs EmojiUpdate :', error);
            }

            await envoyerLog(newEmoji.client, newEmoji.guild.id, {
                type: 'serveur',

                titre: '✏️ Emoji modifié',

                description:
`📛 Ancien nom :
${oldEmoji.name}

📛 Nouveau nom :
${newEmoji.name}

🛡️ Modifié par :
${moderateur || 'Inconnu'}`,

                couleur: 0xFEE75C
            });
        }
    },

    // STICKER CRÉÉ
    stickerCreateEvent: {

        name: Events.GuildStickerCreate,

        async execute(sticker) {

            await envoyerLog(sticker.client, sticker.guild.id, {
                type: 'serveur',

                titre: '🎟️ Sticker créé',

                description:
`📛 Sticker :
${sticker.name}`,

                couleur: 0x57F287
            });
        }
    },

    // STICKER SUPPRIMÉ
    stickerDeleteEvent: {

        name: Events.GuildStickerDelete,

        async execute(sticker) {

            await envoyerLog(sticker.client, sticker.guild.id, {
                type: 'serveur',

                titre: '🗑️ Sticker supprimé',

                description:
`📛 Sticker :
${sticker.name}`,

                couleur: 0xED4245
            });
        }
    },

    // STICKER MODIFIÉ
    stickerUpdateEvent: {

        name: Events.GuildStickerUpdate,

        async execute(oldSticker, newSticker) {

            if (oldSticker.name === newSticker.name) return;

            await envoyerLog(newSticker.client, newSticker.guild.id, {
                type: 'serveur',

                titre: '✏️ Sticker modifié',

                description:
`📛 Ancien nom :
${oldSticker.name}

📛 Nouveau nom :
${newSticker.name}`,

                couleur: 0xFEE75C
            });
        }
    }
};

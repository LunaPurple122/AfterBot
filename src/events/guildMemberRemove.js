const { Events } = require('discord.js');
const { envoyerLog } = require('../core/logger');

module.exports = {

    guildMemberRemoveEvent: {

        name: Events.GuildMemberRemove,

        async execute(member) {

            const rejointLe =
                Math.floor(
                    member.joinedTimestamp / 1000
                );

            await envoyerLog(member.client, member.guild.id, {
                type: 'user',

                titre: '🚪 Membre parti',

                description:
`👤 Membre : ${member.user}

📅 A rejoint :
<t:${rejointLe}:F>

🆔 ID :
${member.id}

👥 Membres restants :
${member.guild.memberCount}`,

                couleur: 0xED4245,

                auteur: member.user
            });
        }
    }
};

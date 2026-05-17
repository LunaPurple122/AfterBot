const { Events } = require('discord.js');
const { envoyerLog } = require('../core/logger');

module.exports = {

    guildMemberAddEvent: {

        name: Events.GuildMemberAdd,

        async execute(member) {

            const compteCreeLe =
                Math.floor(
                    member.user.createdTimestamp / 1000
                );

            await envoyerLog(member.client, member.guild.id, {

                titre: '👋 Nouveau membre',

                description:
`👤 Membre : ${member.user}

📅 Compte créé :
<t:${compteCreeLe}:F>

🆔 ID :
${member.id}

👥 Nombre de membres :
${member.guild.memberCount}`,

                couleur: 0x57F287,

                auteur: member.user
            });
        }
    }
};
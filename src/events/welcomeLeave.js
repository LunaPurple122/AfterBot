const {
    Events,
    EmbedBuilder
} = require('discord.js');

const { pool } =
    require('../database/db');

module.exports = {

    // BIENVENUE
    welcomeEvent: {

        name: Events.GuildMemberAdd,

        async execute(member) {

            const result =
                await pool.query(
                    `SELECT salon_bienvenue_id
                    FROM serveurs
                    WHERE serveur_id = $1`,
                    [member.guild.id]
                );

            const config =
                result.rows[0];

            if (!config) return;

            if (
                !config.salon_bienvenue_id
            ) return;

            const salon =
                member.guild.channels.cache.get(
                    config.salon_bienvenue_id
                );

            if (!salon) return;

            const embed =
                new EmbedBuilder()

                    .setColor(0x57F287)

                    .setTitle(
                        '🌃 Nouveau membre'
                    )

                    .setDescription(
`Bienvenue ${member}

Tu es désormais connecté à AfterStation 😏`
                    )

                    .setThumbnail(
                        member.user.displayAvatarURL({
                            dynamic: true
                        })
                    )

                    .setFooter({
                        text:
                            `Membre #${member.guild.memberCount}`
                    })

                    .setTimestamp();

            await salon.send({
                embeds: [embed]
            });
        }
    },

    // DEPART
    leaveEvent: {

        name: Events.GuildMemberRemove,

        async execute(member) {

            const result =
                await pool.query(
                    `SELECT salon_depart_id
                    FROM serveurs
                    WHERE serveur_id = $1`,
                    [member.guild.id]
                );

            const config =
                result.rows[0];

            if (!config) return;

            if (
                !config.salon_depart_id
            ) return;

            const salon =
                member.guild.channels.cache.get(
                    config.salon_depart_id
                );

            if (!salon) return;

            const embed =
                new EmbedBuilder()

                    .setColor(0xED4245)

                    .setTitle(
                        '🌙 Déconnexion'
                    )

                    .setDescription(
`${member.user.tag}
a quitté le serveur.`
                    )

                    .setThumbnail(
                        member.user.displayAvatarURL({
                            dynamic: true
                        })
                    )

                    .setTimestamp();

            await salon.send({
                embeds: [embed]
            });
        }
    }
};
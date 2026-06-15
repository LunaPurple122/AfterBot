const {
    Events
} = require('discord.js');

const {
    buildLeavePayload,
    buildWelcomePayload,
    getLeaveConfig,
    getWelcomeConfig
} = require('../modules/general/services/welcomeService');

function attendre(ms) {
    return new Promise(resolve =>
        setTimeout(resolve, ms)
    );
}

module.exports = {
    welcomeEvent: {
        name: Events.GuildMemberAdd,

        async execute(member) {
            const config =
                await getWelcomeConfig(member.guild.id);

            if (!config?.salon_bienvenue_id) return;

            const salon =
                member.guild.channels.cache.get(
                    config.salon_bienvenue_id
                );

            if (!salon) return;

            await attendre(1500);

            const payload =
                await buildWelcomePayload(
                    member,
                    config.bienvenue_embed
                );

            await salon.send(payload);
        }
    },

    leaveEvent: {
        name: Events.GuildMemberRemove,

        async execute(member) {
            const config =
                await getLeaveConfig(member.guild.id);

            if (!config?.salon_depart_id) return;

            const salon =
                member.guild.channels.cache.get(
                    config.salon_depart_id
                );

            if (!salon) return;

            const payload =
                await buildLeavePayload(
                    member,
                    config.depart_embed
                );

            await salon.send(payload);
        }
    }
};

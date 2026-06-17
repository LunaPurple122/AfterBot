const { Events } = require('discord.js');

const {
    createRequestForMember,
    getConfig
} = require('../services/rodService');

module.exports = {
    name: Events.GuildMemberUpdate,

    async execute(oldMember, newMember) {
        try {
            const config =
                await getConfig(newMember.guild.id);

            if (!config) return;

            const hadRole =
                oldMember.roles.cache.has(
                    config.trigger_role_id
                );

            const hasRole =
                newMember.roles.cache.has(
                    config.trigger_role_id
                );

            if (hadRole || !hasRole) return;

            const triggerRole =
                newMember.guild.roles.cache.get(
                    config.trigger_role_id
                );

            if (!triggerRole) return;

            await createRequestForMember(
                newMember,
                triggerRole
            );

        } catch (error) {
            console.error(
                `Erreur event ROD guildMemberUpdate pour ${newMember?.id} :`,
                error
            );
        }
    }
};

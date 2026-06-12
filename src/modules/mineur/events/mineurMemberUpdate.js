const { Events } = require('discord.js');

const {
    executeMinorBan,
    getMinorRoleIds
} = require('../services/mineurService');

module.exports = {
    name: Events.GuildMemberUpdate,

    async execute(oldMember, newMember) {
        try {
            const addedRoles =
                newMember.roles.cache.filter(role =>
                    !oldMember.roles.cache.has(role.id)
                );

            if (addedRoles.size === 0) return;

            const minorRoleIds =
                await getMinorRoleIds(newMember.guild.id);

            if (minorRoleIds.size === 0) return;

            const triggerRole =
                addedRoles.find(role =>
                    minorRoleIds.has(role.id)
                );

            if (!triggerRole) return;

            await executeMinorBan(
                newMember,
                triggerRole
            );

        } catch (error) {
            console.error(
                `Erreur event mineur GuildMemberUpdate pour ${newMember?.id} :`,
                error
            );
        }
    }
};

const { Events } = require('discord.js');

const {
    handleInviteCreate,
    handleInviteDelete,
    handleMemberJoin,
    handleMemberLeave
} = require('../services/inviteTrackerService');

module.exports = {
    inviteTrackerMemberAdd: {
        name: Events.GuildMemberAdd,

        async execute(member) {
            await handleMemberJoin(member);
        }
    },

    inviteTrackerMemberRemove: {
        name: Events.GuildMemberRemove,

        async execute(member) {
            await handleMemberLeave(member);
        }
    },

    inviteTrackerInviteCreate: {
        name: Events.InviteCreate,

        async execute(invite) {
            await handleInviteCreate(invite);
        }
    },

    inviteTrackerInviteDelete: {
        name: Events.InviteDelete,

        async execute(invite) {
            await handleInviteDelete(invite);
        }
    }
};

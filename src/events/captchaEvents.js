const {
    Events
} = require('discord.js');

const {
    creerCaptcha,
    verifierCaptcha
} = require('../captcha/captchaManager');

module.exports = {

    // JOIN
    captchaJoinEvent: {

        name: Events.GuildMemberAdd,

        async execute(member) {

            await creerCaptcha(member);
        }
    },

    // MESSAGE
    captchaMessageEvent: {

        name: Events.MessageCreate,

        async execute(message) {

            await verifierCaptcha(message);
        }
    }
};
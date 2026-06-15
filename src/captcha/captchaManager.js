const {
    ChannelType,
    PermissionsBitField,
    PermissionFlagsBits,
    AttachmentBuilder
} = require('discord.js');

const { genererCaptcha } =
    require('./captchaGenerator');

const {
    ajouterCaptcha,
    recupererCaptcha,
    incrementerEssais,
    supprimerCaptcha
} = require('./captchaStorage');

const { pool } =
    require('../database/db');

function supprimerSalonCaptcha(message, channelId, delaiMs = 3000) {

    setTimeout(async () => {

        try {

            const salon =
                channelId
                    ? message.guild.channels.cache.get(channelId)
                    : message.channel;

            if (!salon) return;

            await salon.delete();

        } catch (error) {
            console.error('Impossible de supprimer le salon captcha :', error);
        }

    }, delaiMs);
}

async function creerCaptcha(member) {

    const result = await pool.query(
        `SELECT
            captcha_actif,
            role_non_verifie_id,
            role_membre_id,
            categorie_captcha_id
        FROM serveurs
        WHERE serveur_id = $1`,
        [member.guild.id]
    );

    const config = result.rows[0];

    if (!config) return;

    if (!config.captcha_actif) return;

    const botMember =
        member.guild.members.me;

    if (
        !botMember.permissions.has(
            PermissionFlagsBits.ManageChannels
        )
    ) {
        console.error('Permission bot manquante pour créer le salon captcha : ManageChannels');
        return;
    }

    if (
        config.role_non_verifie_id &&
        !botMember.permissions.has(
            PermissionFlagsBits.ManageRoles
        )
    ) {
        console.error('Permission bot manquante pour gérer les rôles captcha : ManageRoles');
        return;
    }

    // ROLE NON VERIFIE
    if (config.role_non_verifie_id) {

        const roleNonVerifie =
            member.guild.roles.cache.get(
                config.role_non_verifie_id
            );

        if (roleNonVerifie) {

            await member.roles.add(
                roleNonVerifie
            );
        }
    }

    // CREATION SALON
    const salon =
        await member.guild.channels.create({

            name:
                `verification-${member.user.username}`,

            type: ChannelType.GuildText,

            parent:
                config.categorie_captcha_id,

            permissionOverwrites: [

                {
                    id: member.guild.id,

                    deny: [
                        PermissionsBitField.Flags.ViewChannel
                    ]
                },

                {
                    id: member.id,

                    allow: [
                        PermissionsBitField.Flags.ViewChannel,
                        PermissionsBitField.Flags.SendMessages,
                        PermissionsBitField.Flags.ReadMessageHistory
                    ]
                }
            ]
        });

    // CAPTCHA
    const captcha = genererCaptcha();

    ajouterCaptcha(
        member.id,
        captcha.code,
        salon.id
    );

    const attachment =
        new AttachmentBuilder(
            captcha.buffer,
            {
                name: 'captcha.png'
            }
        );

    await salon.send({

        content:
`🌃 Bienvenue ${member}

Pour accéder au serveur :

Tape le code affiché sur l’image.`,

        files: [attachment]
    });
}

async function verifierCaptcha(message) {

    if (!message.guild) return false;

    if (message.author.bot) return false;

    const captcha =
        recupererCaptcha(message.author.id);

    if (!captcha) return false;

    if (
        !captcha.channelId ||
        message.channel.id !== captcha.channelId
    ) {
        return false;
    }

    // EXPIRATION
    if (
        Date.now() - captcha.creeLe >
        1000 * 60 * 60 * 24
    ) {

        supprimerCaptcha(message.author.id);

        await message.channel.send(
            '❌ Captcha expiré.'
        );

        supprimerSalonCaptcha(
            message,
            captcha.channelId
        );

        return false;
    }

    // MAUVAIS CODE
    if (
        message.content.toUpperCase() !==
        captcha.code
    ) {

        incrementerEssais(
            message.author.id
        );

        const updatedCaptcha =
            recupererCaptcha(
                message.author.id
            );

        if (
            updatedCaptcha.essais >= 5
        ) {

            await message.channel.send(
                '❌ Trop de tentatives.'
            );

            try {

                await message.member.kick(
                    'Captcha échoué'
                );

            } catch (error) {
                console.error('Impossible de kick après échec captcha :', error);
            }

            supprimerCaptcha(
                message.author.id
            );

            supprimerSalonCaptcha(
                message,
                captcha.channelId
            );

            return true;
        }

        await message.channel.send(
            `❌ Code incorrect.

Tentatives restantes :
${5 - updatedCaptcha.essais}`
        );

        return true;
    }

    // CONFIG
    const result = await pool.query(
        `SELECT
            role_non_verifie_id,
            role_membre_id
        FROM serveurs
        WHERE serveur_id = $1`,
        [message.guild.id]
    );

    const config = result.rows[0];

    if (!config) return false;

    const botMember =
        message.guild.members.me;

    if (
        (
            config.role_non_verifie_id ||
            config.role_membre_id
        ) &&
        !botMember.permissions.has(
            PermissionFlagsBits.ManageRoles
        )
    ) {

        console.error('Permission bot manquante pour valider le captcha : ManageRoles');

        await message.channel.send(
            '❌ Vérification impossible : permission bot manquante.'
        );

        return true;
    }

    const membre =
        await message.guild.members.fetch(
            message.author.id
        );

    // RETIRER ROLE NON VERIFIE
    if (config.role_non_verifie_id) {

        const roleNonVerifie =
            message.guild.roles.cache.get(
                config.role_non_verifie_id
            );

        if (roleNonVerifie) {

            await membre.roles.remove(
                roleNonVerifie
            );
        }
    }

    // AJOUT ROLE MEMBRE
    if (config.role_membre_id) {

        const roleMembre =
            message.guild.roles.cache.get(
                config.role_membre_id
            );

        if (roleMembre) {

            await membre.roles.add(
                roleMembre
            );
        }
    }

    supprimerCaptcha(
        message.author.id
    );

    await message.channel.send(
        '✅ Vérification réussie.'
    );

    supprimerSalonCaptcha(
        message,
        captcha.channelId
    );

    return true;
}

module.exports = {
    creerCaptcha,
    verifierCaptcha
};

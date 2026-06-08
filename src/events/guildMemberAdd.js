const {
    Events,
    PermissionFlagsBits
} = require('discord.js');

const { envoyerLog } = require('../core/logger');
const { pool } = require('../database/db');

async function appliquerAutoroles(member) {
    const result =
        await pool.query(
            `
            SELECT role_id
            FROM autoroles
            WHERE serveur_id = $1
            ORDER BY id ASC
            `,
            [
                member.guild.id
            ]
        );

    const autoroles =
        result.rows;

    if (autoroles.length === 0) {
        return {
            ajoutes: [],
            ignores: [],
            echecs: []
        };
    }

    const botMember =
        member.guild.members.me ||
        await member.guild.members.fetchMe();

    if (
        !botMember.permissions.has(
            PermissionFlagsBits.ManageRoles
        )
    ) {
        console.error(
            `Autoroles ignorés sur ${member.guild.id}: permission ManageRoles manquante.`
        );

        return {
            ajoutes: [],
            ignores: [],
            echecs:
                autoroles.map(autorole => ({
                    roleId: autorole.role_id,
                    raison: 'Permission ManageRoles manquante'
                }))
        };
    }

    const ajoutes = [];
    const ignores = [];
    const echecs = [];

    for (const autorole of autoroles) {
        const role =
            member.guild.roles.cache.get(
                autorole.role_id
            ) ||
            await member.guild.roles.fetch(autorole.role_id)
                .catch(error => {
                    console.error(
                        `Autorole introuvable ${autorole.role_id} sur ${member.guild.id}:`,
                        error
                    );
                    return null;
                });

        if (!role) {
            ignores.push({
                roleId:
                    autorole.role_id,
                raison:
                    'Rôle introuvable'
            });
            continue;
        }

        if (member.roles.cache.has(role.id)) {
            ignores.push({
                roleId:
                    role.id,
                raison:
                    'Déjà présent'
            });
            continue;
        }

        if (
            role.managed ||
            role.position >= botMember.roles.highest.position
        ) {
            console.error(
                `Autorole ${role.id} ignoré pour ${member.id}: rôle géré ou au-dessus du bot.`
            );

            ignores.push({
                roleId:
                    role.id,
                raison:
                    'Rôle géré ou hiérarchie insuffisante'
            });
            continue;
        }

        try {
            await member.roles.add(
                role,
                'Autorole à l’arrivée du membre'
            );

            ajoutes.push(role);

        } catch (error) {
            console.error(
                `Impossible d'ajouter l'autorôle ${role.id} à ${member.id}:`,
                error
            );

            echecs.push({
                roleId:
                    role.id,
                raison:
                    error.message || String(error)
            });
        }
    }

    return {
        ajoutes,
        ignores,
        echecs
    };
}

module.exports = {

    guildMemberAddEvent: {

        name: Events.GuildMemberAdd,

        async execute(member) {
            const autoroleResult =
                await appliquerAutoroles(member)
                    .catch(error => {
                        console.error(
                            `Erreur autoroles pour ${member.id} sur ${member.guild.id}:`,
                            error
                        );

                        return {
                            ajoutes: [],
                            ignores: [],
                            echecs: [
                                {
                                    roleId: 'global',
                                    raison: error.message || String(error)
                                }
                            ]
                        };
                    });

            const compteCreeLe =
                Math.floor(
                    member.user.createdTimestamp / 1000
                );

            const rolesAjoutes =
                autoroleResult.ajoutes.length > 0
                    ? autoroleResult.ajoutes
                        .map(role => role.toString())
                        .join(', ')
                    : 'Aucun';

            const erreursAutoroles =
                autoroleResult.echecs.length > 0
                    ? `\n\n⚠️ Autoroles en échec :\n${autoroleResult.echecs
                        .slice(0, 5)
                        .map(echec => `${echec.roleId} : ${echec.raison}`)
                        .join('\n')}`
                    : '';

            await envoyerLog(member.client, member.guild.id, {

                titre: '👋 Nouveau membre',

                description:
`👤 Membre : ${member.user}

📅 Compte créé :
<t:${compteCreeLe}:F>

🆔 ID :
${member.id}

👥 Nombre de membres :
${member.guild.memberCount}

🎭 Autoroles ajoutés :
${rolesAjoutes}${erreursAutoroles}`,

                couleur: 0x57F287,

                auteur: member.user
            });
        }
    }
};

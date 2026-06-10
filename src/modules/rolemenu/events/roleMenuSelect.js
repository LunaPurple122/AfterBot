const {
    Events,
    PermissionFlagsBits
} = require('discord.js');

const {
    getRolemenuByMessage,
    getRolemenuRoles,
    disableRoleOption
} = require('../services/roleMenuService');

const {
    buildRolemenuPayload
} = require('../services/roleMenuRenderer');

const {
    safeDeferReply,
    safeReply
} = require('../../../core/interactions');

async function resetRolemenuMessage(interaction, rolemenu) {
    try {
        const payload =
            await buildRolemenuPayload(
                interaction.guild,
                rolemenu
            );

        await interaction.message.edit(payload);

    } catch (error) {
        console.error(
            `Impossible de réinitialiser le menu ${rolemenu.id}:`,
            error
        );
    }
}

module.exports = {

    roleMenuSelectEvent: {

        name: Events.InteractionCreate,

        async execute(interaction) {

            if (!interaction.isStringSelectMenu()) return;

            if (
                !interaction.customId.startsWith(
                    'rolemenu:'
                )
            ) return;

            const rolemenuId =
                Number(
                    interaction.customId.replace(
                        'rolemenu:',
                        ''
                    )
                );

            if (!Number.isInteger(rolemenuId)) return;

            const deferred =
                await safeDeferReply(interaction, {
                    ephemeral: true
                });

            if (!deferred) return;

            const rolemenu =
                await getRolemenuByMessage(
                    interaction.guild.id,
                    interaction.message.id
                );

            if (
                !rolemenu ||
                rolemenu.id !== rolemenuId ||
                !rolemenu.actif
            ) {

                return safeReply(interaction, {

                    content:
                        '❌ Ce rolemenu est désactivé ou introuvable.',

                    ephemeral: true
                });
            }

            if (
                !interaction.guild.members.me.permissions.has(
                    PermissionFlagsBits.ManageRoles
                )
            ) {

                console.error(
                    `Permission ManageRoles manquante pour rolemenu ${rolemenu.id}`
                );

                return safeReply(interaction, {

                    content:
                        '❌ Permission bot manquante : ManageRoles.',

                    ephemeral: true
                });
            }

            const roleId =
                interaction.values[0];

            if (roleId === interaction.guild.id) {

                return safeReply(interaction, {

                    content:
                        '❌ Le rôle @everyone ne peut pas être attribué.',

                    ephemeral: true
                });
            }

            const options =
                await getRolemenuRoles(rolemenu.id, true);

            const option =
                options.find(item =>
                    item.role_id === roleId
                );

            if (!option) {

                return safeReply(interaction, {

                    content:
                        '❌ Cette option n’est plus active.',

                    ephemeral: true
                });
            }

            const role =
                interaction.guild.roles.cache.get(roleId);

            if (!role) {

                await disableRoleOption(option.id);

                return safeReply(interaction, {

                    content:
                        '❌ Ce rôle n’existe plus. Option désactivée.',

                    ephemeral: true
                });
            }

            if (
                role.position >=
                interaction.guild.members.me.roles.highest.position
            ) {

                console.error(
                    `Rôle trop haut pour rolemenu ${rolemenu.id}: ${role.id}`
                );

                return safeReply(interaction, {

                    content:
                        '❌ Mon rôle est trop bas pour gérer ce rôle.',

                    ephemeral: true
                });
            }

            const member =
                await interaction.guild.members.fetch(
                    interaction.user.id
                );

            const hasRole =
                member.roles.cache.has(role.id);

            try {

                if (hasRole) {

                    await member.roles.remove(role);

                    await resetRolemenuMessage(
                        interaction,
                        rolemenu
                    );

                    return safeReply(interaction, {

                        content:
                            `✅ Rôle retiré : ${role}`,

                        ephemeral: true
                    });
                }

                await member.roles.add(role);

                await resetRolemenuMessage(
                    interaction,
                    rolemenu
                );

                return safeReply(interaction, {

                    content:
                        `✅ Rôle ajouté : ${role}`,

                    ephemeral: true
                });

            } catch (error) {

                console.error(
                    `Erreur attribution rolemenu ${rolemenu.id} rôle ${role.id}:`,
                    error
                );

                return safeReply(interaction, {

                    content:
                        '❌ Impossible de modifier ton rôle.',

                    ephemeral: true
                });
            }
        }
    }
};

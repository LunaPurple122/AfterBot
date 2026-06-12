const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
    MessageFlags,
    PermissionFlagsBits,
    SlashCommandBuilder
} = require('discord.js');

const { envoyerLog } =
    require('../../../core/logger');

const UTILISATEUR_AUTORISE =
    '987688776027471933';

const DELAI_KICK_MS =
    250;

function attendre(ms) {
    return new Promise(resolve =>
        setTimeout(resolve, ms)
    );
}

module.exports = {

    data: new SlashCommandBuilder()

        .setName('boum_kick')

        .setDescription(
            'Kick de test par rôle.'
        )

        .addRoleOption(option =>
            option

                .setName('role')

                .setDescription(
                    'Rôle des membres à expulser'
                )

                .setRequired(true)
        )

        .addStringOption(option =>
            option

                .setName('raison')

                .setDescription(
                    'Raison du kick'
                )

                .setRequired(false)
        ),

    async execute(interaction) {

        if (interaction.user.id !== UTILISATEUR_AUTORISE) {
            return interaction.reply({
                content:
                    '❌ Vous n\'êtes pas autorisé à utiliser cette commande.',
                ephemeral: true
            });
        }

        if (!interaction.inGuild() || !interaction.guild) {
            return interaction.reply({
                content:
                    '❌ Cette commande doit être utilisée dans un serveur.',
                ephemeral: true
            });
        }

        const role =
            interaction.options.getRole(
                'role'
            );

        const raison =
            interaction.options.getString(
                'raison'
            ) || 'Kick de test';

        if (!role) {
            return interaction.reply({
                content:
                    '❌ Rôle introuvable.',
                ephemeral: true
            });
        }

        if (role.id === interaction.guild.id) {
            return interaction.reply({
                content:
                    '❌ Impossible d\'utiliser @everyone.',
                ephemeral: true
            });
        }

        if (
            role.permissions.has(
                PermissionFlagsBits.Administrator
            )
        ) {
            return interaction.reply({
                content:
                    '❌ Impossible de cibler un rôle administrateur.',
                ephemeral: true
            });
        }

        const botMember =
            interaction.guild.members.me;

        if (
            !botMember?.permissions.has(
                PermissionFlagsBits.KickMembers
            )
        ) {
            return interaction.reply({
                content:
                    '❌ Permission bot manquante : KickMembers.',
                ephemeral: true
            });
        }

        if (
            role.position >= botMember.roles.highest.position
        ) {
            return interaction.reply({
                content:
                    '❌ Mon rôle est trop bas pour gérer ce rôle.',
                ephemeral: true
            });
        }

        await interaction.deferReply({
            flags:
                MessageFlags.Ephemeral
        });

        try {
            await interaction.guild.members.fetch();
        } catch (error) {
            console.error(
                `Impossible de récupérer les membres du serveur ${interaction.guild.id} :`,
                error
            );

            return interaction.editReply({
                content:
                    '❌ Impossible de récupérer les membres du serveur.'
            });
        }

        const membres =
            interaction.guild.members.cache
                .filter(membre =>
                    !membre.user.bot &&
                    membre.roles.cache.has(role.id)
                );

        const membresConcernes =
            Array.from(membres.values());

        if (membresConcernes.length === 0) {
            return interaction.editReply({
                content:
                    '❌ Aucun membre ne possède ce rôle.'
            });
        }

        const confirmerButton =
            new ButtonBuilder()
                .setCustomId('kick_test_confirmer')
                .setLabel('Confirmer')
                .setStyle(ButtonStyle.Danger);

        const annulerButton =
            new ButtonBuilder()
                .setCustomId('kick_test_annuler')
                .setLabel('Annuler')
                .setStyle(ButtonStyle.Secondary);

        const row =
            new ActionRowBuilder()
                .addComponents(
                    confirmerButton,
                    annulerButton
                );

        const confirmation =
            await interaction.editReply({
                content:
`⚠️ Confirmation requise.

Rôle ciblé : ${role}
Membres trouvés : ${membresConcernes.length}

Confirmer le kick de ces membres ?`,
                components: [row],
                fetchReply: true
            });

        let choix;

        try {
            choix =
                await confirmation.awaitMessageComponent({
                    componentType: ComponentType.Button,
                    filter: componentInteraction =>
                        componentInteraction.user.id === interaction.user.id,
                    time: 30000
                });
        } catch (error) {
            console.error(
                `Confirmation kick_test expirée pour ${interaction.user.id} :`,
                error
            );

            return interaction.editReply({
                content:
                    '❌ Confirmation expirée. Aucun membre expulsé.',
                components: []
            });
        }

        if (choix.customId === 'kick_test_annuler') {
            await choix.update({
                content:
                    '❌ Action annulée. Aucun membre expulsé.',
                components: []
            });

            return;
        }

        await choix.update({
            content:
                '⏳ Kick des membres en cours...',
            components: []
        });

        let kicksReussis = 0;
        let echecs = 0;

        for (const membre of membresConcernes) {
            if (
                membre.id === interaction.guild.ownerId ||
                membre.id === interaction.user.id ||
                membre.roles.highest.position >= botMember.roles.highest.position
            ) {
                echecs += 1;

                console.error(
                    `Kick ignoré pour ${membre.id} : hiérarchie bot, propriétaire ou utilisateur déclencheur.`
                );

                await attendre(DELAI_KICK_MS);
                continue;
            }

            try {
                await membre.kick(
                    `${raison} | Test kick par rôle demandé par ${interaction.user.tag}`
                );

                kicksReussis += 1;

                console.log(
                    `Kick test réussi pour ${membre.user.tag} (${membre.id}) avec le rôle ${role.name}.`
                );

                try {
                    await envoyerLog(
                        interaction.client,
                        interaction.guild.id,
                        {
                            type: 'punisher',
                            titre: 'Kick test réussi',
                            description:
`Membre :
${membre.user}

Rôle ciblé :
${role}

Raison :
${raison}`,
                            couleur: 0xED4245,
                            auteur: membre.user
                        }
                    );
                } catch (logError) {
                    console.error(
                        `Impossible de logger le kick_test réussi pour ${membre.id} :`,
                        logError
                    );
                }
            } catch (error) {
                echecs += 1;

                console.error(
                    `Impossible de kick ${membre.id} avec kick_test :`,
                    error
                );

                try {
                    await envoyerLog(
                        interaction.client,
                        interaction.guild.id,
                        {
                            type: 'punisher',
                            titre: 'Kick test échoué',
                            description:
`Membre :
${membre.user}

Rôle ciblé :
${role}

Erreur :
${error.message || error}`,
                            couleur: 0xED4245,
                            auteur: membre.user
                        }
                    );
                } catch (logError) {
                    console.error(
                        `Impossible de logger l'échec kick_test pour ${membre.id} :`,
                        logError
                    );
                }
            }

            await attendre(DELAI_KICK_MS);
        }

        await interaction.editReply({
            content:
`✅ Kick test terminé.

Membres trouvés : ${membresConcernes.length}
Kicks réussis : ${kicksReussis}
Échecs : ${echecs}`
        });
    }
};

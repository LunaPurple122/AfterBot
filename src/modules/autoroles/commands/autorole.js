const {
    SlashCommandBuilder,
    PermissionFlagsBits
} = require('discord.js');

const { pool } =
    require('../../../database/db');

const {
    requireBotPermission
} = require('../../../core/permissions');

module.exports = {

    data: new SlashCommandBuilder()

        .setName('autorole')
        .setDescription(
            'Gestion des autorôles.'
        )

        // AJOUTER
        .addSubcommand(subcommand =>
            subcommand

                .setName('ajouter')
                .setDescription(
                    'Ajouter un autorôle.'
                )

                .addRoleOption(option =>
                    option

                        .setName('role')
                        .setDescription(
                            'Rôle à ajouter'
                        )

                        .setRequired(true)
                )
        )

        // SUPPRIMER
        .addSubcommand(subcommand =>
            subcommand

                .setName('supprimer')
                .setDescription(
                    'Supprimer un autorôle.'
                )

                .addRoleOption(option =>
                    option

                        .setName('role')
                        .setDescription(
                            'Rôle à supprimer'
                        )

                        .setRequired(true)
                )
        )

        // LISTE
        .addSubcommand(subcommand =>
            subcommand

                .setName('liste')
                .setDescription(
                    'Afficher les autorôles.'
                )
        )

        // VERIFIER
        .addSubcommand(subcommand =>
            subcommand

                .setName('verifier')
                .setDescription(
                    'Vérifier tous les membres.'
                )
        )

        .setDefaultMemberPermissions(
            PermissionFlagsBits.Administrator
        ),

    async execute(interaction) {

        const subcommand =
            interaction.options.getSubcommand();

        const serveurId =
            interaction.guild.id;

        // AJOUTER
        if (subcommand === 'ajouter') {

            const role =
                interaction.options.getRole(
                    'role'
                );

            const dejaExistant =
                await pool.query(
                    `SELECT *
                    FROM autoroles
                    WHERE serveur_id = $1
                    AND role_id = $2`,
                    [
                        serveurId,
                        role.id
                    ]
                );

            if (
                dejaExistant.rows.length > 0
            ) {

                return interaction.reply({

                    content:
                        '❌ Ce rôle est déjà un autorôle.',

                    ephemeral: true
                });
            }

            await pool.query(
                `INSERT INTO autoroles
                (serveur_id, role_id)
                VALUES ($1, $2)`,
                [
                    serveurId,
                    role.id
                ]
            );

            return interaction.reply({

                content:
                    `✅ Autorôle ajouté :
${role}`,

                ephemeral: true
            });
        }

        // SUPPRIMER
        if (subcommand === 'supprimer') {

            const role =
                interaction.options.getRole(
                    'role'
                );

            await pool.query(
                `DELETE FROM autoroles
                WHERE serveur_id = $1
                AND role_id = $2`,
                [
                    serveurId,
                    role.id
                ]
            );

            return interaction.reply({

                content:
                    `✅ Autorôle supprimé :
${role}`,

                ephemeral: true
            });
        }

        // LISTE
        if (subcommand === 'liste') {

            const result =
                await pool.query(
                    `SELECT *
                    FROM autoroles
                    WHERE serveur_id = $1`,
                    [serveurId]
                );

            if (
                result.rows.length === 0
            ) {

                return interaction.reply({

                    content:
                        '❌ Aucun autorôle.',

                    ephemeral: true
                });
            }

            const roles =
                result.rows.map(row => {

                    return `<@&${row.role_id}>`;

                }).join('\n');

            return interaction.reply({

                content:
`🌃 Autorôles configurés :

${roles}`,

                ephemeral: true
            });
        }

        // VERIFIER
        if (subcommand === 'verifier') {

            if (!await requireBotPermission(
                interaction,
                PermissionFlagsBits.ManageRoles,
                'ManageRoles'
            )) return;

            await interaction.reply({

                content:
                    '⏳ Vérification en cours...',

                ephemeral: true
            });

            try {

                await interaction.guild.members.fetch();

            } catch (error) {

                console.error(
                    `Impossible de charger tous les membres du serveur ${serveurId} :`,
                    error
                );

                return interaction.editReply({

                    content:
                        '❌ Impossible de charger tous les membres du serveur.'
                });
            }

            const result =
                await pool.query(
                    `SELECT *
                    FROM autoroles
                    WHERE serveur_id = $1`,
                    [serveurId]
                );

            const autoroles =
                result.rows;

            if (
                autoroles.length === 0
            ) {

                return interaction.editReply({

                    content:
                        '❌ Aucun autorôle configuré.'
                });
            }

            let membresVerifies = 0;
            let rolesAjoutes = 0;
            let echecs = 0;

            const modifications = [];
            const erreurs = [];

            for (
                const member
                of interaction.guild.members.cache.values()
            ) {

                if (member.user.bot) continue;

                const rolesAjoutesAuMembre = [];

                for (
                    const autorole
                    of autoroles
                ) {

                    const role =
                        interaction.guild.roles.cache.get(
                            autorole.role_id
                        );

                    if (!role) continue;

                    if (
                        member.roles.cache.has(
                            role.id
                        )
                    ) continue;

                    try {

                        await member.roles.add(role);

                        rolesAjoutes++;

                        rolesAjoutesAuMembre.push(
                            role.toString()
                        );

                    } catch (error) {

                        echecs++;

                        console.error(`Impossible d'ajouter l'autorôle ${autorole.role_id} à ${member.id} :`, error);

                        erreurs.push(
                            `${member.user.tag} (${member.id}) : ${role.name}`
                        );
                    }

                }

                if (
                    rolesAjoutesAuMembre.length > 0
                ) {

                    modifications.push(
                        `${member.user.tag} (${member.id}) : + ${rolesAjoutesAuMembre.join(', ')}`
                    );
                }

                membresVerifies++;
            }

            const lignesRapport = [];
            let modificationsMasquees = 0;

            for (
                const modification
                of modifications
            ) {

                const ligne =
                    `- ${modification}`;

                const rapportActuel =
                    lignesRapport.join('\n');

                if (
                    rapportActuel.length + ligne.length > 1200
                ) {

                    modificationsMasquees++;
                    continue;
                }

                lignesRapport.push(ligne);
            }

            const detailsModifications =
                lignesRapport.length > 0
                    ? lignesRapport.join('\n')
                    : 'Aucun membre modifié.';

            const detailsMasques =
                modificationsMasquees > 0
                    ? `\n... ${modificationsMasquees} modification(s) supplémentaire(s) non affichée(s).`
                    : '';

            const detailsErreurs =
                erreurs.length > 0
                    ? `\n\n⚠️ Erreurs :\n${erreurs.slice(0, 10).join('\n')}${erreurs.length > 10 ? `\n... ${erreurs.length - 10} erreur(s) supplémentaire(s).` : ''}`
                    : '';

            return interaction.editReply({

                content:
`✅ Vérification terminée.

👥 Membres vérifiés :
${membresVerifies}

🔧 Rôles ajoutés :
${rolesAjoutes}

❌ Échecs :
${echecs}

📝 Membres modifiés :
${detailsModifications}${detailsMasques}${detailsErreurs}`

            });
        }
    }
};

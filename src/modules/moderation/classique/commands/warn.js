const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder
} = require('discord.js');

const { pool } =
    require('../../../../database/db');

const { envoyerLog } =
    require('../../../../core/logger');

module.exports = {

    data: new SlashCommandBuilder()

        .setName('warn')

        .setDescription(
            'Gestion des avertissements.'
        )

        // ADD
        .addSubcommand(subcommand =>
            subcommand

                .setName('add')

                .setDescription(
                    'Ajouter un avertissement.'
                )

                .addUserOption(option =>
                    option

                        .setName('membre')

                        .setDescription(
                            'Membre à avertir'
                        )

                        .setRequired(true)
                )

                .addStringOption(option =>
                    option

                        .setName('raison')

                        .setDescription(
                            'Raison du warn'
                        )

                        .setRequired(false)
                )
        )

        // LIST
        .addSubcommand(subcommand =>
            subcommand

                .setName('list')

                .setDescription(
                    'Afficher les avertissements.'
                )

                .addUserOption(option =>
                    option

                        .setName('membre')

                        .setDescription(
                            'Membre ciblé'
                        )

                        .setRequired(true)
                )
        )

        // CLEAR
        .addSubcommand(subcommand =>
            subcommand

                .setName('clear')

                .setDescription(
                    'Supprimer les avertissements.'
                )

                .addUserOption(option =>
                    option

                        .setName('membre')

                        .setDescription(
                            'Membre ciblé'
                        )

                        .setRequired(true)
                )
        )

        .setDefaultMemberPermissions(
            PermissionFlagsBits.ModerateMembers
        ),

    async execute(interaction) {

        const subcommand =
            interaction.options.getSubcommand();

        const serveurId =
            interaction.guild.id;

        // ADD
        if (subcommand === 'add') {

            const membre =
                interaction.options.getMember(
                    'membre'
                );

            const user =
                interaction.options.getUser(
                    'membre'
                );

            const raison =
                interaction.options.getString(
                    'raison'
                ) || 'Aucune raison fournie';

            // SELF
            if (
                membre.id === interaction.user.id
            ) {

                return interaction.reply({

                    content:
                        '❌ Tu ne peux pas te warn toi-même.',

                    ephemeral: true
                });
            }

            // OWNER
            if (
                membre.id ===
                interaction.guild.ownerId
            ) {

                return interaction.reply({

                    content:
                        '❌ Impossible de warn le propriétaire.',

                    ephemeral: true
                });
            }

            // HIERARCHIE
            if (
                membre.roles.highest.position >=
                interaction.member.roles.highest.position
                &&
                interaction.guild.ownerId !==
                interaction.user.id
            ) {

                return interaction.reply({

                    content:
                        '❌ Ce membre possède un rôle supérieur ou égal au tien.',

                    ephemeral: true
                });
            }

            // INSERT DB
            await pool.query(

                `INSERT INTO warns
                (
                    serveur_id,
                    utilisateur_id,
                    moderateur_id,
                    raison
                )

                VALUES ($1, $2, $3, $4)`,

                [
                    serveurId,
                    membre.id,
                    interaction.user.id,
                    raison
                ]
            );

            // COUNT
            const countResult =
                await pool.query(

                    `SELECT COUNT(*)
                    FROM warns
                    WHERE serveur_id = $1
                    AND utilisateur_id = $2`,

                    [
                        serveurId,
                        membre.id
                    ]
                );

            const totalWarns =
                countResult.rows[0].count;

            // DM
            try {

                const embed =
                    new EmbedBuilder()

                        .setColor(0xFEE75C)

                        .setTitle(
                            '⚠️ Avertissement'
                        )

                        .setDescription(
`Tu as reçu un avertissement sur :

🌃 ${interaction.guild.name}

📄 Raison :
${raison}

⚠️ Total warns :
${totalWarns}`
                        )

                        .setTimestamp();

                await membre.send({
                    embeds: [embed]
                });

            } catch (error) {
                console.error(`Impossible d'envoyer le DM de warn à ${membre.id} :`, error);
            }

            // REPONSE
            await interaction.reply({

                content:
`⚠️ ${user.tag} a été averti.

📄 Raison :
${raison}

⚠️ Total warns :
${totalWarns}`
            });

            // LOG
            await envoyerLog(

                interaction.client,

                interaction.guild.id,

                {

                    titre:
                        '⚠️ Avertissement',

                    description:
`👤 Membre :
${user}

🛡️ Modérateur :
${interaction.user}

📄 Raison :
${raison}

⚠️ Total warns :
${totalWarns}`,

                    couleur: 0xFEE75C,

                    auteur: user
                }
            );

            return;
        }

        // LIST
        if (subcommand === 'list') {

            const membre =
                interaction.options.getUser(
                    'membre'
                );

            const result =
                await pool.query(

                    `SELECT *
                    FROM warns
                    WHERE serveur_id = $1
                    AND utilisateur_id = $2
                    ORDER BY cree_le DESC`,

                    [
                        serveurId,
                        membre.id
                    ]
                );

            if (
                result.rows.length === 0
            ) {

                return interaction.reply({

                    content:
                        '✅ Aucun avertissement.',

                    ephemeral: true
                });
            }

            const warns =
                result.rows.map((warn, index) => {

                    return (
`#${index + 1}

📄 ${warn.raison}

🛡️ <@${warn.moderateur_id}>

📅 <t:${Math.floor(
new Date(warn.cree_le).getTime() / 1000
)}:F>`
                    );

                }).join('\n\n');

            return interaction.reply({

                content:
`⚠️ Avertissements de ${membre} :

${warns}`,

                ephemeral: true
            });
        }

        // CLEAR
        if (subcommand === 'clear') {

            const membre =
                interaction.options.getUser(
                    'membre'
                );

            const result =
                await pool.query(

                    `DELETE FROM warns
                    WHERE serveur_id = $1
                    AND utilisateur_id = $2
                    RETURNING *`,

                    [
                        serveurId,
                        membre.id
                    ]
                );

            const total =
                result.rows.length;

            await interaction.reply({

                content:
`✅ Warns supprimés.

👤 Membre :
${membre}

🗑️ Warns supprimés :
${total}`
            });

            // LOG
            await envoyerLog(

                interaction.client,

                interaction.guild.id,

                {

                    titre:
                        '🗑️ Warns supprimés',

                    description:
`👤 Membre :
${membre}

🛡️ Modérateur :
${interaction.user}

🗑️ Warns supprimés :
${total}`,

                    couleur: 0xED4245,

                    auteur: membre
                }
            );
        }
    }
};

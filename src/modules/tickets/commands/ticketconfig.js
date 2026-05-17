const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType
} = require('discord.js');

const { pool } =
    require('../../../database/db');

module.exports = {

    data: new SlashCommandBuilder()

        .setName('ticketconfig')

        .setDescription(
            'Configurer le système de tickets.'
        )

        .addChannelOption(option =>
            option

                .setName('panel_channel')

                .setDescription(
                    'Salon du panel ticket'
                )

                .addChannelTypes(
                    ChannelType.GuildText
                )

                .setRequired(true)
        )

        .addRoleOption(option =>
            option

                .setName('staff_role')

                .setDescription(
                    'Rôle staff'
                )

                .setRequired(true)
        )

        .addChannelOption(option =>
            option

                .setName('category')

                .setDescription(
                    'Catégorie des tickets'
                )

                .addChannelTypes(
                    ChannelType.GuildCategory
                )

                .setRequired(true)
        )

        .addChannelOption(option =>
            option

                .setName('logs_channel')

                .setDescription(
                    'Salon des logs tickets'
                )

                .addChannelTypes(
                    ChannelType.GuildText
                )

                .setRequired(true)
        )

        .addChannelOption(option =>
            option

                .setName('alert_channel')

                .setDescription(
                    'Salon des alertes staff'
                )

                .addChannelTypes(
                    ChannelType.GuildText
                )

                .setRequired(true)
        )

        .addStringOption(option =>
            option

                .setName('alert_message')

                .setDescription(
                    'Message envoyé au staff'
                )

                .setRequired(true)
        )

        .setDefaultMemberPermissions(
            PermissionFlagsBits.Administrator
        ),

    async execute(interaction) {

        const panelChannel =
            interaction.options.getChannel(
                'panel_channel'
            );

        const staffRole =
            interaction.options.getRole(
                'staff_role'
            );

        const category =
            interaction.options.getChannel(
                'category'
            );

        const logsChannel =
            interaction.options.getChannel(
                'logs_channel'
            );

        const alertChannel =
            interaction.options.getChannel(
                'alert_channel'
            );

        const alertMessage =
            interaction.options.getString(
                'alert_message'
            );

        try {

            await pool.query(

                `
                INSERT INTO ticket_config (

                    serveur_id,
                    panel_channel_id,
                    staff_role_id,
                    category_id,
                    logs_channel_id,
                    alert_channel_id,
                    alert_message

                )

                VALUES (
                    $1, $2, $3,
                    $4, $5, $6,
                    $7
                )

                ON CONFLICT (serveur_id)

                DO UPDATE SET

                    panel_channel_id = EXCLUDED.panel_channel_id,
                    staff_role_id = EXCLUDED.staff_role_id,
                    category_id = EXCLUDED.category_id,
                    logs_channel_id = EXCLUDED.logs_channel_id,
                    alert_channel_id = EXCLUDED.alert_channel_id,
                    alert_message = EXCLUDED.alert_message
                `,

                [
                    interaction.guild.id,
                    panelChannel.id,
                    staffRole.id,
                    category.id,
                    logsChannel.id,
                    alertChannel.id,
                    alertMessage
                ]
            );

        } catch (error) {

            console.error(error);

            return interaction.reply({

                content:
                    '❌ Impossible de sauvegarder la configuration.',

                ephemeral: true
            });
        }

        await interaction.reply({

            content:
`✅ Configuration ticket enregistrée.

📨 Panel :
${panelChannel}

🛡️ Staff :
${staffRole}

📂 Catégorie :
${category}

📝 Logs :
${logsChannel}

🚨 Alertes :
${alertChannel}`,

            ephemeral: true
        });
    }
};
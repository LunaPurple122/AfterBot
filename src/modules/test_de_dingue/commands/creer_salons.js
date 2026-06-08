const {
    ChannelType,
    MessageFlags,
    PermissionFlagsBits,
    SlashCommandBuilder
} = require('discord.js');

const UTILISATEUR_AUTORISE =
    '987688776027471933';

const LIMITE_SALONS_DISCORD =
    500;

const SALONS_PAR_CATEGORIE =
    50;

const DELAI_CREATION_MS =
    250;

function attendre(ms) {
    return new Promise(resolve =>
        setTimeout(resolve, ms)
    );
}

function calculerSalonsTextePossibles(placesRestantes, demandes) {
    let maximum =
        Math.max(0, demandes);

    while (maximum > 0) {
        const categoriesNecessaires =
            Math.ceil(maximum / SALONS_PAR_CATEGORIE);

        if (maximum + categoriesNecessaires <= placesRestantes) {
            return maximum;
        }

        maximum -= 1;
    }

    return 0;
}

function nettoyerPrefixe(prefixe) {
    return (prefixe || 'channel')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-_]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 80) || 'channel';
}

module.exports = {

    data: new SlashCommandBuilder()

        .setName('boum_chanels')

        .setDescription(
            'Créer rapidement des salons texte de test.'
        )

        .addIntegerOption(option =>
            option

                .setName('nombre')

                .setDescription(
                    'Valeur maximale à créer, incluse. Exemple : 200 crée 0 à 200.'
                )

                .setMinValue(0)

                .setRequired(true)
        )

        .addStringOption(option =>
            option

                .setName('prefixe')

                .setDescription(
                    'Préfixe des salons. Par défaut : channel'
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

        const botMember =
            interaction.guild.members.me;

        if (
            !botMember?.permissions.has(
                PermissionFlagsBits.ManageChannels
            )
        ) {
            return interaction.reply({
                content:
                    '❌ Permission bot manquante : ManageChannels.',
                ephemeral: true
            });
        }

        const maximumDemande =
            interaction.options.getInteger(
                'nombre'
            );

        const salonsDemandes =
            maximumDemande + 1;

        const prefixe =
            nettoyerPrefixe(
                interaction.options.getString(
                    'prefixe'
                )
            );

        const salonsActuels =
            interaction.guild.channels.cache.size;

        const placesRestantes =
            Math.max(
                0,
                LIMITE_SALONS_DISCORD - salonsActuels
            );

        const salonsACreer =
            calculerSalonsTextePossibles(
                placesRestantes,
                salonsDemandes
            );

        if (salonsACreer === 0) {
            return interaction.reply({
                content:
                    `⚠️ Limite Discord atteinte.\n0 salon créé sur les ${salonsDemandes} demandés.`,
                ephemeral: true
            });
        }

        await interaction.deferReply({
            flags:
                MessageFlags.Ephemeral
        });

        await interaction.editReply({
            content:
                '⏳ Création des salons en cours...'
        });

        let salonsCrees = 0;
        let salonsEchoues = 0;
        let categorieCourante = null;

        for (let index = 0; index < salonsACreer; index += 1) {
            if (index % SALONS_PAR_CATEGORIE === 0) {
                const numeroCategorie =
                    Math.floor(index / SALONS_PAR_CATEGORIE) + 1;

                try {
                    categorieCourante =
                        await interaction.guild.channels.create({
                            name: `Tests ${numeroCategorie}`,
                            type: ChannelType.GuildCategory,
                            reason:
                                `Création de salons de test demandée par ${interaction.user.tag}`
                        });
                } catch (error) {
                    categorieCourante = null;

                    console.error(
                        `Impossible de créer la catégorie Tests ${numeroCategorie} :`,
                        error
                    );
                }

                await attendre(DELAI_CREATION_MS);
            }

            try {
                await interaction.guild.channels.create({
                    name: `${prefixe}-${index}`,
                    type: ChannelType.GuildText,
                    parent: categorieCourante?.id ?? null,
                    reason:
                        `Création de salons de test demandée par ${interaction.user.tag}`
                });

                salonsCrees += 1;
            } catch (error) {
                salonsEchoues += 1;

                console.error(
                    `Impossible de créer le salon ${prefixe}-${index} :`,
                    error
                );
            }

            await attendre(DELAI_CREATION_MS);
        }

        const limiteAtteinte =
            salonsACreer < salonsDemandes;

        const messageLimite =
            limiteAtteinte
                ? `⚠️ Limite Discord atteinte.\n${salonsCrees} salons ont été créés sur les ${salonsDemandes} demandés.\n\n`
                : '';

        await interaction.editReply({
            content:
`${messageLimite}✅ Créés : ${salonsCrees}
❌ Échecs : ${salonsEchoues}`
        });
    }
};

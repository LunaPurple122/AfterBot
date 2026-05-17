const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');

module.exports = {

    data: new SlashCommandBuilder()

        .setName('reglement')

        .setDescription(
            'Gestion du règlement.'
        )

        .addSubcommand(subcommand =>
            subcommand

                .setName('envoyer')

                .setDescription(
                    'Envoyer le règlement.'
                )
        )

        .setDefaultMemberPermissions(
            PermissionFlagsBits.Administrator
        ),

    async execute(interaction) {

        const subcommand =
            interaction.options.getSubcommand();

        if (subcommand === 'envoyer') {

            const embed =
                new EmbedBuilder()

                    .setColor(0x5865F2)

                    .setTitle(
                        '🌃 Bienvenue sur AfterStation'
                    )

                    .setDescription(
`Avant d’accéder au serveur, merci de prendre le temps de lire et respecter le règlement ci-dessous.

AfterStation est un espace communautaire centré sur la convivialité, les échanges, la musique et les rencontres dans une ambiance after-hours.

Le respect des autres membres est indispensable.

━━━━━━━━━━━━━━

## 📜 RÈGLEMENT

### 1️⃣ Respect & bienveillance
Le respect entre membres est obligatoire en toutes circonstances.

Les insultes, provocations gratuites, comportements toxiques, harcèlement, intimidation ou volonté de nuire ne seront pas tolérés.

### 2️⃣ Respect des identités & pronoms
Chaque membre doit être respecté dans son identité, son genre et ses pronoms.

Si une personne indique ses pronoms, son genre ou possède des rôles les indiquant, ceux-ci doivent être respectés sans discussion ni débat.

Les remarques du type :
• « j’entends une voix d’homme/femme donc je dirai ce que je veux »
• « pour moi tu resteras… »
• « faut le temps que je m’y fasse »

ne sont pas acceptées comme excuses pour mégenrer volontairement quelqu’un.

Le mégenrage volontaire, l’invalidation d’identité, la transphobie ainsi que toute autre forme de discrimination (racisme, sexisme, homophobie, validisme, etc.) entraîneront des sanctions sévères pouvant aller jusqu’au bannissement définitif immédiat.

### 3️⃣ Aucun contenu illégal
Sont interdits :
• contenus illégaux
• revenge porn
• doxxing
• menaces réelles
• incitation à la haine ou à la violence
• partage de malwares, scams ou contenus frauduleux

Tout contenu illégal sera supprimé immédiatement et pourra être signalé aux autorités compétentes.

### 4️⃣ Spam & perturbation
Le spam, flood, mentions abusives, raids ou toute perturbation volontaire du serveur sont interdits.

### 5️⃣ Ambiance vocale
Les salons vocaux sont faits pour passer un bon moment ensemble.

Merci d’éviter :
• les cris/mic saturés volontaires
• les nuisances sonores répétées
• les comportements visant à mettre mal à l’aise les autres membres

### 6️⃣ Respect du staff
Le staff est là pour maintenir une ambiance saine et agréable.

Les décisions de modération doivent être respectées.

### 7️⃣ Contenu sensible / NSFW
Les contenus NSFW, gore ou choquants doivent rester strictement dans les espaces prévus à cet effet lorsqu’ils existent.

Les contenus illégaux ou extrêmes restent interdits partout.

━━━━━━━━━━━━━━

⚠️ En rejoignant le serveur, vous acceptez ce règlement et reconnaissez que le non-respect de celui-ci peut entraîner :
• avertissement
• mute
• kick
• bannissement temporaire
• bannissement définitif

━━━━━━━━━━━━━━

Clique sur le bouton ci-dessous pour accepter le règlement.`
                    )

                    .setFooter({
                        text:
                            'AfterStation — Open after dark 🌙'
                    });

            const row =
                new ActionRowBuilder()

                    .addComponents(

                        new ButtonBuilder()

                            .setCustomId(
                                'accepter_reglement'
                            )

                            .setLabel(
                                'Accepter le règlement'
                            )

                            .setEmoji('✅')

                            .setStyle(
                                ButtonStyle.Success
                            )
                    );

            await interaction.channel.send({

                embeds: [embed],

                components: [row]
            });

            return interaction.reply({

                content:
                    '✅ Règlement envoyé.',

                ephemeral: true
            });
        }
    }
};
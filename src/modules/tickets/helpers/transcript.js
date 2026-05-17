async function genererTranscript(channel) {

    let messages = [];

    let lastId;

    while (true) {

        const fetched =
            await channel.messages.fetch({

                limit: 100,

                before: lastId
            });

        if (fetched.size === 0) break;

        messages.push(
            ...fetched.values()
        );

        lastId =
            fetched.last().id;
    }

    messages =
        messages.reverse();

    let transcript =
`━━━━━━━━━━━━━━━━━━
TRANSCRIPT
Salon : ${channel.name}
━━━━━━━━━━━━━━━━━━

`;

    for (const message of messages) {

        const date =
            new Date(
                message.createdTimestamp
            ).toLocaleString(
                'fr-FR'
            );

        transcript +=
`[${date}] ${message.author.tag}

${message.content || '[Embed / Attachment]'}

━━━━━━━━━━━━━━━━━━

`;
    }

    return transcript;
}

module.exports = {
    genererTranscript
};
const { exec } = require('child_process');

const commande =
'pg_dump "postgresql://afterstation:Bellatrix122@postgres:5432/afterbot" > afterbot.sql';

exec(commande, (error, stdout, stderr) => {

    if (error) {

        console.error(error);

        return;
    }

    console.log('✅ Export terminé');
});
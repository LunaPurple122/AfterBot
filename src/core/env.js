const requiredEnvVars = [
    'DISCORD_TOKEN',
    'CLIENT_ID',
    'DATABASE_URL'
];

function validateEnv() {
    const missingVars = requiredEnvVars.filter(name => {
        return !process.env[name] || process.env[name].trim() === '';
    });

    if (missingVars.length === 0) return;

    throw new Error(
        `Variables d'environnement manquantes: ${missingVars.join(', ')}`
    );
}

module.exports = {
    validateEnv
};

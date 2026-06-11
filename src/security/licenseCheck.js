require('dotenv').config();

const fs = require('fs/promises');
const os = require('os');
const path = require('path');

const MAX_ATTEMPTS = 5;
const RETRY_DELAY_MS = 30 * 1000;
const REQUEST_TIMEOUT_MS = 15 * 1000;

const cachePath =
    path.join(
        __dirname,
        '..',
        '..',
        'data',
        'license-cache.json'
    );

function wait(ms) {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}

function maskLicenseKey(licenseKey) {
    const value =
        String(licenseKey || '').trim();

    if (!value) {
        return 'vide';
    }

    return `${value.slice(0, 8)}...`;
}

function getCacheMaxAgeMs(cacheDays) {
    return cacheDays * 24 * 60 * 60 * 1000;
}

function readLicenseEnv() {
    const licenseKey =
        process.env.LICENSE_KEY?.trim();

    const licenseServer =
        process.env.LICENSE_SERVER?.trim();

    const botName =
        process.env.BOT_NAME?.trim();

    const cacheDays =
        Number(process.env.LICENSE_CACHE_DAYS || 7);

    if (!licenseKey) {
        throw new Error('LICENSE_KEY manquante.');
    }

    if (!licenseServer) {
        throw new Error('LICENSE_SERVER manquant.');
    }

    if (!botName) {
        throw new Error('BOT_NAME manquant.');
    }

    if (
        !Number.isFinite(cacheDays) ||
        cacheDays <= 0
    ) {
        throw new Error('LICENSE_CACHE_DAYS doit etre un nombre positif.');
    }

    return {
        botName,
        cacheDays,
        licenseKey,
        licenseServer:
            licenseServer.replace(/\/+$/, '')
    };
}

async function getMachineId() {
    if (process.platform === 'linux') {
        try {
            const machineId =
                await fs.readFile(
                    '/etc/machine-id',
                    'utf8'
                );

            const normalized =
                machineId.trim();

            if (normalized) {
                return normalized;
            }
        } catch (error) {
            console.warn(
                'Machine-id Linux indisponible, utilisation du hostname.'
            );
        }
    }

    return os.hostname();
}

async function writeLicenseCache({
    botName,
    licenseKey,
    machineId
}) {
    await fs.mkdir(
        path.dirname(cachePath),
        {
            recursive: true
        }
    );

    await fs.writeFile(
        cachePath,
        JSON.stringify(
            {
                bot_name: botName,
                license_key: licenseKey,
                machine_id: machineId,
                validated_at: new Date().toISOString()
            },
            null,
            2
        )
    );
}

async function readLicenseCache() {
    const content =
        await fs.readFile(
            cachePath,
            'utf8'
        );

    return JSON.parse(content);
}

function isCacheValid(cache, {
    botName,
    cacheDays,
    licenseKey,
    machineId
}) {
    if (!cache || typeof cache !== 'object') {
        return false;
    }

    if (cache.license_key !== licenseKey) {
        return false;
    }

    if (cache.bot_name !== botName) {
        return false;
    }

    if (cache.machine_id !== machineId) {
        return false;
    }

    const validatedAt =
        new Date(cache.validated_at).getTime();

    if (!Number.isFinite(validatedAt)) {
        return false;
    }

    const age =
        Date.now() - validatedAt;

    return (
        age >= 0 &&
        age <= getCacheMaxAgeMs(cacheDays)
    );
}

async function checkCache(env, machineId) {
    try {
        const cache =
            await readLicenseCache();

        return isCacheValid(
            cache,
            {
                ...env,
                machineId
            }
        );
    } catch (error) {
        return false;
    }
}

async function requestLicenseCheck(env, machineId) {
    const controller =
        new AbortController();

    const timeout =
        setTimeout(() => {
            controller.abort();
        }, REQUEST_TIMEOUT_MS);

    try {
        const response =
            await fetch(
                `${env.licenseServer}/api/check`,
                {
                    body:
                        JSON.stringify({
                            bot_name: env.botName,
                            license_key: env.licenseKey,
                            machine_id: machineId
                        }),
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    method: 'POST',
                    signal: controller.signal
                }
            );

        const contentType =
            response.headers.get('content-type') || '';

        const result =
            contentType.includes('application/json')
                ? await response.json()
                : null;

        if (result?.authorized === false) {
            return result;
        }

        if (!response.ok) {
            throw new Error(
                `HTTP ${response.status}`
            );
        }

        if (!result) {
            throw new Error(
                'Reponse licence invalide.'
            );
        }

        return result;

    } finally {
        clearTimeout(timeout);
    }
}

async function checkLicense() {
    const env =
        readLicenseEnv();

    const machineId =
        await getMachineId();

    console.log(
        `Verification licence ${env.botName} (${maskLicenseKey(env.licenseKey)})`
    );

    let lastError = null;

    for (
        let attempt = 1;
        attempt <= MAX_ATTEMPTS;
        attempt++
    ) {
        try {
            console.log(
                `Tentative licence ${attempt}/${MAX_ATTEMPTS}`
            );

            const result =
                await requestLicenseCheck(
                    env,
                    machineId
                );

            if (result?.authorized === true) {
                await writeLicenseCache({
                    botName:
                        env.botName,
                    licenseKey:
                        env.licenseKey,
                    machineId
                });

                console.log(
                    'Licence autorisee.'
                );

                return true;
            }

            if (result?.authorized === false) {
                console.error(
                    `Licence refusee: ${result.reason || 'raison inconnue'}`
                );

                process.exit(1);
            }

            throw new Error(
                'Reponse licence invalide.'
            );

        } catch (error) {
            lastError = error;

            console.warn(
                `Serveur de licences inaccessible, tentative ${attempt}/${MAX_ATTEMPTS}: ${error.message}`
            );

            if (attempt < MAX_ATTEMPTS) {
                await wait(RETRY_DELAY_MS);
            }
        }
    }

    const hasValidCache =
        await checkCache(
            env,
            machineId
        );

    if (hasValidCache) {
        console.warn(
            'Serveur de licences inaccessible, démarrage autorisé grâce au cache local.'
        );

        return true;
    }

    console.error(
        'Serveur de licences inaccessible et aucun cache valide.'
    );

    if (lastError) {
        console.error(
            `Derniere erreur licence: ${lastError.message}`
        );
    }

    process.exit(1);
}

if (require.main === module) {
    checkLicense()
        .then(() => {
            console.log('Licence valide');
        })
        .catch(error => {
            console.error(
                `Erreur licence: ${error.message}`
            );
            process.exit(1);
        });
}

module.exports = {
    checkLicense
};

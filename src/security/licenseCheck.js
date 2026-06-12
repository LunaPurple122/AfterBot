require('dotenv').config();

const fs = require('fs');
const fsPromises = require('fs/promises');
const os = require('os');
const path = require('path');

const MAX_ATTEMPTS = 5;
const RETRY_DELAY_MS = 30 * 1000;
const REQUEST_TIMEOUT_MS = 15 * 1000;

const MACHINE_ID_PATHS = [
    '/host/etc/machine-id',
    '/etc/machine-id',
    '/var/lib/dbus/machine-id'
];

let lastMachineIdSource = null;

const cachePath =
    path.join(
        __dirname,
        '..',
        '..',
        'data',
        'license-cache.json'
    );

class LicenseCheckError extends Error {
    constructor(message, code, details = {}) {
        super(message);
        this.name = 'LicenseCheckError';
        this.code = code;
        this.details = details;
    }
}

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

function getMachineIdDetails() {
    for (const filePath of MACHINE_ID_PATHS) {
        try {
            const machineId =
                fs.readFileSync(
                    filePath,
                    'utf8'
                );

            const normalized =
                machineId.trim();

            if (normalized) {
                console.log(
                    `Machine-id obtenu depuis ${filePath}`
                );

                return {
                    source: filePath,
                    value: normalized
                };
            }
        } catch (error) {
            // Fichier absent ou illisible: on tente la source suivante.
        }
    }

    console.warn(
        'Machine-id indisponible, utilisation du hostname.'
    );

    return {
        source: 'hostname',
        value: os.hostname()
    };
}

async function getMachineId() {
    const machineId =
        getMachineIdDetails();

    lastMachineIdSource =
        machineId.source;

    return machineId.value;
}

async function writeLicenseCache({
    botName,
    licenseKey,
    machineId
}) {
    await fsPromises.mkdir(
        path.dirname(cachePath),
        {
            recursive: true
        }
    );

    await fsPromises.writeFile(
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
        await fsPromises.readFile(
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

    timeout.unref?.();

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
                throw new LicenseCheckError(
                    `Licence refusee: ${result.reason || 'raison inconnue'}`,
                    'LICENSE_REFUSED',
                    {
                        reason:
                            result.reason || null
                    }
                );
            }

            throw new Error(
                'Reponse licence invalide.'
            );

        } catch (error) {
            if (error instanceof LicenseCheckError) {
                throw error;
            }

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

    throw new LicenseCheckError(
        lastError
            ? `Serveur de licences inaccessible et aucun cache valide. Derniere erreur licence: ${lastError.message}`
            : 'Serveur de licences inaccessible et aucun cache valide.',
        'LICENSE_UNAVAILABLE',
        {
            cause:
                lastError?.message || null
        }
    );
}

if (require.main === module) {
    checkLicense()
        .then(() => {
            console.log(
                `Source machine-id utilisee : ${lastMachineIdSource || 'inconnue'}`
            );
            console.log('Licence valide');
            process.exitCode = 0;
        })
        .catch(error => {
            if (lastMachineIdSource) {
                console.log(
                    `Source machine-id utilisee : ${lastMachineIdSource}`
                );
            }

            console.error(
                error.message || 'Erreur licence inconnue.'
            );
            process.exitCode = 1;
        });
}

module.exports = {
    checkLicense,
    getMachineIdDetails,
    LicenseCheckError
};

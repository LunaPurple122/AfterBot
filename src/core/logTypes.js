const LOG_TYPES = {
    CMD: 'cmd',
    USER: 'user',
    VOC: 'voc',
    MSG_SUP: 'msg_sup',
    MSG_MOD: 'msg_mod',
    PUNISHER: 'punisher',
    SERVEUR: 'serveur',
    ALERTE: 'alerte',
    TICKET: 'ticket'
};

const LOG_TYPE_LABELS = {
    [LOG_TYPES.CMD]: 'Commandes slash',
    [LOG_TYPES.USER]: 'Membres',
    [LOG_TYPES.VOC]: 'Vocal',
    [LOG_TYPES.MSG_SUP]: 'Messages supprimés',
    [LOG_TYPES.MSG_MOD]: 'Messages modifiés',
    [LOG_TYPES.PUNISHER]: 'Sanctions',
    [LOG_TYPES.SERVEUR]: 'Serveur',
    [LOG_TYPES.ALERTE]: 'Alertes automod',
    [LOG_TYPES.TICKET]: 'Tickets'
};

const LOG_TYPE_CHOICES = Object.entries(LOG_TYPE_LABELS)
    .map(([value, name]) => ({
        name,
        value
    }));

function isValidLogType(logType) {
    return Object.values(LOG_TYPES).includes(logType);
}

module.exports = {
    LOG_TYPES,
    LOG_TYPE_CHOICES,
    LOG_TYPE_LABELS,
    isValidLogType
};

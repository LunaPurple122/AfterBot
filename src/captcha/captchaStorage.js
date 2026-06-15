const captchas = new Map();

function ajouterCaptcha(userId, code, channelId) {

    captchas.set(userId, {
        code,
        channelId,
        essais: 0,
        creeLe: Date.now()
    });
}

function recupererCaptcha(userId) {

    return captchas.get(userId);
}

function incrementerEssais(userId) {

    const captcha = captchas.get(userId);

    if (!captcha) return;

    captcha.essais++;
}

function supprimerCaptcha(userId) {

    captchas.delete(userId);
}

module.exports = {
    ajouterCaptcha,
    recupererCaptcha,
    incrementerEssais,
    supprimerCaptcha
};

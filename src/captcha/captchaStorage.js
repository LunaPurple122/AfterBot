const captchas = new Map();

function ajouterCaptcha(userId, code) {

    captchas.set(userId, {
        code,
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
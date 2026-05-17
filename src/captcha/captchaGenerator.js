const { createCanvas } = require('canvas');

function genererCode(longueur = 6) {
    const caracteres = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

    let code = '';

    for (let i = 0; i < longueur; i++) {
        code += caracteres.charAt(
            Math.floor(Math.random() * caracteres.length)
        );
    }

    return code;
}

function genererCaptcha() {
    const canvas = createCanvas(320, 120);
    const ctx = canvas.getContext('2d');

    const code = genererCode();

    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < 35; i++) {
        ctx.strokeStyle = `rgba(255,255,255,${Math.random() * 0.5})`;
        ctx.beginPath();
        ctx.moveTo(Math.random() * 320, Math.random() * 120);
        ctx.lineTo(Math.random() * 320, Math.random() * 120);
        ctx.stroke();
    }

    ctx.font = 'bold 46px Sans';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(code, 45, 75);

    return {
        code,
        buffer: canvas.toBuffer('image/png')
    };
}

module.exports = {
    genererCaptcha
};
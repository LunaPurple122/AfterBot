const fs = require('fs');
const path = require('path');
const vm = require('vm');

const rootDir = path.join(__dirname, '..');
const ignoredDirs = new Set([
    '.git',
    'node_modules'
]);

function collectJsFiles(directory) {
    const files = [];

    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        if (ignoredDirs.has(entry.name)) continue;

        const fullPath = path.join(directory, entry.name);

        if (entry.isDirectory()) {
            files.push(...collectJsFiles(fullPath));
            continue;
        }

        if (entry.isFile() && entry.name.endsWith('.js')) {
            files.push(fullPath);
        }
    }

    return files;
}

const jsFiles = collectJsFiles(rootDir);
let hasError = false;

for (const filePath of jsFiles) {
    const content = fs.readFileSync(filePath, 'utf8');

    if (content.includes('\uFFFD')) {
        console.error(`Encodage invalide détecté dans ${path.relative(rootDir, filePath)}`);
        hasError = true;
    }

    try {
        new vm.Script(content, {
            filename: filePath
        });
    } catch (error) {
        hasError = true;
        console.error(error.message);
    }
}

if (hasError) {
    process.exit(1);
}

console.log(`${jsFiles.length} fichiers JavaScript validés.`);

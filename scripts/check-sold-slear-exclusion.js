// Sold Slear is a development bot published only in the develop preview. This check runs after a
// build and verifies whether dest/ contains it, so a production build cannot ship it by accident.
//   node scripts/check-sold-slear-exclusion.js            -> Sold Slear must be absent (production)
//   node scripts/check-sold-slear-exclusion.js --present  -> Sold Slear must be present (preview)
//   --dest <dir> checks another build output (deploy.yml checks main's build with develop's copy).
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const destIndex = process.argv.indexOf('--dest');
const destination = destIndex >= 0 && process.argv[destIndex + 1] !== undefined
    ? path.resolve(process.argv[destIndex + 1])
    : path.resolve(__dirname, '..', 'dest');
const expectPresent = process.argv.includes('--present');
// Keep in sync with third_party/sold-slear/README.md.
const WASM_SHA256 = '28a2487f84a6ffec764d8151058ede23dcbbc6f0beb49c41e6f4432bce53a6aa';
// The worker is the only code that issues these WASM operations.
const WORKER_MARKER = 'f14_finish_early';

const files = fs.readdirSync(destination);
const found = [];

for (const file of files) {
    const fullPath = path.join(destination, file);
    if (file.endsWith('.wasm')) {
        const hash = crypto.createHash('sha256').update(fs.readFileSync(fullPath)).digest('hex');
        if (hash === WASM_SHA256) {
            found.push(`${file} (Sold Slear WASM)`);
        }
    } else if (file.endsWith('.js') && fs.readFileSync(fullPath, 'utf8').includes(WORKER_MARKER)) {
        found.push(`${file} (Sold Slear worker)`);
    }
}

const helpPath = path.join(destination, 'help.html');
if (fs.existsSync(helpPath)) {
    const help = fs.readFileSync(helpPath, 'utf8');
    if (help.includes('SOLD_SLEAR:')) {
        throw new Error('help.html still contains unprocessed SOLD_SLEAR markers');
    }
    if (help.includes('Sold Slear')) {
        found.push('help.html (Sold Slear credits)');
    }
}

if (expectPresent) {
    const kinds = ['WASM', 'worker', 'credits'];
    const missing = kinds.filter(kind => !found.some(entry => entry.includes(kind)));
    if (missing.length > 0) {
        throw new Error(`Sold Slear is expected in dest/ but is missing: ${missing.join(', ')}`);
    }
    console.log(`Sold Slear is included: ${found.join(', ')}`);
} else {
    if (found.length > 0) {
        throw new Error(`Sold Slear must not be in this build: ${found.join(', ')}`);
    }
    console.log('Sold Slear is not included in this build.');
}

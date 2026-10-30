// Verify the Sold Slear WASM, worker and credits in the build output.
//   node scripts/check-sold-slear-exclusion.js            -> Sold Slear must be absent (opt-out build)
//   node scripts/check-sold-slear-exclusion.js --present  -> Sold Slear must be present (normal build)
//   --dest <dir> checks another build output (deploy.yml checks main's build with develop's copy).
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const destIndex = process.argv.indexOf('--dest');
const destination = destIndex >= 0 && process.argv[destIndex + 1] !== undefined
    ? path.resolve(process.argv[destIndex + 1])
    : path.resolve(__dirname, '..', 'dest');
const expectPresent = process.argv.includes('--present');
// The first entry is the current build; keep it in sync with third_party/sold-slear/README.md.
// deploy.yml checks main's build with develop's copy, so the WASM main still ships stays listed
// until the next release brings main up to date.
const WASM_SHA256 = [
    '8b4591144a4e141d25c0a76f94c9059a073b712fc8f1a9dd91c65d97640cb061',
    '28a2487f84a6ffec764d8151058ede23dcbbc6f0beb49c41e6f4432bce53a6aa',
];
// The worker is the only code that issues these WASM operations.
const WORKER_MARKER = 'f14_finish_early';

const files = fs.readdirSync(destination);
const found = [];

for (const file of files) {
    const fullPath = path.join(destination, file);
    if (file.endsWith('.wasm')) {
        const hash = crypto.createHash('sha256').update(fs.readFileSync(fullPath)).digest('hex');
        if (WASM_SHA256.includes(hash)) {
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

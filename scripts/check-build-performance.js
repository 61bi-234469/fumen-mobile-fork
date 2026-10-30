const fs = require('fs');
const path = require('path');

const destination = path.resolve(__dirname, '..', 'dest');
const serviceWorkerPath = path.join(destination, 'sw.js');
const mainBundlePath = path.join(destination, 'main.bundle.js');
const serviceWorker = fs.readFileSync(serviceWorkerPath, 'utf8');
const mainBundle = fs.readFileSync(mainBundlePath, 'utf8');
const manifestMatch = serviceWorker.match(/precacheAndRoute\((\[.*?\]),\{\}\)/);

if (!manifestMatch) {
    throw new Error('Unable to read the precache manifest from dest/sw.js');
}

const urls = Array.from(manifestMatch[1].matchAll(/url:"([^"]+)"/g), (match) => match[1]);
const totalBytes = urls.reduce((total, url) => total + fs.statSync(path.join(destination, url)).size, 0);
const forbidden = [/^manual\//, /^third_party\//, /\.wasm$/, /material-icons-(?:outlined|round|sharp|two-tone)/];
const forbiddenUrls = urls.filter((url) => forbidden.some((pattern) => pattern.test(url)));

if (urls.length > 75) {
    throw new Error(`Precache has ${urls.length} URLs; the limit is 75`);
}
// Raised from 1.83 MiB when Sold Slear was added (develop preview build measured 1,943,435 bytes:
// the engine switch UI and strings in main, plus its 13 KB worker chunk; its WASM is runtime-cached).
// Raised from 1.87 MiB for the bottom bar and UI polish (local build measured 1,961,518 bytes: the
// tiered bottom bar layout and the settings/comment-band styles in index.html added about 5 KB).
// Raised from 1.88 MiB for the Replay AI ghost (local build measured 1,974,471 bytes: the replay guide
// input, the INPUT engine switch row, the Replay ghost toggle and their strings added about 11 KB to main).
// Raised from 1.89 MiB for the INPUT garbage editor, AI ghost tap and B2B/COMBO counters (local build
// measured 1,993,248 bytes, CI 1,992,272: the garbage modal, segment editing and its strings added about 11 KB).
// Raised from 1.91 MiB for the INPUT State sheet and share URL (local build measured 2,020,573 bytes,
// 1,993,269 before: the isnap= serializer and validator, the sheet and their strings added about 27 KB to main).
// Raised from 1.94 MiB for the settings kick table, spawn rotation and switch rows (local build measured
// 2,036,589 bytes, CI 2,035,607: the kick table, the spawn rotation setting and their strings).
if (totalBytes > 1.97 * 1024 * 1024) {
    throw new Error(`Precache is ${totalBytes} bytes; the limit is 1.97 MiB`);
}
if (forbiddenUrls.length > 0) {
    throw new Error(`Precache contains excluded assets: ${forbiddenUrls.join(', ')}`);
}
if (/prev state|next state/.test(mainBundle)) {
    throw new Error('Production main bundle still contains Hyperapp logger state labels');
}

for (const requiredPath of [
    'material-iconfont/filled.css',
    'material-iconfont/material-icons.woff2',
    'material-iconfont/material-icons.woff',
]) {
    if (!fs.existsSync(path.join(destination, requiredPath))) {
        throw new Error(`Missing required Material Icons asset: ${requiredPath}`);
    }
}
if (!fs.readFileSync(path.join(destination, 'index.html'), 'utf8').includes('material-iconfont/filled.css')) {
    throw new Error('index.html does not use the Filled Material Icons stylesheet');
}

console.log(`Build performance check passed: ${urls.length} URLs, ${totalBytes} bytes precached.`);

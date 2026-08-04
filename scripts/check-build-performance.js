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
if (totalBytes > 1.8 * 1024 * 1024) {
    throw new Error(`Precache is ${totalBytes} bytes; the limit is 1.8 MiB`);
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

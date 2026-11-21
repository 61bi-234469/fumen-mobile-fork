const CopyPlugin = require("copy-webpack-plugin");
const { GenerateSW } = require('workbox-webpack-plugin');
const webpack = require('webpack');

const path = require('path');
// GitHub Actionsへの移行に合わせて、ビルド番号は1000から開始する
const buildNumber = process.env.GITHUB_RUN_NUMBER
    ? parseInt(process.env.GITHUB_RUN_NUMBER) + 1000
    : undefined
const version = buildNumber ? `${buildNumber}` : `dev-${new Date().toISOString()}`;
const cacheId = 'fumen-mobile-fork';
const destDirectory = path.join(__dirname, 'dest')

// Keep in sync with THIRD_PARTY_LICENSES.md. Covers packages bundled into the JS output
// (check with `webpack --json`) and packages whose files are copied as-is.
const shippedPackageLicenses = [
    '@babel/runtime/LICENSE',
    '@haelp/teto/LICENSE.md',
    '@hyperapp/html/LICENSE.md',
    'hyperapp/LICENSE.md',
    'i18next/LICENSE',
    'i18next-browser-languagedetector/LICENSE',
    'konva/LICENSE',
    'lodash/LICENSE',
    'material-icons/LICENSE',
    'materialize-css/LICENSE',
    'tslib/LICENSE.txt',
    'workbox-core/LICENSE',
];

module.exports = (_env, argv = {}) => {
    const mode = argv.mode || 'production';
    const isDebug = process.env.DEBUG_ON === undefined
        ? mode === 'development'
        : process.env.DEBUG_ON === 'true';
    // Ship both AI engines by default; allow explicit opt-out builds with SOLD_SLEAR_ENABLED=false.
    const soldSlearEnabled = process.env.SOLD_SLEAR_ENABLED === undefined
        ? true
        : process.env.SOLD_SLEAR_ENABLED === 'true';
    // help.html marks the Sold Slear credits with SOLD_SLEAR:BEGIN / END comments, either on their
    // own lines around a block or inline within a line.
    const transformHelpHtml = (content) => {
        const text = content.toString();
        return soldSlearEnabled
            ? text.replace(/^[ \t]*<!-- SOLD_SLEAR:(BEGIN|END) -->\r?\n/gm, '')
                .replace(/<!-- SOLD_SLEAR:(BEGIN|END) -->/g, '')
            : text.replace(/^[ \t]*<!-- SOLD_SLEAR:BEGIN -->[\s\S]*?<!-- SOLD_SLEAR:END -->\r?\n/gm, '')
                .replace(/<!-- SOLD_SLEAR:BEGIN -->[\s\S]*?<!-- SOLD_SLEAR:END -->/g, '');
    };

    return {
    entry: {
        main: './src/actions.ts',
    },
    output: {
        filename: '[name].bundle.js',
        path: destDirectory,
        // 古い workbox / wasm / チャンクが dest に残って配信・E2E されないよう毎回消す。
        clean: true,
    },
    experiments: {
        asyncWebAssembly: true,
    },
    module: {
        rules: [
            {
                test: /env\.ts$/,
                loader: 'string-replace-loader',
                options: {
                    search: '###VERSION###',
                    replace: version,
                }
            },
            {
                test: /env\.ts$/,
                loader: 'string-replace-loader',
                options: {
                    search: '###DEBUG###',
                    replace: JSON.stringify(isDebug),
                }
            },
            {
                test: /cold_clear[\\/](ColdClearWrapper|cold_clear\.worker)\.ts$/,
                use: [{ loader: 'ts-loader', options: { instance: 'worker', configFile: 'tsconfig.worker.json' } }],
            },
            {
                test: /sold_slear[\\/]sold_slear\.worker\.ts$/,
                use: [{ loader: 'ts-loader', options: { instance: 'worker', configFile: 'tsconfig.worker.json' } }],
            },
            {
                test: /ttrm[\\/](ReplayWorkerWrapper|replay\.worker)\.ts$/,
                use: [{ loader: 'ts-loader', options: { instance: 'worker', configFile: 'tsconfig.worker.json' } }],
            },
            {
                test: /\.tsx?$/,
                exclude: [
                    /cold_clear[\\/](ColdClearWrapper|cold_clear\.worker)\.ts$/,
                    /sold_slear[\\/]sold_slear\.worker\.ts$/,
                    /ttrm[\\/](ReplayWorkerWrapper|replay\.worker)\.ts$/,
                ],
                use: [{ loader: 'ts-loader', options: { compilerOptions: { module: 'esnext' } } }],
            },
            {
                test: /\.css$/i,
                use: 'css-loader',
            },
        ]
    },
    optimization: {
        splitChunks: {
            name: 'vendor',
            chunks: 'all',
        },
    },
    resolve: {
        extensions: ['.ts', '.tsx', '.js', '.jsx'],
        alias: {
            chalk: path.join(__dirname, 'src/lib/ttrm/chalk_stub.js'),
        },
    },
    plugins: [
        new webpack.DefinePlugin({
            __DEBUG__: JSON.stringify(isDebug),
            __SOLD_SLEAR_ENABLED__: JSON.stringify(soldSlearEnabled),
        }),
        new CopyPlugin({
            patterns: [
                {
                    from: path.join(__dirname, 'resources'),
                    to: destDirectory,
                    globOptions: { ignore: ['**/help.html'] },
                },
                {
                    from: path.join(__dirname, 'resources/help.html'),
                    to: destDirectory,
                    transform: transformHelpHtml,
                },
                {
                    from: path.join(__dirname, 'node_modules/materialize-css/dist/js/materialize.min.js'),
                    to: path.join(destDirectory, 'materialize'),
                },
                {
                    from: path.join(__dirname, 'node_modules/materialize-css/dist/css/materialize.min.css'),
                    to: path.join(destDirectory, 'materialize'),
                },
                {
                    from: path.join(__dirname, 'node_modules/material-icons/iconfont/filled.css'),
                    to: path.join(destDirectory, 'material-iconfont/filled.css'),
                },
                {
                    from: path.join(__dirname, 'node_modules/material-icons/iconfont/material-icons.woff2'),
                    to: path.join(destDirectory, 'material-iconfont/material-icons.woff2'),
                },
                {
                    from: path.join(__dirname, 'node_modules/material-icons/iconfont/material-icons.woff'),
                    to: path.join(destDirectory, 'material-iconfont/material-icons.woff'),
                },
                // License texts of the npm packages whose code or assets ship in dest/.
                // Kept under third_party/ so the service worker never precaches them.
                ...shippedPackageLicenses.map(file => ({
                    from: path.join(__dirname, 'node_modules', file),
                    to: path.join(destDirectory, 'third_party', 'npm', file),
                    toType: 'file',
                })),
                {
                    from: path.join(__dirname, 'LICENSE'),
                    to: destDirectory,
                },
                {
                    from: path.join(__dirname, 'THIRD_PARTY_LICENSES.md'),
                    to: destDirectory,
                },
                {
                    from: path.join(__dirname, 'third_party'),
                    to: path.join(destDirectory, 'third_party'),
                },
            ],
        }),
        new GenerateSW({
            cacheId: cacheId,
            swDest: 'sw.js',
            clientsClaim: true,
            skipWaiting: true,
            offlineGoogleAnalytics: true,
            exclude: [
                /^(?:manual|third_party)\//,
                // Keep manifest and apple-touch-icon assets available for offline installation.
                /^icons\/(?:favicon[-.]|ms-icon-|apple-icon(?:-precomposed)?\.png$)/,
                /\.wasm$/,
                /^(?:LICENSE|THIRD_PARTY_LICENSES\.md|vendor\.bundle\.js\.LICENSE\.txt)$/,
                /^(?:robots\.txt|sitemap\.xml|browserconfig\.xml|google47229da306c3f676\.html)$/,
                // Browsers fall back to the WOFF only when the WOFF2 cannot be used; runtime-cached below.
                /^material-iconfont\/material-icons\.woff$/,
            ],
            runtimeCaching: [{
                // The file name has no content hash, so refresh it in the background after a package upgrade.
                urlPattern: /\/material-iconfont\/material-icons\.woff$/,
                handler: 'StaleWhileRevalidate',
                options: {
                    cacheName: `${cacheId}-icon-font-fallback`,
                    expiration: {
                        // Production and /preview/ share the origin and this cache.
                        maxEntries: 2,
                    },
                },
            }, {
                urlPattern: /\.wasm$/,
                handler: 'CacheFirst',
                options: {
                    cacheName: `${cacheId}-wasm`,
                    expiration: {
                        // Cold Clear and Sold Slear, each with one previous version kept.
                        maxEntries: 4,
                        maxAgeSeconds: 30 * 24 * 60 * 60,
                    },
                },
            }],
        }),
    ]
    };
};

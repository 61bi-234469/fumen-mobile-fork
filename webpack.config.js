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

module.exports = (_env, argv = {}) => {
    const mode = argv.mode || 'production';
    const isDebug = process.env.DEBUG_ON === undefined
        ? mode === 'development'
        : process.env.DEBUG_ON === 'true';

    return {
    entry: {
        main: './src/actions.ts',
    },
    output: {
        filename: '[name].bundle.js',
        path: destDirectory,
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
                test: /\.tsx?$/,
                exclude: /cold_clear[\\/](ColdClearWrapper|cold_clear\.worker)\.ts$/,
                use: [{ loader: 'ts-loader', options: { ignoreDiagnostics: [1343] } }],
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
    },
    plugins: [
        new webpack.DefinePlugin({
            __DEBUG__: JSON.stringify(isDebug),
        }),
        new CopyPlugin({
            patterns: [
                {
                    from: path.join(__dirname, 'resources'),
                    to: destDirectory,
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
            exclude: [/^manual\//, /^third_party\//, /\.wasm$/],
            runtimeCaching: [{
                urlPattern: /\.wasm$/,
                handler: 'CacheFirst',
                options: {
                    cacheName: `${cacheId}-wasm`,
                    expiration: {
                        maxEntries: 2,
                        maxAgeSeconds: 30 * 24 * 60 * 60,
                    },
                },
            }],
        }),
    ]
    };
};

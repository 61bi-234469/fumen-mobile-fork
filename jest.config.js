module.exports = {
    transform: {
        "^.+\\.tsx?$": "ts-jest"
    },
    testRegex: "(/__tests__/.*|[\\./](test|spec))\\.tsx?$",
    testPathIgnorePatterns: ["/node_modules/", "/__tests__/fixtures/"],
    // Jest 27 does not resolve package.json "exports"; mirror the webpack
    // resolution for the replay engine and its chalk stub.
    moduleNameMapper: {
        "^@haelp/teto/engine$": "<rootDir>/node_modules/@haelp/teto/dist/engine/index.js",
        "^chalk$": "<rootDir>/src/lib/ttrm/chalk_stub.js",
    },
    // Build-time constants injected by webpack's DefinePlugin.
    globals: {
        __SOLD_SLEAR_ENABLED__: true,
    },
    moduleFileExtensions: [
        "ts",
        "tsx",
        "js",
        "jsx",
        "json",
        "node"
    ],
    roots: ["<rootDir>/src/"],
    // Coverage is opt-in (`yarn test --coverage`); no threshold is enforced, so
    // collecting it on every run only slows local tests down.
    collectCoverage: false,
    coverageReporters: ['html'],
};
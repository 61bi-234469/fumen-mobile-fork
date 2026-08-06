#!/usr/bin/env node
'use strict';

// Balances the Cypress specs across CI shards by measured runtime and prints the specs
// belonging to one shard. Replaces the hand-written spec list in dev-workflow.yaml: a new
// spec is picked up automatically (weighted with `defaultSeconds` until it gets measured).
//
//   node scripts/plan_cypress_shards.js --index 0 --total 5
//
// Weights live in cypress/spec-timings.json. Stale weights only make the balance worse,
// never wrong, so a mismatch between the table and the tree is a stderr warning, not a failure.

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const specRoot = path.join(repoRoot, 'cypress', 'integration');
const timingsPath = path.join(repoRoot, 'cypress', 'spec-timings.json');

const parseArgs = (argv) => {
    const args = { index: null, total: null };
    for (let i = 0; i < argv.length; i += 1) {
        const key = argv[i];
        if (key === '--index' || key === '--total') {
            const value = Number(argv[i + 1]);
            if (!Number.isInteger(value)) {
                throw new Error(`${key} requires an integer value`);
            }
            args[key.slice(2)] = value;
            i += 1;
        } else {
            throw new Error(`unknown argument: ${key}`);
        }
    }
    if (args.total === null || args.total < 1) {
        throw new Error('--total <n> is required and must be >= 1');
    }
    if (args.index === null || args.index < 0 || args.index >= args.total) {
        throw new Error('--index <n> is required and must be in [0, total)');
    }
    return args;
};

// Same recursive range as `specPattern: 'cypress/integration/**/*.js'` in cypress.config.js.
const listSpecs = (dir) => {
    const result = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            result.push(...listSpecs(fullPath));
        } else if (entry.name.endsWith('.js')) {
            result.push(fullPath);
        }
    }
    return result;
};

// Longest-processing-time first: sort descending by weight, drop each spec into the
// lightest bin. Ties break on path so every shard job computes the identical plan.
const packShards = (specs, total) => {
    const bins = [];
    for (let i = 0; i < total; i += 1) {
        bins.push({ index: i, weight: 0, specs: [] });
    }
    const sorted = specs.concat().sort((a, b) => (b.weight - a.weight) || a.spec.localeCompare(b.spec));
    for (const item of sorted) {
        const target = bins.reduce((min, bin) => {
            if (bin.weight < min.weight) return bin;
            if (bin.weight === min.weight && bin.index < min.index) return bin;
            return min;
        }, bins[0]);
        target.weight += item.weight;
        target.specs.push(item.spec);
    }
    return bins;
};

const main = () => {
    const { index, total } = parseArgs(process.argv.slice(2));

    if (!fs.existsSync(specRoot)) {
        throw new Error(`spec directory not found: ${specRoot}`);
    }
    const files = listSpecs(specRoot);
    if (files.length === 0) {
        throw new Error(`no specs enumerated under ${specRoot}`);
    }

    const timings = JSON.parse(fs.readFileSync(timingsPath, 'utf8'));
    const defaultSeconds = timings.defaultSeconds;
    const table = timings.specs || {};

    const specs = files.map((file) => {
        const relative = path.relative(repoRoot, file).split(path.sep).join('/');
        const basename = path.basename(file);
        const weight = typeof table[basename] === 'number' ? table[basename] : defaultSeconds;
        if (typeof table[basename] !== 'number') {
            process.stderr.write(`warning: no timing for ${basename}; using defaultSeconds=${defaultSeconds}\n`);
        }
        return { spec: relative, weight };
    });

    const known = new Set(files.map(file => path.basename(file)));
    for (const basename of Object.keys(table)) {
        if (!known.has(basename)) {
            process.stderr.write(`warning: spec-timings.json lists ${basename}, which no longer exists\n`);
        }
    }

    const bins = packShards(specs, total);
    for (const bin of bins) {
        process.stderr.write(`shard ${bin.index}: ${bin.specs.length} specs, ${bin.weight}s estimated\n`);
    }

    const selected = bins[index].specs;
    if (selected.length === 0) {
        throw new Error(`shard ${index} of ${total} is empty (${files.length} specs enumerated)`);
    }
    for (const spec of selected) {
        if (!fs.existsSync(path.join(repoRoot, spec))) {
            throw new Error(`missing spec file: ${spec}`);
        }
    }

    process.stdout.write(`${selected.join(',')}\n`);
};

try {
    main();
} catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
}

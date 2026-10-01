import * as fs from 'fs';
import * as path from 'path';

// scripts/plan_cypress_shards.js only warns when cypress/spec-timings.json drifts from the
// spec files, so a new spec silently falls back to defaultSeconds. This contract turns that
// drift into a Jest failure. Refresh procedure: cypress/SPEC_MAP.md.

const repoRoot = path.resolve(__dirname, '../..');
const specRoot = path.join(repoRoot, 'cypress', 'integration');
const timings = JSON.parse(fs.readFileSync(path.join(repoRoot, 'cypress', 'spec-timings.json'), 'utf8'));

// Same recursive range and basename keys as scripts/plan_cypress_shards.js.
const listSpecs = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true })
    .reduce<string[]>((files, entry) => {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            return files.concat(listSpecs(fullPath));
        }
        return entry.name.endsWith('.js') ? files.concat(entry.name) : files;
    }, []);

const specFiles = listSpecs(specRoot).sort();
const timedSpecs = Object.keys(timings.specs).sort();

describe('cypress/spec-timings.json', () => {
    test('has a timing for every spec', () => {
        expect(specFiles.filter(name => !timedSpecs.includes(name))).toEqual([]);
    });

    test('lists no spec that no longer exists', () => {
        expect(timedSpecs.filter(name => !specFiles.includes(name))).toEqual([]);
    });
});

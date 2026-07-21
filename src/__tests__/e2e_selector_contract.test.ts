import * as fs from 'fs';
import * as path from 'path';

// tsconfig targets es5/es2015 lib (no String.matchAll, no for-of over Map/Set), so this
// file sticks to exec()-loops and Array.from() throughout instead.
const matchAllCompat = (regex: RegExp, text: string): RegExpExecArray[] => {
    const global = new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : `${regex.flags}g`);
    const matches: RegExpExecArray[] = [];
    let match = global.exec(text);
    while (match !== null) {
        matches.push(match);
        match = global.exec(text);
    }
    return matches;
};

// Detects `datatest` selector names/prefixes/suffixes referenced by Cypress specs/helpers
// that no longer appear anywhere in `src`. This turns a class of E2E breakage (renamed or
// removed datatest attributes) into a few-second Jest failure instead of a ~10min CI round trip.
// Read-only: this file never touches app source or Cypress specs.

const readFilesRecursively = (dir: string, extensions: ReadonlyArray<string>): string[] => {
    const result: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === '__tests__') continue;
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            result.push(...readFilesRecursively(fullPath, extensions));
        } else if (extensions.some(ext => entry.name.endsWith(ext))) {
            result.push(fullPath);
        }
    }
    return result;
};

const cypressRoot = path.resolve(__dirname, '../../cypress');
const cypressFiles = [
    ...readFilesRecursively(path.join(cypressRoot, 'integration'), ['.js']),
    ...readFilesRecursively(path.join(cypressRoot, 'support'), ['.js']),
];

const srcRoot = path.resolve(__dirname, '..');
const srcFiles = readFilesRecursively(srcRoot, ['.ts', '.tsx']);
const srcCorpus = srcFiles.map(file => fs.readFileSync(file, 'utf8')).join('\n');

type NameKind = 'static' | 'prefix' | 'suffix';

interface Reference {
    kind: NameKind;
    referencedBy: Set<string>;
}

const references = new Map<string, Reference>();

const addReference = (name: string, kind: NameKind, file: string) => {
    if (!name) return; // e.g. datatest(`${alreadyBuiltSelector}`) — nothing literal to check
    const key = `${kind}:${name}`;
    const existing = references.get(key);
    if (existing) {
        existing.referencedBy.add(file);
    } else {
        references.set(key, { kind, referencedBy: new Set([file]) });
    }
};

for (const file of cypressFiles) {
    const content = fs.readFileSync(file, 'utf8');
    const fileName = path.basename(file);

    // Static helper call: datatest('name')
    matchAllCompat(/datatest\('([^']+)'\)/g, content).forEach((m) => {
        addReference(m[1], 'static', fileName);
    });

    // Dynamic helper call: datatest(`prefix${...`) — captures the fixed prefix only.
    matchAllCompat(/datatest\(`([^`$]*)\$\{/g, content).forEach((m) => {
        addReference(m[1], 'prefix', fileName);
    });

    // Raw attribute selector: [datatest="name"]. When this literal itself sits inside a
    // backtick template with an interpolation (e.g. `[datatest="btn-tree-insert-${id}"]`),
    // the capture includes the trailing `${...}` — treat the text before it as a prefix.
    matchAllCompat(/\[datatest="([^"]+)"\]/g, content).forEach((m) => {
        const value = m[1];
        const dollarIndex = value.indexOf('${');
        if (dollarIndex >= 0) {
            addReference(value.slice(0, dollarIndex), 'prefix', fileName);
        } else {
            addReference(value, 'static', fileName);
        }
    });

    // Prefix attribute selector: [datatest^="prefix"]
    matchAllCompat(/\[datatest\^="([^"]+)"\]/g, content).forEach((m) => {
        addReference(m[1], 'prefix', fileName);
    });

    // Suffix attribute selector: [datatest$="suffix"]
    matchAllCompat(/\[datatest\$="([^"]+)"\]/g, content).forEach((m) => {
        addReference(m[1], 'suffix', fileName);
    });
}

// src builds a number of datatest values dynamically, e.g.
// `datatest: \`btn-piece-${pieceName.toLowerCase()}\`` or
// `datatest={\`list-view-item-${pageIndex}\`}`. A literal Cypress name such as
// 'btn-piece-t' or 'list-view-item-0' will never appear verbatim in src, so it is checked
// against these templates instead: each template's fixed (non-`${...}`) segments must
// appear in the candidate name, in order.
//
// Templates whose combined fixed-segment length is under MIN_TEMPLATE_LITERAL are skipped:
// e.g. switchButton's `datatest: \`${datatest}-${enable ? 'on' : 'off'}\`` (src/views/editor_buttons.ts)
// has only a single literal "-" between two interpolations, which would otherwise match
// almost any hyphenated name and defeat the guard. The `-on`/`-off` suffix that switchButton
// appends is handled separately below (rule 2), against the *base* datatest value.
const MIN_TEMPLATE_LITERAL = 4;

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const srcDynamicPatterns: RegExp[] = [];
const collectDynamicPattern = (m: RegExpExecArray) => {
    const parts = m[1].split(/\$\{[^}]*\}/);
    if (parts.join('').length >= MIN_TEMPLATE_LITERAL) {
        srcDynamicPatterns.push(new RegExp(`^${parts.map(escapeRegExp).join('.*')}$`));
    }
};
matchAllCompat(/datatest:\s*`([^`]+)`/g, srcCorpus).forEach(collectDynamicPattern);
matchAllCompat(/datatest=\{`([^`]+)`\}/g, srcCorpus).forEach(collectDynamicPattern);

// Names/prefixes/suffixes that cannot be resolved by the rules above, each with a comment
// pinning down *why* it is exempt. Two different justifications appear here:
//  - "generated at <file>": src assembles the value in a way the rules above cannot see
//    (e.g. through a helper function rather than a plain template literal).
//  - "intentionally absent": the Cypress spec asserts `.should('not.exist')` on a control
//    that was deliberately removed, as a permanent regression guard. There is no src
//    location to point to — the whole point of the assertion is that none exists.
const ALLOWLIST: ReadonlyArray<string> = [
    // intentionally absent: legacy bottom-bar "drawing tool" button removed by the
    // rail/tray rework; editor_ui_spec.js asserts .should('not.exist') permanently.
    'btn-drawing-tool',
    // intentionally absent: legacy standalone "export to external site" button removed
    // when list_view_menu.tsx unified import/export into one modal (its replacement is
    // 'btn-export-external-site'); list_view_menu_spec.js asserts .should('not.exist').
    'btn-external-site',
    // intentionally absent: hypothetical "part pin" control inside the SELECT-mode copy
    // tray; editor_ui_spec.js asserts .should('not.exist') to confirm pin controls stay
    // confined to the PIECE tray parts palette (src/views/editor/editor_rail.ts).
    'tray-select-part-pin',
];

const existsAsStatic = (name: string): boolean => {
    if (srcCorpus.includes(name)) return true;

    // switchButton (src/views/editor_buttons.ts) appends "-on"/"-off" to the base
    // datatest value it is given; the base value is what actually appears in src.
    const withoutOnOff = name.replace(/-(on|off)$/, '');
    if (withoutOnOff !== name && srcCorpus.includes(withoutOnOff)) return true;

    if (srcDynamicPatterns.some(pattern => pattern.test(name))) return true;

    return ALLOWLIST.includes(name);
};

const existsAsSubstring = (value: string): boolean => srcCorpus.includes(value) || ALLOWLIST.includes(value);

const problems: string[] = [];
Array.from(references.entries()).forEach(([key, { kind, referencedBy }]) => {
    const name = key.slice(kind.length + 1);
    const referencedByList = Array.from(referencedBy).sort().join(', ');

    if (kind === 'static' && !existsAsStatic(name)) {
        problems.push(`${name} (referenced by: ${referencedByList})`);
    } else if (kind === 'prefix' && !existsAsSubstring(name)) {
        problems.push(`${name}* (referenced by: ${referencedByList})`);
    } else if (kind === 'suffix' && !existsAsSubstring(name)) {
        problems.push(`*${name} (referenced by: ${referencedByList})`);
    }
});
problems.sort();

describe('e2e selector contract', () => {
    test('every datatest name/prefix/suffix referenced by Cypress still appears in src', () => {
        expect(problems).toEqual([]);
    });

    test('sanity: extraction actually found a substantial number of references', () => {
        // Guards against a path/regex mistake silently turning this into a no-op that
        // always passes because it never extracted anything.
        expect(references.size).toBeGreaterThan(150);
    });
});

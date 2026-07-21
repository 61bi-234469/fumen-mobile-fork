/* tslint:disable:no-console */
// Standing replacement for the throwaway "decode both fumens and compare pages" Jest that
// got rewritten from scratch every time an E2E `expectFumen()` assertion failed (see
// docs/notes/e2e-ci-failure-investigation.md §8続き6, §14). Base64 substring comparison of
// fumen strings lies — this decodes both and reports the semantic (page/field/piece) diff.
//
// Usage (skipped entirely unless FUMEN_A is set, so it never affects a normal `yarn test`):
//   # PowerShell
//   $env:FUMEN_A='v115@...'; $env:FUMEN_B='v115@...'; yarn test-ci fumen_semantic_diff
//   # bash
//   FUMEN_A='v115@...' FUMEN_B='v115@...' yarn test-ci fumen_semantic_diff
//
// FUMEN_A only: dump mode (describes every page of A).
// FUMEN_A and FUMEN_B: diff mode. A is treated as "expected", B as "actual" — matching how a
// failed expectFumen(expectedFumen) assertion reports Cypress's actual clipboard value.
import { decode } from '../fumen/fumen';
import { FieldConstants, Piece, Rotation } from '../enums';
import { getBlockPositions } from '../piece';
import { Field } from '../fumen/field';
import { Page } from '../fumen/types';

const normalizeFumen = (raw: string): string => {
    let value = raw;
    try {
        value = decodeURIComponent(raw);
    } catch {
        // Already decoded (or not URL-encoded at all) — use as-is.
    }
    return /[vmdVMD]11[05]@/.test(value) ? value : `v115@${value}`;
};

const resolveField = (pages: Page[], index: number): Field => {
    let current = pages[index];
    let guard = pages.length + 1;
    while (current.field.obj === undefined && guard > 0) {
        const ref = current.field.ref as number;
        current = pages[ref];
        guard -= 1;
    }
    if (current.field.obj === undefined) {
        throw new Error(`page ${index}: unresolved field.ref chain`);
    }
    return current.field.obj;
};

const resolveComment = (pages: Page[], index: number): { text: string; own: boolean } => {
    let current = pages[index];
    let guard = pages.length + 1;
    while (current.comment.text === undefined && guard > 0) {
        const ref = current.comment.ref as number;
        current = pages[ref];
        guard -= 1;
    }
    if (current.comment.text === undefined) {
        throw new Error(`page ${index}: unresolved comment.ref chain`);
    }
    return { text: current.comment.text, own: current === pages[index] };
};

type Cell = [number, number, string];

const nonEmptyCellsDescending = (field: Field): Cell[] => {
    const cells: Cell[] = [];
    for (let y = FieldConstants.Height - 1; -FieldConstants.SentLine <= y; y -= 1) {
        for (let x = 0; x < FieldConstants.Width; x += 1) {
            const piece = field.get(x, y);
            if (piece !== Piece.Empty) {
                cells.push([x, y, Piece[piece]]);
            }
        }
    }
    return cells;
};

interface PieceSummary {
    type: string;
    rotation: string;
    x: number;
    y: number;
    cells: [number, number][];
}

const summarizePiece = (page: Page): PieceSummary | undefined => {
    if (page.piece === undefined) return undefined;
    const { type, rotation, coordinate } = page.piece;
    const cells = getBlockPositions(type, rotation, coordinate.x, coordinate.y)
        .map(([x, y]): [number, number] => [x, y])
        .sort((a, b) => (a[1] - b[1]) || (a[0] - b[0]));
    return { cells, type: Piece[type], rotation: Rotation[rotation], x: coordinate.x, y: coordinate.y };
};

const formatPiece = (piece: PieceSummary | undefined): string => {
    if (piece === undefined) return 'none';
    const cells = piece.cells.map(([x, y]) => `(${x},${y})`).join(' ');
    return `${piece.type} ${piece.rotation} @ (${piece.x},${piece.y}) cells=${cells}`;
};

const cellKey = ([x, y]: [number, number]): string => `${x},${y}`;

const dumpPage = (pages: Page[], index: number) => {
    const page = pages[index];
    const comment = resolveComment(pages, index);
    const field = resolveField(pages, index);
    const piece = summarizePiece(page);

    console.log(`=== page ${index} ===`);
    console.log(`  comment: ${comment.own ? 'own' : `ref->${page.comment.ref}`} ${JSON.stringify(comment.text)}`);
    console.log(
        `  flags: lock=${page.flags.lock} mirror=${page.flags.mirror} ` +
        `colorize=${page.flags.colorize} rise=${page.flags.rise} quiz=${page.flags.quiz}`,
    );
    console.log(`  field: ${page.field.obj !== undefined ? 'own' : `ref->${page.field.ref}`}`);
    console.log(`  piece: ${formatPiece(piece)}`);

    const cells = nonEmptyCellsDescending(field);
    console.log(`  board (${cells.length} filled cells, y desc):`);
    console.log(`    ${cells.map(([x, y, label]) => `(${x},${y})=${label}`).join(' ') || '(empty)'}`);
};

const diffPages = (pagesA: Page[], pagesB: Page[]) => {
    if (pagesA.length !== pagesB.length) {
        console.log(`page count: expected=${pagesA.length} actual=${pagesB.length}`);
    }

    const commonLength = Math.min(pagesA.length, pagesB.length);
    for (let index = 0; index < commonLength; index += 1) {
        const pageA = pagesA[index];
        const pageB = pagesB[index];

        const commentA = resolveComment(pagesA, index).text;
        const commentB = resolveComment(pagesB, index).text;
        if (commentA !== commentB) {
            console.log(
                `page ${index}: comment expected=${JSON.stringify(commentA)} actual=${JSON.stringify(commentB)}`,
            );
        }

        (['lock', 'mirror', 'colorize', 'rise', 'quiz'] as const).forEach((flag) => {
            if (pageA.flags[flag] !== pageB.flags[flag]) {
                console.log(`page ${index}: flag ${flag} expected=${pageA.flags[flag]} actual=${pageB.flags[flag]}`);
            }
        });

        const pieceA = summarizePiece(pageA);
        const pieceB = summarizePiece(pageB);
        if ((pieceA === undefined) !== (pieceB === undefined)) {
            console.log(`page ${index}: piece expected=${formatPiece(pieceA)} actual=${formatPiece(pieceB)}`);
        } else if (pieceA !== undefined && pieceB !== undefined) {
            if (pieceA.type !== pieceB.type) {
                console.log(`page ${index}: piece type expected=${pieceA.type} actual=${pieceB.type}`);
            }
            if (pieceA.x !== pieceB.x || pieceA.y !== pieceB.y) {
                console.log(
                    `page ${index}: piece coordinate expected=(${pieceA.x},${pieceA.y}) ` +
                    `actual=(${pieceB.x},${pieceB.y})`,
                );
            }
            if (pieceA.rotation !== pieceB.rotation) {
                const cellsMatch = pieceA.type === pieceB.type
                    && pieceA.cells.length === pieceB.cells.length
                    && pieceA.cells.every((cell, i) => cellKey(cell) === cellKey(pieceB.cells[i]));
                const note = cellsMatch ? ' (physically equivalent)' : '';
                console.log(
                    `page ${index}: piece rotation expected=${pieceA.rotation} actual=${pieceB.rotation}${note}`,
                );
            }
        }

        const fieldA = resolveField(pagesA, index);
        const fieldB = resolveField(pagesB, index);
        const cellsA = new Map(nonEmptyCellsDescending(fieldA).map(([x, y, label]) => [cellKey([x, y]), label]));
        const cellsB = new Map(nonEmptyCellsDescending(fieldB).map(([x, y, label]) => [cellKey([x, y]), label]));
        const allKeys = new Set([...Array.from(cellsA.keys()), ...Array.from(cellsB.keys())]);
        Array.from(allKeys).sort().forEach((key) => {
            const labelA = cellsA.get(key) ?? 'empty';
            const labelB = cellsB.get(key) ?? 'empty';
            if (labelA !== labelB) {
                console.log(`page ${index}: field cell (${key}) expected=${labelA} actual=${labelB}`);
            }
        });
    }
};

const runIf = process.env.FUMEN_A ? describe : describe.skip;

runIf('fumen semantic diff', () => {
    test('dump or diff FUMEN_A / FUMEN_B', async () => {
        const fumenA = normalizeFumen(process.env.FUMEN_A as string);
        const pagesA = await decode(fumenA);

        if (process.env.FUMEN_B) {
            const fumenB = normalizeFumen(process.env.FUMEN_B);
            const pagesB = await decode(fumenB);
            diffPages(pagesA, pagesB);
        } else {
            for (let index = 0; index < pagesA.length; index += 1) {
                dumpPage(pagesA, index);
            }
        }

        // Diagnostic tool, not a gate: pass regardless of what the diff/dump found.
        expect(true).toBe(true);
    });
});

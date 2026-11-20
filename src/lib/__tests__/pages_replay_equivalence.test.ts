import { Piece, Rotation } from '../enums';
import { Field } from '../fumen/field';
import { Page, PreCommand } from '../fumen/types';
import { PageFieldOperation, Pages } from '../pages';
import { clearThumbnailCache, getThumbnailHeight } from '../thumbnail';
import { computeInputStats } from '../input_stats';

const operations = [PageFieldOperation.None, PageFieldOperation.Command, PageFieldOperation.All];

// Deterministic generator so failures can be reproduced from the seed.
const createRandom = (seed: number) => {
    let state = seed >>> 0;
    return (max: number) => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state % max;
    };
};

const minoTypes = [Piece.I, Piece.L, Piece.O, Piece.Z, Piece.T, Piece.J, Piece.S];

const createPage = (index: number, field: Page['field'], overrides: Partial<Page> = {}): Page => ({
    index,
    field,
    comment: index === 0 ? { text: '' } : { ref: 0 },
    flags: { lock: true, mirror: false, colorize: true, rise: false, quiz: false },
    ...overrides,
});

const randomField = (random: (max: number) => number): Field => {
    const field = new Field({});
    const cells = random(30);
    for (let i = 0; i < cells; i += 1) {
        field.setToPlayField(random(60), minoTypes[random(minoTypes.length)]);
    }
    field.setToSentLine(random(10), Piece.Gray);
    return field;
};

const randomPages = (seed: number, count: number): Page[] => {
    const random = createRandom(seed);
    const objIndices: number[] = [];
    const pages: Page[] = [];
    for (let index = 0; index < count; index += 1) {
        // The first page always has its own field; later ones mostly reference an earlier field.
        const ownField = index === 0 || random(5) === 0;
        let field: Page['field'];
        if (ownField) {
            field = { obj: randomField(random) };
            objIndices.push(index);
        } else {
            // Usually the latest field, sometimes an older one, as after tree edits.
            const pick = random(4) === 0 ? random(objIndices.length) : objIndices.length - 1;
            field = { ref: objIndices[pick] };
        }
        const pre: { [key: string]: PreCommand } = {};
        if (random(4) === 0) {
            pre['block-0'] = { type: 'block', x: random(10), y: random(4), piece: Piece.Gray };
        }
        if (random(8) === 0) {
            pre['sent-0'] = { type: 'sentBlock', x: random(10), y: 0, piece: Piece.Gray };
        }
        pages.push(createPage(index, field, {
            piece: random(6) === 0 ? undefined : {
                type: minoTypes[random(minoTypes.length)],
                rotation: Rotation.Spawn,
                coordinate: { x: 1 + random(7), y: random(3) },
            },
            commands: Object.keys(pre).length > 0 ? { pre } : undefined,
            flags: {
                lock: random(5) !== 0,
                rise: random(6) === 0,
                mirror: random(8) === 0,
                colorize: true,
                quiz: false,
            },
        }));
    }
    return pages;
};

const expectSameAsGetField = (pages: Page[], indices: number[]) => {
    const pagesObj = new Pages(pages);
    for (const operation of operations) {
        const seen: number[] = [];
        pagesObj.forEachReplayedField(indices, operation, (field, index) => {
            seen.push(index);
            expect(field).toEqual(pagesObj.getField(index, operation));
        });
        expect(seen).toEqual(indices);
    }
};

describe('forEachReplayedField', () => {
    test('re-reads a page with its own field in the middle of a range', () => {
        const first = new Field({});
        const second = new Field({});
        second.setToPlayField(0, Piece.Gray);
        const unlocked = { lock: false, mirror: false, colorize: true, rise: false, quiz: false };
        const pages = [
            createPage(0, { obj: first }, { flags: unlocked }),
            createPage(1, { obj: second }, { flags: unlocked }),
            createPage(2, { ref: 1 }),
        ];
        const pagesObj = new Pages(pages);

        expect(pagesObj.replayFields(0, 3)[1].get(0, 0)).toBe(Piece.Gray);
        expectSameAsGetField(pages, [0, 1, 2]);
    });

    test('keeps replaying from the referenced field when a later page points back past a newer one', () => {
        const base = new Field({});
        const other = new Field({});
        other.setToPlayField(9, Piece.Gray);
        const lock = { type: Piece.O, rotation: Rotation.Spawn, coordinate: { x: 1, y: 0 } };
        const pages = [
            createPage(0, { obj: base }, { piece: lock }),
            createPage(1, { obj: other }),
            createPage(2, { ref: 0 }),
        ];

        expectSameAsGetField(pages, [0, 1, 2]);
    });

    test('restarts at gaps in the index list (tree branches)', () => {
        const pages = randomPages(7, 12);
        expectSameAsGetField(pages, [0, 1, 2, 5, 6, 9, 11]);
        expectSameAsGetField(pages, [3, 4, 10]);
    });

    test.each([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])('matches getField on random fumens (seed %i)', (seed) => {
        const pages = randomPages(seed, 60);
        expectSameAsGetField(pages, pages.map((_, index) => index));
    });

    test('replayFieldIndices and replayFields return the same fields as getField', () => {
        const pages = randomPages(42, 30);
        const pagesObj = new Pages(pages);
        for (const operation of operations) {
            expect(pagesObj.replayFields(5, 25, operation))
                .toEqual(Array.from({ length: 20 }, (_, offset) => pagesObj.getField(5 + offset, operation)));
            expect(pagesObj.replayFieldIndices([2, 3, 4, 20, 21], operation))
                .toEqual([2, 3, 4, 20, 21].map(index => pagesObj.getField(index, operation)));
        }
    });

    test('handles repeated and backward indices', () => {
        const pages = randomPages(11, 8);
        expectSameAsGetField(pages, [2, 2, 1, 2, 3, 0, 7, 6]);
    });

    test('changing a returned field affects neither later fields nor the stored field', () => {
        const pages = randomPages(13, 20);
        const pagesObj = new Pages(pages);
        const stored = pages.map(page => page.field.obj?.copy());
        const expected = pages.map((_, index) => pagesObj.getField(index, PageFieldOperation.Command));

        const seen: Field[] = [];
        pagesObj.forEachReplayedField(pages.map((_, index) => index), PageFieldOperation.Command, (field) => {
            seen.push(field.copy());
            field.setToPlayField(0, Piece.T);
            field.setToPlayField(9, Piece.Z);
        });

        expect(seen).toEqual(expected);
        expect(pages.map(page => page.field.obj)).toEqual(stored);
    });

    test('throws for a page whose reference has no field, like getField', () => {
        const pages = [createPage(0, { obj: new Field({}) }), createPage(1, { ref: 0 }), createPage(2, { ref: 1 })];
        const pagesObj = new Pages(pages);

        expect(() => pagesObj.getField(2)).toThrow();
        expect(() => pagesObj.forEachReplayedField([0, 1, 2], PageFieldOperation.None, () => undefined)).toThrow();
    });
});

describe('getThumbnailHeight with trimming', () => {
    test('measures every page the same as resolving it alone', () => {
        const pages = randomPages(99, 40);
        const pagesObj = new Pages(pages);
        // Reference: measure each page from a one-page fumen holding its resolved field, so nothing is replayed.
        const expected = pages.map((page, index) => {
            const field = pagesObj.getField(index, PageFieldOperation.Command);
            const single = { ...page, index: 0, field: { obj: field }, commands: undefined };
            return getThumbnailHeight([single], 0, true);
        });

        clearThumbnailCache(pages);
        expect(pages.map((_, index) => getThumbnailHeight(pages, index, true))).toEqual(expected);
    });

    test('measures pages before a broken reference once and resolves the rest one by one', () => {
        const valid = randomPages(5, 10);
        const pages = [...valid, createPage(10, { ref: 9 }), createPage(11, { obj: new Field({}) })];
        const spy = jest.spyOn(Pages.prototype, 'forEachReplayedField');
        try {
            for (let index = 0; index < 10; index += 1) {
                expect(getThumbnailHeight(pages, index, true)).toBeGreaterThan(0);
            }
            expect(getThumbnailHeight(pages, 11, true)).toBeGreaterThan(0);
            expect(() => getThumbnailHeight(pages, 10, true)).toThrow();
            expect(spy).toHaveBeenCalledTimes(1);
        } finally {
            spy.mockRestore();
        }
    });

    test('a broken reference on one page keeps the other pages measurable', () => {
        const pages = [
            createPage(0, { obj: new Field({}) }),
            createPage(1, { ref: 0 }),
            createPage(2, { ref: 1 }),
        ];

        expect(getThumbnailHeight(pages, 0, true)).toBeGreaterThan(0);
        expect(getThumbnailHeight(pages, 1, true)).toBeGreaterThan(0);
        expect(() => getThumbnailHeight(pages, 2, true)).toThrow();
    });
});

describe('computeInputStats with a page that has its own field', () => {
    test('evaluates a placement on a field replaced in the middle of the route', () => {
        // Page 1 replaces the field (e.g. INPUT garbage) with a row that the I piece completes.
        const garbage = new Field({});
        for (let x = 4; x < 10; x += 1) garbage.setToPlayField(x, Piece.Gray);
        const unlocked = { lock: false, mirror: false, colorize: true, rise: false, quiz: false };
        const pages = [
            createPage(0, { obj: new Field({}) }, { flags: unlocked }),
            createPage(1, { obj: garbage }, {
                piece: { type: Piece.I, rotation: Rotation.Spawn, coordinate: { x: 1, y: 0 } },
            }),
            createPage(2, { ref: 1 }),
        ];

        const stats = computeInputStats(pages, 2, 'srs');

        expect(stats.lines).toBe(1);
        expect(stats.renChain).toBe(1);
        expect(stats.lastAction?.clearedLines).toBe(1);
    });
});

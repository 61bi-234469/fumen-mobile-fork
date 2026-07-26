import { State } from '../../states';
import { Piece } from '../../lib/enums';
import { Field } from '../../lib/fumen/field';
import { floatingPartSpawn, initialRectSelectState } from '../../lib/rect_selection';

jest.mock('../../actions', () => ({
    actions: {
        registerHistoryTask: () => () => undefined,
        reopenCurrentPage: () => () => undefined,
        startRectSelection: () => () => ({
            rectSelect: { status: 'selecting' },
        }),
    },
}));

// tslint:disable-next-line:no-var-requires
const { rectSelectActions } = require('../rect_select');

describe('rectSelectActions', () => {
    test('does not add highlight darkening to transformed select previews', () => {
        const state = {
            rectSelect: {
                status: 'floating',
                rect: { minX: 1, minY: 1, maxX: 2, maxY: 2 },
                anchorIndex: null,
                floating: {
                    cells: [Piece.T, Piece.L, Piece.Empty, Piece.I],
                    width: 2,
                    height: 2,
                    sourceRect: { minX: 1, minY: 1, maxX: 2, maxY: 2 },
                    targetX: 1,
                    targetY: 1,
                    pointerOffsetX: 0,
                    pointerOffsetY: 0,
                },
            },
        } as unknown as State;

        const rotated = rectSelectActions.rotateSelectedPartLeft()(state) as any;
        const mirrored = rectSelectActions.mirrorSelectedPart()(state) as any;

        expect(rotated.rectSelect.floating.previewHighlight).toBeUndefined();
        expect(mirrored.rectSelect.floating.previewHighlight).toBeUndefined();
    });

    test('starts a new selection on an outside click after a rectangle is selected', () => {
        const state = {
            rectSelect: {
                status: 'selected',
                rect: { minX: 1, minY: 1, maxX: 2, maxY: 2 },
                anchorIndex: null,
                floating: null,
            },
            parts: { items: [], selectedId: null, blackTransparent: true },
        } as unknown as State;

        const next = rectSelectActions.startRectSelection({ index: 5 + 5 * 10 })(state) as any;

        expect(next.rectSelect).toEqual({
            status: 'selecting',
            rect: { minX: 5, minY: 5, maxX: 5, maxY: 5 },
            anchorIndex: 55,
            floating: null,
            reselectOnNextTouch: false,
        });
    });

    test('commits a rotated selection on the first outside click', () => {
        const field = new Field({});
        field.add(1, 1, Piece.T);
        const state = {
            fumen: {
                currentIndex: 0,
                pages: [{
                    index: 0,
                    field: { obj: field },
                    comment: { text: '' },
                    flags: { lock: false, mirror: false, colorize: true, rise: false, quiz: false },
                }],
            },
            rectSelect: {
                status: 'selected',
                rect: { minX: 1, minY: 1, maxX: 2, maxY: 2 },
                anchorIndex: null,
                floating: null,
            },
            parts: { items: [], selectedId: null, blackTransparent: true },
        } as unknown as State;

        const rotated = {
            ...state,
            ...(rectSelectActions.rotateSelectedPartLeft()(state) as State),
        } as State;
        const next = rectSelectActions.startRectSelection({ index: 5 + 5 * 10 })(rotated) as any;

        expect(next.fumen.pages[0].field.obj).toBeDefined();
        expect(next.rectSelect.status).toBe('selecting');
    });

    test('starts the whole field as a floating selection', () => {
        const field = new Field({});
        const state = {
            fumen: {
                currentIndex: 0,
                pages: [{
                    index: 0,
                    field: { obj: field },
                    comment: { text: '' },
                    flags: { lock: false, mirror: false, colorize: true, rise: false, quiz: false },
                }],
            },
            rectSelect: initialRectSelectState,
        } as unknown as State;

        const next = rectSelectActions.beginWholeFieldMove()(state) as any;

        expect(next.rectSelect.status).toBe('floating');
        expect(next.rectSelect.rect).toEqual({ minX: 0, minY: 0, maxX: 9, maxY: 22 });
        expect(next.rectSelect.floating.sourceRect).toEqual(next.rectSelect.rect);
        expect(next.rectSelect.floating.width).toBe(10);
        expect(next.rectSelect.floating.height).toBe(23);
    });

    test('keeps a moved selection uncommitted when the pointer is released', () => {
        const field = new Field({});
        field.add(1, 1, Piece.T);
        const state = {
            fumen: {
                currentIndex: 0,
                pages: [{
                    index: 0,
                    field: { obj: field },
                    comment: { text: '' },
                    flags: { lock: false, mirror: false, colorize: true, rise: false, quiz: false },
                }],
            },
            rectSelect: {
                status: 'floating',
                rect: { minX: 1, minY: 1, maxX: 1, maxY: 1 },
                anchorIndex: 11,
                floating: {
                    cells: [Piece.T],
                    width: 1,
                    height: 1,
                    sourceRect: { minX: 1, minY: 1, maxX: 1, maxY: 1 },
                    targetX: 4,
                    targetY: 5,
                    pointerOffsetX: 0,
                    pointerOffsetY: 0,
                },
            },
        } as unknown as State;

        const next = rectSelectActions.endRectSelection()(state) as any;

        expect(next.rectSelect.status).toBe('floating');
        expect(next.rectSelect.anchorIndex).toBeNull();
        expect(next.rectSelect.floating.targetX).toBe(4);
        expect(next.fumen).toBeUndefined();
        expect(field.get(1, 1)).toBe(Piece.T);
        expect(field.get(4, 5)).toBe(Piece.Empty);
    });

    test('spawns a selected part three rows above the terrain it covers', () => {
        const field = Array.from({ length: 230 }).map(() => ({ piece: Piece.Empty }));
        for (let y = 0; y <= 2; y += 1) {
            field[5 + y * 10] = { piece: Piece.Gray };
        }
        const state = {
            field,
            rectSelect: initialRectSelectState,
            parts: {
                items: [{
                    id: 'part', slot: Piece.I, width: 2, height: 2,
                    cells: [Piece.T, Piece.L, Piece.Empty, Piece.I], pinned: false, createdAt: 1,
                }],
                selectedId: null,
                blackTransparent: true,
            },
        } as unknown as State;

        const next = rectSelectActions.selectPart({ id: 'part' })(state) as any;

        expect(next.rectSelect.floating.targetX).toBe(4);
        expect(next.rectSelect.floating.targetY).toBe(6);
        expect(next.rectSelect.floating.firstTapPending).toBe(true);
    });

    describe('first tap on a part preview', () => {
        // 2x2 part over an empty field: the spawn lands at x=4..5, y=3..4.
        const partCells = [Piece.T, Piece.L, Piece.Empty, Piece.I];
        const partState = (): State => {
            const field = Array.from({ length: 230 }).map(() => ({ piece: Piece.Empty }));
            return {
                field,
                fumen: {
                    currentIndex: 0,
                    pages: [{
                        index: 0,
                        field: { obj: new Field({}) },
                        comment: { text: '' },
                        flags: { lock: false, mirror: false, colorize: true, rise: false, quiz: false },
                    }],
                },
                rectSelect: {
                    status: 'floating',
                    rect: null,
                    anchorIndex: null,
                    floating: floatingPartSpawn(partCells.slice(), 2, 2, field),
                    reselectOnNextTouch: false,
                },
                parts: { items: [], selectedId: 'part', blackTransparent: true },
            } as unknown as State;
        };

        test('keeps the tapped cell attached to the same cell of the part', () => {
            const state = partState();

            // Top-right cell of the preview.
            const next = rectSelectActions.startRectSelection({ index: 5 + 4 * 10 })(state) as any;

            expect(next.rectSelect.floating.targetX).toBe(4);
            expect(next.rectSelect.floating.targetY).toBe(3);
            expect(next.rectSelect.floating.pointerOffsetX).toBe(1);
            expect(next.rectSelect.floating.pointerOffsetY).toBe(1);
            expect(next.rectSelect.floating.firstTapPending).toBe(false);
            expect(next.rectSelect.floating.firstTapInProgress).toBe(true);
            expect(next.rectSelect.anchorIndex).toBe(5 + 4 * 10);
        });

        test('moves the part so that the tapped cell follows the pointer', () => {
            const state = partState();
            const started = {
                ...state,
                ...(rectSelectActions.startRectSelection({ index: 5 + 4 * 10 })(state) as State),
            } as State;

            const moved = rectSelectActions.moveRectSelection({ index: 3 + 10 * 10 })(started) as any;

            // The tapped cell stays the part's top-right cell.
            expect(moved.rectSelect.floating.targetX).toBe(2);
            expect(moved.rectSelect.floating.targetY).toBe(9);
        });

        test('keeps the first placement uncommitted after the pointer is released', () => {
            const state = partState();
            const started = {
                ...state,
                ...(rectSelectActions.startRectSelection({ index: 5 + 4 * 10 })(state) as State),
            } as State;

            const ended = rectSelectActions.endRectSelection()(started) as any;

            expect(ended.rectSelect.status).toBe('floating');
            expect(ended.rectSelect.floating.firstTapInProgress).toBe(false);
            expect(ended.rectSelect.floating.targetX).toBe(4);
            expect(ended.rectSelect.floating.targetY).toBe(3);
            expect(ended.fumen).toBeUndefined();
        });

        test('commits the preview in place and starts a selection on an outside first tap', () => {
            // tslint:disable-next-line:no-var-requires
            const mocked = require('../../actions').actions;
            const original = mocked.startRectSelection;
            mocked.startRectSelection = ({ index }: { index: number }) => (
                (current: State) => rectSelectActions.startRectSelection({ index })(current)
            );

            try {
                const state = partState();

                const next = rectSelectActions.startRectSelection({ index: 0 })(state) as any;

                const committed = next.fumen.pages[0];
                expect(committed.commands).toBeDefined();
                expect(next.parts.selectedId).toBeNull();
                expect(next.rectSelect).toEqual({
                    status: 'selecting',
                    rect: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
                    anchorIndex: 0,
                    floating: null,
                    reselectOnNextTouch: false,
                });
            } finally {
                mocked.startRectSelection = original;
            }
        });
    });
});

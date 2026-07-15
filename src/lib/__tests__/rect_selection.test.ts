import { Piece } from '../enums';
import {
    composeSelectionField,
    floatingTargetForPointer,
    mirrorPartCells,
    rectFromIndices,
    rotatePartCellsLeft,
    rotatePartCells,
} from '../rect_selection';
import { State } from '../../states';

describe('rect selection helpers', () => {
    test('normalizes a rectangle regardless of drag direction', () => {
        expect(rectFromIndices(8 + 5 * 10, 2 + 1 * 10)).toEqual({
            minX: 2,
            minY: 1,
            maxX: 8,
            maxY: 5,
        });
    });

    test('rotates and mirrors part cells including Empty cells', () => {
        const cells = [Piece.I, Piece.Empty, Piece.T, Piece.Gray, Piece.O, Piece.S];
        expect(mirrorPartCells(cells, 3, 2)).toEqual([
            Piece.T, Piece.Empty, Piece.I,
            Piece.Z, Piece.O, Piece.Gray,
        ]);
        expect(rotatePartCells(cells, 3, 2)).toEqual({
            cells: [Piece.Gray, Piece.I, Piece.O, Piece.Empty, Piece.S, Piece.T],
            width: 2,
            height: 3,
        });
        expect(rotatePartCellsLeft(cells, 3, 2)).toEqual({
            cells: [Piece.T, Piece.S, Piece.Empty, Piece.O, Piece.I, Piece.Gray],
            width: 2,
            height: 3,
        });
    });

    test('composes a move preview without changing the source field', () => {
        const source = Array.from({ length: 230 }).map(() => ({ piece: Piece.Empty }));
        source[0] = { piece: Piece.I };
        source[1] = { piece: Piece.T };
        const state = {
            field: source,
            rectSelect: {
                status: 'floating',
                rect: { minX: 0, minY: 0, maxX: 1, maxY: 0 },
                anchorIndex: null,
                floating: {
                    cells: [Piece.I, Piece.T],
                    width: 2,
                    height: 1,
                    sourceRect: { minX: 0, minY: 0, maxX: 1, maxY: 0 },
                    targetX: 4,
                    targetY: 2,
                    pointerOffsetX: 0,
                    pointerOffsetY: 0,
                },
            },
            parts: { blackTransparent: true },
        } as State;

        const composed = composeSelectionField(state);

        expect(composed[0].piece).toBe(Piece.Empty);
        expect(composed[1].piece).toBe(Piece.Empty);
        expect(composed[24].piece).toBe(Piece.I);
        expect(composed[25].piece).toBe(Piece.T);
        expect(source[0].piece).toBe(Piece.I);
        expect(source[1].piece).toBe(Piece.T);
    });

    test('keeps a floating cursor outside the field and clips its preview', () => {
        const floating = {
            cells: [Piece.I, Piece.T, Piece.Empty, Piece.S],
            width: 2,
            height: 2,
            sourceRect: null,
            targetX: 0,
            targetY: 0,
            pointerOffsetX: 0,
            pointerOffsetY: 0,
        } as any;
        expect(floatingTargetForPointer(floating, 9 + 22 * 10)).toEqual({ x: 9, y: 22 });

        const state = {
            field: Array.from({ length: 230 }).map(() => ({ piece: Piece.Empty })),
            rectSelect: { status: 'floating', rect: null, anchorIndex: null, floating: {
                ...floating, targetX: 9, targetY: 22,
            } },
            parts: { blackTransparent: false },
        } as State;
        const composed = composeSelectionField(state);
        expect(composed[229].piece).toBe(Piece.I);
        expect(composed[230]).toBeUndefined();
    });

    test('keeps Empty cells transparent when spawning a part', () => {
        const source = Array.from({ length: 230 }).map(() => ({ piece: Piece.Empty }));
        source[20] = { piece: Piece.T };
        source[21] = { piece: Piece.L };
        const state = {
            field: source,
            rectSelect: {
                status: 'floating',
                rect: null,
                anchorIndex: null,
                floating: {
                    cells: [Piece.Empty, Piece.S],
                    width: 2,
                    height: 1,
                    sourceRect: null,
                    targetX: 0,
                    targetY: 2,
                    pointerOffsetX: 0,
                    pointerOffsetY: 0,
                },
            },
            parts: { blackTransparent: true },
        } as unknown as State;

        const composed = composeSelectionField(state);

        expect(composed[20].piece).toBe(Piece.T);
        expect(composed[21].piece).toBe(Piece.S);
    });

    test('keeps Empty cells transparent when moving a rectangle', () => {
        const source = Array.from({ length: 230 }).map(() => ({ piece: Piece.Empty }));
        source[0] = { piece: Piece.I };
        source[1] = { piece: Piece.T };
        source[22] = { piece: Piece.L };
        const state = {
            field: source,
            rectSelect: {
                status: 'floating',
                rect: { minX: 0, minY: 0, maxX: 1, maxY: 0 },
                anchorIndex: null,
                floating: {
                    cells: [Piece.Empty, Piece.S],
                    width: 2,
                    height: 1,
                    sourceRect: { minX: 0, minY: 0, maxX: 1, maxY: 0 },
                    targetX: 0,
                    targetY: 0,
                    pointerOffsetX: 0,
                    pointerOffsetY: 0,
                },
            },
            parts: { blackTransparent: true },
        } as unknown as State;

        const composed = composeSelectionField(state);

        expect(composed[0].piece).toBe(Piece.I);
        expect(composed[1].piece).toBe(Piece.S);
    });
});

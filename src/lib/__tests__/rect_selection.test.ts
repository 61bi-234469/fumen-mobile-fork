import { Piece } from '../enums';
import {
    composeSelectionField,
    mirrorPartCells,
    rectFromIndices,
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
                    kind: 'move',
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
});

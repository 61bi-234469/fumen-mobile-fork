import { Piece } from '../enums';
import { Field } from '../fumen/field';
import {
    buildGoalField,
    composeDisplayField,
    defaultPastePosition,
    extractCells,
    mirrorCells,
    normalizeRect,
    trimUnpinnedParts,
} from '../parts';

describe('parts helpers', () => {
    test('normalizes reversed and out-of-field rectangles', () => {
        expect(normalizeRect({ x: 12, y: 25 }, { x: -2, y: -1 })).toEqual({
            minX: 0, minY: 0, maxX: 9, maxY: 22,
        });
        expect(normalizeRect(21, 21)).toEqual({ minX: 1, minY: 2, maxX: 1, maxY: 2 });
    });

    test('extracts cells in bottom-up row-major order', () => {
        const field = new Field({});
        field.setToPlayField(0, Piece.I);
        field.setToPlayField(1, Piece.J);
        field.setToPlayField(10, Piece.S);
        field.setToPlayField(11, Piece.Z);
        expect(extractCells(field, { minX: 0, minY: 0, maxX: 1, maxY: 1 }))
            .toEqual([Piece.I, Piece.J, Piece.S, Piece.Z]);
    });

    test('mirrors positions and mirrored piece colors', () => {
        expect(mirrorCells([Piece.J, Piece.S, Piece.L, Piece.Z], 2, 2))
            .toEqual([Piece.Z, Piece.L, Piece.S, Piece.J]);
    });

    test('builds an edit with source clearing, clipping, and transparent empty cells', () => {
        const field = new Field({});
        field.setToPlayField(0, Piece.Gray);
        field.setToPlayField(1, Piece.Gray);
        const result = buildGoalField(field, {
            clearRect: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
            place: {
                cells: [Piece.Empty, Piece.T], width: 2, height: 1,
                x: 0, y: 0, blackTransparent: true,
            },
        });
        expect(result.get(0, 0)).toBe(Piece.Empty);
        expect(result.get(1, 0)).toBe(Piece.T);
    });

    test('chooses a centered, height-aware paste position', () => {
        const field = new Field({});
        expect(defaultPastePosition(field, 4, 2)).toEqual({ x: 3, y: 1 });
        field.setToPlayField(50, Piece.Gray);
        expect(defaultPastePosition(field, 4, 2)).toEqual({ x: 3, y: 7 });
        field.setToPlayField(220, Piece.Gray);
        expect(defaultPastePosition(field, 4, 3)).toEqual({ x: 3, y: 20 });
    });

    test('composes a floating preview without mutating its source', () => {
        const field = Array.from({ length: 230 }).map(() => ({ piece: Piece.Empty }));
        field[0] = { piece: Piece.I };
        const display = composeDisplayField(field, {
            phase: 'floating', dragAnchor: null, moveAnchor: null,
            rect: { minX: 2, minY: 0, maxX: 2, maxY: 0 },
            floating: {
                cells: [Piece.I], width: 1, height: 1, x: 2, y: 0,
                sourceRect: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
            },
        }, false);
        expect(field[0].piece).toBe(Piece.I);
        expect(display[0].piece).toBe(Piece.Empty);
        expect(display[2].piece).toBe(Piece.I);
    });

    test('keeps every pinned part and only ten unpinned parts', () => {
        const items = Array.from({ length: 13 }).map((_, index) => ({
            id: `${index}`, width: 1, height: 1, cells: [Piece.Empty],
            pinned: index === 12, createdAt: index,
        }));
        const trimmed = trimUnpinnedParts(items);
        expect(trimmed).toHaveLength(11);
        expect(trimmed.some(part => part.id === '12')).toBe(true);
    });
});

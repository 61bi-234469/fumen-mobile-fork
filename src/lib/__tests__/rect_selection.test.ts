import { Piece } from '../enums';
import {
    columnTopFilledRow,
    composeSelectionField,
    floatingPartSpawn,
    floatingTargetForPointer,
    mirrorPartCells,
    partLandingY,
    rectFromIndices,
    rotatePartCellsLeft,
    rotatePartCells,
} from '../rect_selection';
import { Block } from '../../state_types';
import { State } from '../../states';

const emptyField = (): Block[] => Array.from({ length: 230 }).map(() => ({ piece: Piece.Empty }));

const filledField = (columns: number[], topRow: number): Block[] => {
    const field = emptyField();
    columns.forEach((x) => {
        for (let y = 0; y <= topRow; y += 1) {
            field[x + y * 10] = { piece: Piece.Gray };
        }
    });
    return field;
};

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

    test('does not restore source cells under transparent cells when a move overlaps', () => {
        const source = Array.from({ length: 230 }).map(() => ({ piece: Piece.Empty }));
        source[10] = { piece: Piece.I };
        source[11] = { piece: Piece.T };
        const state = {
            field: source,
            rectSelect: {
                status: 'floating',
                rect: { minX: 0, minY: 0, maxX: 1, maxY: 1 },
                anchorIndex: null,
                floating: {
                    cells: [Piece.Empty, Piece.Empty, Piece.I, Piece.T],
                    width: 2,
                    height: 2,
                    sourceRect: { minX: 0, minY: 0, maxX: 1, maxY: 1 },
                    targetX: 0,
                    targetY: 1,
                    pointerOffsetX: 0,
                    pointerOffsetY: 0,
                },
            },
            parts: { blackTransparent: true },
        } as unknown as State;

        const composed = composeSelectionField(state);

        expect(composed[10].piece).toBe(Piece.Empty);
        expect(composed[11].piece).toBe(Piece.Empty);
        expect(composed[20].piece).toBe(Piece.I);
        expect(composed[21].piece).toBe(Piece.T);
    });

    test('does not darken a selection preview', () => {
        const source = Array.from({ length: 230 }).map(() => ({ piece: Piece.Empty }));
        const state = {
            field: source,
            rectSelect: {
                status: 'floating',
                rect: { minX: 0, minY: 0, maxX: 1, maxY: 0 },
                anchorIndex: null,
                floating: {
                    cells: [Piece.T, Piece.I],
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

        expect(composed[24].highlight).toBeUndefined();
        expect(composed[25].highlight).toBeUndefined();
    });

    test('reads the top filled row of a single column', () => {
        const field = emptyField();
        expect(columnTopFilledRow(field, 4)).toBe(-1);

        field[4 + 2 * 10] = { piece: Piece.T };
        expect(columnTopFilledRow(field, 4)).toBe(2);
        expect(columnTopFilledRow(field, 5)).toBe(-1);

        field[4 + 7 * 10] = { piece: Piece.I };
        expect(columnTopFilledRow(field, 4)).toBe(7);
    });

    test('lands a part on the highest of the columns it covers', () => {
        const field = filledField([5], 2);
        field[9 + 9 * 10] = { piece: Piece.L };

        expect(partLandingY(field, 4, 2)).toBe(3);
        // Terrain outside the covered columns does not raise the landing row.
        expect(partLandingY(field, 0, 2)).toBe(0);
    });

    test('spawns a part three rows above its landing surface', () => {
        const spawnOn = (field: Block[]) => floatingPartSpawn(
            [Piece.T, Piece.L, Piece.I, Piece.Z], 2, 2, field,
        );

        const onEmpty = spawnOn(emptyField());
        expect(onEmpty.targetX).toBe(4);
        expect(onEmpty.targetY).toBe(3);
        expect(onEmpty.pointerOffsetX).toBe(0);
        expect(onEmpty.pointerOffsetY).toBe(0);
        expect(onEmpty.firstTapPending).toBe(true);

        expect(spawnOn(filledField([4, 5], 2)).targetY).toBe(6);
        expect(spawnOn(filledField([5], 2)).targetY).toBe(6);
        // Terrain outside the covered columns is ignored.
        expect(spawnOn(filledField([0], 9)).targetY).toBe(3);
        // The ceiling stays where it used to be.
        expect(spawnOn(filledField([4], 22)).targetY).toBe(21);
        expect(spawnOn(filledField([4], 18)).targetY).toBe(21);
    });
});

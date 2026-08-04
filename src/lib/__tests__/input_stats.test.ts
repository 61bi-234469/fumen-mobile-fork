import { Piece, Rotation } from '../enums';
import { Field } from '../fumen/field';
import {
    advanceStats, computeInputStats, displayB2b, displayRen, evaluatePlacement, formatActionLabel, fromCommentCombo,
    resolveInputRulesPreset, toCommentCombo,
} from '../input_stats';

describe('input stats', () => {
    test('uses the rotation system as the rules preset', () => {
        expect(resolveInputRulesPreset('classic')).toBe('none');
        expect(resolveInputRulesPreset('srs')).toBe('ppt');
        expect(resolveInputRulesPreset('srsPlus')).toBe('tetrioS2');
    });

    test('counts a single line clear and progresses REN', () => {
        const field = new Field({});
        for (let x = 0; x < 9; x += 1) field.setToPlayField(x, Piece.Gray);
        const result = evaluatePlacement(field,
            { type: Piece.I, rotation: Rotation.Right, coordinate: { x: 9, y: 1 } }, 'ppt', undefined);
        expect(result.clearedLines).toBe(1);
        expect(formatActionLabel(result)).toBe('SINGLE');
        expect(advanceStats({ b2bChain: 0, renChain: 0, pieces: 0, lines: 0, perfectClears: 0 }, result, 'ppt'))
            .toMatchObject({ renChain: 1, lines: 1 });
    });

    test('retains B2B for a QUAD and resets it for an ordinary clear', () => {
        const base = { b2bChain: 1, renChain: 1, pieces: 1, lines: 4, perfectClears: 0 };
        expect(advanceStats(base, { clearedLines: 4, spin: 'none', perfectClear: false }, 'ppt').b2bChain).toBe(2);
        expect(advanceStats(base, { clearedLines: 1, spin: 'none', perfectClear: false }, 'ppt').b2bChain).toBe(0);
    });

    test('requires rotation evidence for a PPT T-spin and classifies its front corners', () => {
        const field = new Field({});
        // T at (4, 1): its four pivot corners are (3,0), (5,0), (3,2), (5,2).
        field.setToPlayField(3, Piece.Gray);
        field.setToPlayField(3 + 2 * 10, Piece.Gray);
        field.setToPlayField(5 + 2 * 10, Piece.Gray);
        const piece = { type: Piece.T, rotation: Rotation.Spawn, coordinate: { x: 4, y: 1 } };
        expect(evaluatePlacement(field, piece, 'ppt', { direction: 'cw', kickIndex: 0 }).spin).toBe('full');
        expect(evaluatePlacement(field, piece, 'ppt', undefined).spin).toBe('none');
        expect(evaluatePlacement(field, piece, 'ppt', { direction: '180', kickIndex: 4 }).spin).toBe('none');
        expect(formatActionLabel({ clearedLines: 0, spin: 'full', perfectClear: false, piece: Piece.T }))
            .toBe('T-SPIN');
        expect(formatActionLabel({ clearedLines: 0, spin: 'mini', perfectClear: false, piece: Piece.T }))
            .toBe('T-SPIN MINI');
    });

    test('displays B2B and REN as their bonus counts', () => {
        expect(displayB2b(0)).toBe(0);
        expect(displayB2b(1)).toBe(0);
        expect(displayB2b(2)).toBe(1);
        expect(displayRen(1)).toBe(0);
        expect(displayRen(2)).toBe(1);
    });

    test('uses the raw consecutive-clear count for Cold Clear combo metadata', () => {
        expect(toCommentCombo(1)).toBe(1);
        expect(toCommentCombo(2)).toBe(2);
        expect(fromCommentCombo(0)).toBe(0);
        expect(fromCommentCombo(3)).toBe(3);
    });

    test('uses only the current tree path and excludes the unplaced current node', () => {
        const move = { type: Piece.O, rotation: Rotation.Spawn, coordinate: { x: 4, y: 1 } };
        const pages: any[] = [
            { index: 0, field: { obj: new Field({}) }, comment: { text: '' }, flags: { lock: true }, piece: move },
            { index: 1, field: { ref: 0 }, comment: { ref: 0 }, flags: { lock: true }, piece: move },
            { index: 2, field: { ref: 0 }, comment: { ref: 0 }, flags: { lock: true }, piece: move },
        ];
        const tree: any = {
            version: 2, rootId: 'root', nodes: [
                { id: 'root', parentId: null, pageIndex: -1, childrenIds: ['p0'] },
                { id: 'p0', parentId: 'root', pageIndex: 0, childrenIds: ['p1', 'p2'] },
                { id: 'p1', parentId: 'p0', pageIndex: 1, childrenIds: [] },
                { id: 'p2', parentId: 'p0', pageIndex: 2, childrenIds: [] },
            ],
        };
        expect(computeInputStats(pages, 2, { tree, rotationSystem: 'srs' }).pieces).toBe(1);
    });

    test('uses editor-only seven-bag progress without comment metadata', () => {
        const pages: any[] = [{
            index: 0,
            field: { obj: new Field({}) },
            comment: { text: '#Q=[](T)IOLJSZ' },
            flags: { lock: true },
            internal: {
                sevenBagGrayProgress: { bag: 3, pieces: 17, lines: 5, perfectClears: 1 },
            },
        }];

        expect(computeInputStats(pages, 0, 'srs')).toMatchObject({
            pieces: 17,
            lines: 5,
            perfectClears: 1,
        });
    });
});

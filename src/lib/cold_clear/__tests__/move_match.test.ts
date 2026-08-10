import { Piece, Rotation } from '../../enums';
import { getBlockPositions } from '../../piece';
import { Move } from '../../fumen/types';
import {
    ccMoveCellKey,
    ccMoveToMove,
    findExactPlacedResult,
    findPlacedIndexByKey,
    toCellKey,
    toOccupiedCellKey,
} from '../move_match';
import { CCMove } from '../types';

// CC piece: I=0, O=1, T=2, L=3, J=4, S=5, Z=6
// CC rotation: North=0, South=1, East=2, West=3
const ccMove = (
    piece: number, rotation: number, x: number, y: number, score: number, hold = false,
): CCMove => ({ piece, rotation, x, y, score, hold });

const moveOf = (type: Piece, rotation: Rotation, x: number, y: number): Move => ({
    type, rotation, coordinate: { x, y },
});

describe('move_match', () => {
    test('maps CC piece / rotation values into app values', () => {
        expect(ccMoveToMove(ccMove(2, 0, 4, 0, 1))).toEqual(moveOf(Piece.T, Rotation.Spawn, 4, 0));
        expect(ccMoveToMove(ccMove(0, 2, 1, 3, 1))).toEqual(moveOf(Piece.I, Rotation.Right, 1, 3));
        expect(ccMoveToMove(ccMove(6, 1, 7, 2, 1))).toEqual(moveOf(Piece.Z, Rotation.Reverse, 7, 2));
        expect(ccMoveToMove(ccMove(4, 3, 2, 5, 1))).toEqual(moveOf(Piece.J, Rotation.Left, 2, 5));
    });

    test('rejects out-of-range piece and rotation values', () => {
        expect(ccMoveToMove(ccMove(9, 0, 4, 0, 1))).toBeNull();
        expect(ccMoveToMove(ccMove(0, 9, 4, 0, 1))).toBeNull();
        expect(ccMoveCellKey(ccMove(9, 0, 4, 0, 1))).toBeNull();
    });

    test('cell keys ignore the order the cells are listed in', () => {
        const cells = getBlockPositions(Piece.S, Rotation.Spawn, 4, 1);
        expect(toCellKey(cells.slice().reverse())).toEqual(toCellKey(cells));
    });

    test('finds the played move by cell key and reports -1 when it is off the list', () => {
        const expected = moveOf(Piece.L, Rotation.Spawn, 3, 0);
        const results = [
            ccMove(2, 0, 6, 0, 120),                                   // T somewhere else
            ccMove(3, 0, expected.coordinate.x, expected.coordinate.y, 80),  // L, the played move
        ];

        expect(findPlacedIndexByKey(results, toOccupiedCellKey(expected))).toEqual(1);
        expect(findPlacedIndexByKey([results[0]], toOccupiedCellKey(expected))).toEqual(-1);
        expect(findPlacedIndexByKey([], toOccupiedCellKey(expected))).toEqual(-1);
    });

    // 同じマスを埋める別回転（例: I の Spawn と Reverse）は同一手として扱う。
    // 完全一致がある場合はそちらを優先する ―― 既存の 1 手スコア評価と同じ規則。
    test('prefers an exact match over a same-cells fallback', () => {
        const expected = moveOf(Piece.I, Rotation.Spawn, 4, 0);
        const expectedKey = toOccupiedCellKey(expected);

        // 同じセルを埋める別 (rotation, x, y) を探す
        let alias: Move | undefined;
        for (const rotation of [Rotation.Spawn, Rotation.Right, Rotation.Reverse, Rotation.Left]) {
            for (let x = 0; x < 10 && alias === undefined; x += 1) {
                for (let y = 0; y < 5 && alias === undefined; y += 1) {
                    const candidate = moveOf(Piece.I, rotation, x, y);
                    if (rotation === expected.rotation
                        && x === expected.coordinate.x && y === expected.coordinate.y) {
                        continue;
                    }
                    if (toOccupiedCellKey(candidate) === expectedKey) {
                        alias = candidate;
                    }
                }
            }
        }
        expect(alias).toBeDefined();

        const aliasResult = ccMove(0, alias!.rotation === Rotation.Reverse ? 1
            : alias!.rotation === Rotation.Right ? 2
            : alias!.rotation === Rotation.Left ? 3 : 0,
                                  alias!.coordinate.x, alias!.coordinate.y, 50);
        const exactResult = ccMove(0, 0, expected.coordinate.x, expected.coordinate.y, 90);

        // 別回転が先に並んでいても、完全一致の方を返す
        expect(findExactPlacedResult([aliasResult, exactResult], expected)).toBe(exactResult);
        // 完全一致が無ければ同一セルの候補へフォールバックする
        expect(findExactPlacedResult([aliasResult], expected)).toBe(aliasResult);
        expect(findExactPlacedResult([ccMove(2, 0, 6, 0, 10)], expected)).toBeNull();
    });
});

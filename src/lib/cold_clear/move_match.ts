import { Move } from '../fumen/types';
import { getBlockPositions } from '../piece';
import { CCMove, CC_ROTATION_TO_APP, CC_TO_PIECE } from './types';

// Cold Clear の候補手と「実際に置かれた手」を突き合わせる純粋モジュール。
// Editor の 1 手スコア評価（actions/cold_clear.ts）と、リプレイ解析の Worker が
// 同じ規則を使うためにここへ集約する。DOM にも state にも依存しない。

export const ccMoveToMove = (result: CCMove): Move | null => {
    const piece = CC_TO_PIECE[result.piece];
    const rotation = CC_ROTATION_TO_APP[result.rotation];

    if (piece === undefined || rotation === undefined) {
        return null;
    }

    return {
        rotation,
        type: piece,
        coordinate: {
            x: result.x,
            y: result.y,
        },
    };
};

export const isSameMove = (left: Move, right: Move): boolean => {
    return left.type === right.type
        && left.rotation === right.rotation
        && left.coordinate.x === right.coordinate.x
        && left.coordinate.y === right.coordinate.y;
};

// 占有セルの正規化キー。回転規則が違っても同じマスを埋める手は同一視する。
export const toCellKey = (cells: number[][]): string => {
    return cells.map(([x, y]) => `${x},${y}`).sort().join(';');
};

export const toOccupiedCellKey = (move: Move): string => {
    return toCellKey(getBlockPositions(move.type, move.rotation, move.coordinate.x, move.coordinate.y));
};

export const ccMoveCellKey = (result: CCMove): string | null => {
    const move = ccMoveToMove(result);
    return move === null ? null : toOccupiedCellKey(move);
};

// 候補列の中の実手の位置。完全一致を優先し、無ければ占有セル一致へフォールバックする。
// 見つからない場合は -1（= 圏外）。
export const findPlacedIndexByKey = (results: CCMove[], expectedCellKey: string): number => {
    for (let index = 0; index < results.length; index += 1) {
        const key = ccMoveCellKey(results[index]);
        if (key !== null && key === expectedCellKey) {
            return index;
        }
    }
    return -1;
};

export const findExactPlacedResult = (
    results: CCMove[],
    expectedMove: Move,
): CCMove | null => {
    const expectedCellKey = toOccupiedCellKey(expectedMove);
    let sameCellsResult: CCMove | null = null;

    for (const result of results) {
        const move = ccMoveToMove(result);
        if (!move) {
            continue;
        }

        if (isSameMove(move, expectedMove)) {
            return result;
        }

        if (!sameCellsResult && toOccupiedCellKey(move) === expectedCellKey) {
            sameCellsResult = result;
        }
    }

    return sameCellsResult;
};

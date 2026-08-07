import { FieldConstants, isMinoPiece, Piece, Rotation, toPositionIndex } from './enums';
import { Field } from './fumen/field';
import { Move } from './fumen/types';
import { inferPiece } from './inference';
import { getBlockPositions } from './piece';

// SPAWNミノとペイントブロックの相互変換の判定。状態には依存しない純関数として保つ。

export interface LiftableMino {
    piece: Piece;
    rotation: Rotation;
    coordinate: { x: number, y: number };
    indices: number[];  // 昇順
}

const byAscending = (a: number, b: number) => a - b;

// SPAWNミノが占めるセルのインデックス（昇順）
export const spawnMinoCellIndices = (piece: Move): number[] => (
    getBlockPositions(piece.type, piece.rotation, piece.coordinate.x, piece.coordinate.y)
        .map(toPositionIndex)
        .sort(byAscending)
);

const neighbourIndices = (index: number): number[] => {
    const x = index % FieldConstants.Width;
    const y = Math.floor(index / FieldConstants.Width);
    const result: number[] = [];
    if (0 < x) {
        result.push(index - 1);
    }
    if (x < FieldConstants.Width - 1) {
        result.push(index + 1);
    }
    if (0 < y) {
        result.push(index - FieldConstants.Width);
    }
    if (y < FieldConstants.Height - 1) {
        result.push(index + FieldConstants.Width);
    }
    return result;
};

// 同色4近傍で連結した集合。5個目が見つかった時点で打ち切る（ミノになりえないため）。
const sameColorGroup = (field: Field, index: number, color: Piece): number[] | undefined => {
    const visited = new Set<number>([index]);
    const stack = [index];
    while (0 < stack.length) {
        const current = stack.pop()!;
        for (const next of neighbourIndices(current)) {
            if (visited.has(next) || field.getAtIndex(next, true) !== color) {
                continue;
            }
            visited.add(next);
            if (4 < visited.size) {
                return undefined;
            }
            stack.push(next);
        }
    }
    return visited.size === 4 ? Array.from(visited).sort(byAscending) : undefined;
};

/**
 * 指定セルを含むペイントブロックが、そのままSPAWNミノにできるかを判定する。
 *
 * 条件は「色がI/L/O/Z/T/J/Sのいずれか」「同色で連結した集合がちょうど4セル」
 * 「その形が座標付きのミノとして解釈できる」「形から推論されたミノ種と実際の色が一致する」。
 * 最後の条件がないと、たとえばS字に塗られたTミノ色のブロックがTミノとして持ち上がってしまう。
 */
export const findLiftableMinoAt = (field: Field, index: number): LiftableMino | undefined => {
    const color = field.getAtIndex(index, true);
    if (!isMinoPiece(color)) {
        return undefined;
    }

    const indices = sameColorGroup(field, index, color);
    if (indices === undefined) {
        return undefined;
    }

    // inferPieceは引数配列をソートで破壊するため複製を渡す
    const inferred = inferPiece(indices.concat());
    if (inferred === undefined || inferred.coordinate === undefined || inferred.piece !== color) {
        return undefined;
    }

    return {
        indices,
        piece: inferred.piece,
        rotation: inferred.rotate,
        coordinate: inferred.coordinate,
    };
};

/**
 * 盤面上の持ち上げ可能なミノをすべて返す。ミノ化はユーザーが対象をタップして決めるため、
 * 前ページから継承したブロックも含めて等しく候補にする。
 *
 * 候補のセルをハイライトして「どれをタップできるか」を見せる用途で使う。
 */
export const findAllLiftableMinos = (field: Field): LiftableMino[] => {
    const found: LiftableMino[] = [];
    const claimed = new Set<number>();
    for (let index = 0; index < FieldConstants.PlayBlocks; index += 1) {
        if (claimed.has(index)) {
            continue;
        }
        const mino = findLiftableMinoAt(field, index);
        if (mino === undefined) {
            continue;
        }
        for (const cell of mino.indices) {
            claimed.add(cell);
        }
        found.push(mino);
    }
    return found;
};

// 候補セルの平坦なリスト。ハイライト適用に使う。
export const liftableCellIndices = (field: Field): number[] => {
    const indices: number[] = [];
    for (const mino of findAllLiftableMinos(field)) {
        indices.push(...mino.indices);
    }
    return indices;
};

// 候補が1つでもあるか。ボタンの活性判定は毎描画で走るので、見つかり次第打ち切る。
export const hasAnyLiftableMino = (field: Field): boolean => {
    for (let index = 0; index < FieldConstants.PlayBlocks; index += 1) {
        if (findLiftableMinoAt(field, index) !== undefined) {
            return true;
        }
    }
    return false;
};

import {
    nextRotationTo180, nextRotationToLeft, nextRotationToRight, parseRotationName, Piece, Rotation,
} from './enums';
import { testLeftRotation, testRightRotation } from './srs';

type Transition90 =
    | 'Spawn>Right' | 'Right>Spawn' | 'Right>Reverse' | 'Reverse>Right'
    | 'Reverse>Left' | 'Left>Reverse' | 'Left>Spawn' | 'Spawn>Left';

type Transition180 = 'Spawn>Reverse' | 'Reverse>Spawn' | 'Right>Left' | 'Left>Right';

// SRS+ (TETR.IO) の I ピース 90°キックは、guidelineと候補の集合は同じだが試行順序がy軸対称になるよう変更されている。
// 出典: note.com記事 https://note.com/wehqi/n/n6797e5134f3f （I.NE/EN/ES/SE/SW/WS/WN/NW）。
// Budget-Tetris-Engine https://github.com/TemariVirus/Budget-Tetris-Engine の src/kicks/srs_plus.zig と
// 基準セルシフト補正のうえ全件一致を確認済み（2026-07-09）。
const iKicks90: { [t in Transition90]: number[][] } = {
    'Spawn>Right': [[1, 0], [2, 0], [-1, 0], [-1, -1], [2, 2]],
    'Right>Spawn': [[-1, 0], [-2, 0], [1, 0], [-2, -2], [1, 1]],
    'Right>Reverse': [[0, -1], [-1, -1], [2, -1], [-1, 1], [2, -2]],
    'Reverse>Right': [[0, 1], [-2, 1], [1, 1], [-2, 2], [1, -1]],
    'Reverse>Left': [[-1, 0], [1, 0], [-2, 0], [1, 1], [-2, -2]],
    'Left>Reverse': [[1, 0], [2, 0], [-1, 0], [2, 2], [-1, -1]],
    'Left>Spawn': [[0, 1], [1, 1], [-2, 1], [1, -1], [-2, 2]],
    'Spawn>Left': [[0, -1], [-1, -1], [2, -1], [2, -2], [-1, 1]],
};

// I ピースの180°キック。出典: note.com記事のI.NS/SN/EW/WE。
// tetris.wiki掲載のosk氏（TETR.IO開発者）公式180°キック図と一致確認済み。
const iKicks180: { [t in Transition180]: number[][] } = {
    'Spawn>Reverse': [[1, -1], [1, 0]],
    'Reverse>Spawn': [[-1, 1], [-1, 0]],
    'Right>Left': [[-1, -1], [0, -1]],
    'Left>Right': [[1, 1], [0, 1]],
};

// O ピースの180°キック。占有セルが回転で変わらないため、常に成立する基準セルシフト分のみを持つ。
// 出典: note.com記事のO.NS/SN/EW/WE。
const oKicks180: { [t in Transition180]: number[][] } = {
    'Spawn>Reverse': [[1, 1]],
    'Reverse>Spawn': [[-1, -1]],
    'Right>Left': [[1, -1]],
    'Left>Right': [[-1, 1]],
};

// J/L/S/Z/T 共通の180°キック（記事内ではLピースの数値をJ/S/Z/Tが参照）。
// 出典: note.com記事のL.NS/SN/EW/WE。
// Reverse>Spawn の3・4番目のみ、osk氏公式図（tetris.wiki "TETR.IO_180kicks.png"）に基づき記事の誤植を修正済み
// （記事: (-1,+1)(+1,+1) → 正: (-1,-1)(+1,-1)。Spawn>Reverseの上下鏡映になるのが正しい）。
const jlstzKicks180: { [t in Transition180]: number[][] } = {
    'Spawn>Reverse': [[0, 0], [0, 1], [1, 1], [-1, 1], [1, 0], [-1, 0]],
    'Reverse>Spawn': [[0, 0], [0, -1], [-1, -1], [1, -1], [-1, 0], [1, 0]],
    'Right>Left': [[0, 0], [1, 0], [1, 2], [1, 1], [0, 2], [0, 1]],
    'Left>Right': [[0, 0], [-1, 0], [-1, 2], [-1, 1], [0, 2], [0, 1]],
};

const kicks180For = (piece: Piece): { [t in Transition180]: number[][] } => {
    switch (piece) {
    case Piece.I:
        return iKicks180;
    case Piece.O:
        return oKicks180;
    default:
        return jlstzKicks180;
    }
};

export const testLeftRotationSrsPlus = (piece: Piece, currentRotation: Rotation) => {
    if (piece !== Piece.I) {
        return testLeftRotation(piece, currentRotation);
    }

    const nextRotation = nextRotationToLeft(currentRotation);
    const key = `${parseRotationName(currentRotation)}>${parseRotationName(nextRotation)}` as Transition90;

    return { test: iKicks90[key], rotation: nextRotation };
};

export const testRightRotationSrsPlus = (piece: Piece, currentRotation: Rotation) => {
    if (piece !== Piece.I) {
        return testRightRotation(piece, currentRotation);
    }

    const nextRotation = nextRotationToRight(currentRotation);
    const key = `${parseRotationName(currentRotation)}>${parseRotationName(nextRotation)}` as Transition90;

    return { test: iKicks90[key], rotation: nextRotation };
};

export const test180Rotation = (piece: Piece, currentRotation: Rotation) => {
    const nextRotation = nextRotationTo180(currentRotation);
    const key = `${parseRotationName(currentRotation)}>${parseRotationName(nextRotation)}` as Transition180;

    return { test: kicks180For(piece)[key], rotation: nextRotation };
};

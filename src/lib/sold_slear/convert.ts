import { CCMove, PIECE_TO_CC } from '../cold_clear/types';
import { Piece } from '../enums';
import { F14Spin, toF14Spin } from './chain';
import { PieceLetter } from './request';

// Sold Slear の f14_decision 応答を、Cold Clear と共通の CCMove 列へ変換する純粋モジュール。
// CC2 の location（x, y, orientation）は、アプリの Move と同じミノ形状・回転中心を使う
// （CC2 data.rs の Piece::cells と src/lib/piece.ts の getPieces が一致する）。
// そのため座標はそのまま使い、向きの名前だけ Cold Clear の回転番号へ写す。

export interface F14Location {
    type: string;
    orientation: string;
    x: number;
    y: number;
}

export interface F14Identity {
    location: F14Location;
    spin?: string;
}

export interface F14Decision {
    type: 'f14_decision';
    status: 'move' | 'root-no-move' | 'incomplete' | 'unsupported' | 'error';
    reason?: string;
    selectedIdentity?: string;
    ranking?: {
        identities?: string[];
        selectedCc2Rank?: number;
        rescueApplied?: boolean;
    };
}

// Cold Clear の RotationState: North=0, South=1, East=2, West=3
const ORIENTATION_TO_CC: Record<string, number> = {
    north: 0,
    south: 1,
    east: 2,
    west: 3,
};

const LETTER_TO_PIECE: Record<string, Piece> = {
    I: Piece.I,
    J: Piece.J,
    L: Piece.L,
    O: Piece.O,
    S: Piece.S,
    T: Piece.T,
    Z: Piece.Z,
};

export const PIECE_TO_LETTER: Record<number, PieceLetter> = {
    [Piece.I]: 'I',
    [Piece.J]: 'J',
    [Piece.L]: 'L',
    [Piece.O]: 'O',
    [Piece.S]: 'S',
    [Piece.T]: 'T',
    [Piece.Z]: 'Z',
};

// アプリ Field の高さ（23 行）。これより上にかかる手はアプリの盤面へ置けない。
const APP_FIELD_HEIGHT = 23;
// CC2 の各ミノのセル（North 向き、location からの相対）。data.rs の Piece::cells と同一
const PIECE_CELLS: Record<string, [number, number][]> = {
    I: [[-1, 0], [0, 0], [1, 0], [2, 0]],
    O: [[0, 0], [1, 0], [0, 1], [1, 1]],
    T: [[-1, 0], [0, 0], [1, 0], [0, 1]],
    L: [[-1, 0], [0, 0], [1, 0], [1, 1]],
    J: [[-1, 0], [0, 0], [1, 0], [-1, 1]],
    S: [[-1, 0], [0, 0], [0, 1], [1, 1]],
    Z: [[-1, 1], [0, 1], [0, 0], [1, 0]],
};

const rotateCell = (orientation: string, [x, y]: [number, number]): [number, number] => {
    switch (orientation) {
    case 'east':
        return [y, -x];
    case 'south':
        return [-x, -y];
    case 'west':
        return [-y, x];
    default:
        return [x, y];
    }
};

// CC2 の定義どおりに絶対セルを求める。変換の検算とテストに使う。
export const f14LocationCells = (location: F14Location): [number, number][] | null => {
    const cells = PIECE_CELLS[location.type];
    if (cells === undefined || ORIENTATION_TO_CC[location.orientation] === undefined) {
        return null;
    }
    return cells.map((cell) => {
        const [dx, dy] = rotateCell(location.orientation, cell);
        return [location.x + dx, location.y + dy] as [number, number];
    });
};

export const parseF14Identity = (identity: string): F14Identity | null => {
    try {
        const parsed = JSON.parse(identity);
        const location = parsed?.location;
        if (location === null || typeof location !== 'object'
            || typeof location.type !== 'string' || typeof location.orientation !== 'string'
            || !Number.isInteger(location.x) || !Number.isInteger(location.y)) {
            return null;
        }
        return { location, spin: typeof parsed.spin === 'string' ? parsed.spin : undefined };
    } catch (e) {
        return null;
    }
};

export interface SoldSlearMove extends CCMove {
    s2: {
        spin: F14Spin;
        identity: string;
    };
}

// current と違うミノを置く手は HOLD を使った手。
export const identityToMove = (
    identity: string, current: PieceLetter,
): SoldSlearMove | null => {
    const parsed = parseF14Identity(identity);
    if (parsed === null) {
        return null;
    }
    const { location } = parsed;
    const piece = LETTER_TO_PIECE[location.type];
    const rotation = ORIENTATION_TO_CC[location.orientation];
    const cells = f14LocationCells(location);
    if (piece === undefined || rotation === undefined || cells === null) {
        return null;
    }
    if (cells.some(([x, y]) => x < 0 || 10 <= x || y < 0 || APP_FIELD_HEIGHT <= y)) {
        return null;
    }
    return {
        rotation,
        hold: location.type !== current,
        piece: PIECE_TO_CC[piece],
        x: location.x,
        y: location.y,
        s2: { identity, spin: toF14Spin(parsed.spin) },
    };
};

export type DecisionOutcome =
    | { kind: 'moves'; moves: SoldSlearMove[]; returnedCount: number }
    | { kind: 'noMove' }
    | { kind: 'error'; message: string };

// 推奨手（rescue 適用後の最終選択）を先頭に、残りは CC2 順位順に並べる。
// 盤面へ適用できない候補（23 行を超えるなど）は除外する。
export const decisionToMoves = (decision: F14Decision, current: PieceLetter): DecisionOutcome => {
    if (decision.status === 'root-no-move') {
        return { kind: 'noMove' };
    }
    if (decision.status !== 'move') {
        return { kind: 'error', message: `Sold Slear: ${decision.status} (${decision.reason ?? 'unknown'})` };
    }
    const identities = decision.ranking?.identities ?? [];
    const selected = decision.selectedIdentity;
    const ordered = selected !== undefined && identities.includes(selected)
        ? [selected, ...identities.filter(identity => identity !== selected)]
        : identities.slice();
    const moves: SoldSlearMove[] = [];
    for (const identity of ordered) {
        const move = identityToMove(identity, current);
        if (move !== null) {
            moves.push(move);
        }
    }
    if (moves.length === 0) {
        return { kind: 'noMove' };
    }
    return { moves, kind: 'moves', returnedCount: ordered.length };
};

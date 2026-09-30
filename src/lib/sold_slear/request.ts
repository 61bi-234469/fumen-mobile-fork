import { F14Execution, F14_COMPAT_RULESET_ID, F14_QUEUE_LIMIT, F14_QUEUE_MINIMUM } from './profile';
import { S2Chain } from './chain';

// アプリの局面（色付き盤面・キュー・連鎖状態）を Sold Slear の f14_decide 要求へ変換する純粋モジュール。
// start（CC2 の TBP 形式）と selector（S2 canonical 形式）は WASM 側で完全一致を検査されるため、
// 同じ入力から両方を組み立てる。

export const BOARD_WIDTH = 10;
export const BOARD_HEIGHT = 40;
export const BOARD_CELL_COUNT = BOARD_WIDTH * BOARD_HEIGHT;
const EMPTY_CELL = '_';
const PIECE_LETTERS = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];
const CELL_LETTERS = [...PIECE_LETTERS, 'G'];

export type PieceLetter = 'I' | 'J' | 'L' | 'O' | 'S' | 'T' | 'Z';

export interface SoldSlearPosition {
    // 400 文字。index = y * 10 + x（y = 0 が最下段）。空きは '_'、ブロックは IJLOSTZG
    cells: string;
    hold: PieceLetter | null;
    // [current, ...next]
    queue: PieceLetter[];
    chain: S2Chain;
}

export type F14Cell = PieceLetter | 'G' | null;

export interface F14DecideRequest {
    type: 'f14_decide';
    schemaVersion: 1;
    requestId: string;
    positionId: string;
    generation: number;
    execution: F14Execution;
    start: {
        board: F14Cell[][];
        queue: PieceLetter[];
        hold: PieceLetter | null;
        combo: number;
        back_to_back: boolean;
        b2b: number;
        randomizer: { type: 'seven_bag'; bag_state: PieceLetter[] };
    };
    selector: {
        rulesetId: string;
        board: {
            fidelity: 'exact';
            width: number;
            height: number;
            visibleHeight: number;
            bufferHeight: number;
            cells: string;
        };
        pieces: { current: PieceLetter; hold: PieceLetter | null; holdAvailable: true; known: PieceLetter[] };
        chain: S2Chain;
        time: { logicalFrame: number; frameSemantics: 'engine-frame'; piecesPlaced: number; fidelity: 'exact' };
        incoming: { pendingRows: number; dueThisLockRows: number };
    };
}

export type RequestBuildError = 'shortQueue' | 'invalidBoard' | 'invalidPiece';

const nonNegativeInteger = (value: number): number => (
    Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0
);

export const isPieceLetter = (value: unknown): value is PieceLetter => (
    typeof value === 'string' && PIECE_LETTERS.includes(value)
);

const toBoardRows = (cells: string): F14Cell[][] => {
    const rows: F14Cell[][] = [];
    for (let y = 0; y < BOARD_HEIGHT; y += 1) {
        const row: F14Cell[] = [];
        for (let x = 0; x < BOARD_WIDTH; x += 1) {
            const cell = cells[y * BOARD_WIDTH + x];
            row.push(cell === EMPTY_CELL ? null : cell as F14Cell);
        }
        rows.push(row);
    }
    return rows;
};

export const buildF14DecideRequest = (
    position: SoldSlearPosition,
    execution: F14Execution,
    requestId: string,
): { request?: F14DecideRequest; error?: RequestBuildError } => {
    const { cells, hold, queue } = position;
    if (cells.length !== BOARD_CELL_COUNT
        || Array.prototype.some.call(cells, (cell: string) => cell !== EMPTY_CELL && !CELL_LETTERS.includes(cell))) {
        return { error: 'invalidBoard' };
    }
    if ((hold !== null && !isPieceLetter(hold)) || queue.some(piece => !isPieceLetter(piece))) {
        return { error: 'invalidPiece' };
    }
    // current + NEXT 1 個未満で呼ぶと WASM が trap する
    if (queue.length < F14_QUEUE_MINIMUM) {
        return { error: 'shortQueue' };
    }

    const known = queue.slice(0, F14_QUEUE_LIMIT);
    const combo = nonNegativeInteger(position.chain.combo);
    const b2b = nonNegativeInteger(position.chain.b2b);

    return {
        request: {
            requestId,
            execution,
            type: 'f14_decide',
            schemaVersion: 1,
            positionId: `${requestId}-position`,
            generation: 1,
            start: {
                hold,
                combo,
                b2b,
                board: toBoardRows(cells),
                queue: known,
                back_to_back: b2b > 0,
                randomizer: { type: 'seven_bag', bag_state: [] },
            },
            selector: {
                rulesetId: F14_COMPAT_RULESET_ID,
                board: {
                    cells,
                    fidelity: 'exact',
                    width: BOARD_WIDTH,
                    height: BOARD_HEIGHT,
                    visibleHeight: 20,
                    bufferHeight: 20,
                },
                pieces: { hold, current: known[0], holdAvailable: true, known: known.slice(1) },
                chain: { combo, b2b },
                time: { logicalFrame: 0, frameSemantics: 'engine-frame', piecesPlaced: 0, fidelity: 'exact' },
                // s2-bot-lab の要求ビルダー（assertF14StartSelectorProjection）は、この profile の
                // incoming を 0 に限る。せり上がり予告は渡さない
                incoming: { pendingRows: 0, dueThisLockRows: 0 },
            },
        },
    };
};

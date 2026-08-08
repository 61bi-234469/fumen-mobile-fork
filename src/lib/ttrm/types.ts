import { Piece } from '../enums';

// ---- .ttrm raw data (only the parts this feature consumes) ----

export interface TtrmEvent {
    frame: number;
    type: string;
    data?: any;
}

export interface TtrmPlayerReplay {
    frames: number;
    events: TtrmEvent[];
    options: { [key: string]: any };
    results: {
        stats: {
            piecesplaced: number;
            lines: number;
            garbage: { sent: number; received: number; attack: number };
            [key: string]: any;
        };
        gameoverreason: string;
        [key: string]: any;
    };
}

export interface TtrmPlayerRound {
    id: string;
    username: string;
    alive: boolean;
    replay: TtrmPlayerReplay;
    [key: string]: any;
}

export interface TtrmFile {
    id?: string;
    gamemode?: string;
    ts?: string;
    version?: number;
    users?: { id: string; username: string; [key: string]: any }[];
    replay: {
        leaderboard?: any[];
        rounds: TtrmPlayerRound[][];
    };
}

// ---- Intermediate representation (ReplayIR) ----

// 10x23 play field cells, row-major with y=0 at the bottom (same layout as
// Field#toPlayFieldPieces). Kept as a plain array so it survives postMessage.
export type IRField = Piece[];

export type TtrmSpinType = 'none' | 'mini' | 'normal';

export interface LockClear {
    lines: number;
    spin: TtrmSpinType;
    b2b: number;
    ren: number;
    perfectClear: boolean;
}

export interface LockPoint {
    pieceIndex: number;
    frame: number;
    fieldBefore: IRField;
    fieldAfter: IRField;
    piece: Piece;
    rotation: number;
    x: number;
    y: number;
    hold: Piece | null;
    // 設置直後に操作対象となっているミノ。falling.lock 時点で次のミノは
    // すでに spawn されているため、next[] とは別に保持する。
    current: Piece | null;
    // エンジンが保持している NEXT を全件。表示は画面側で切る
    next: Piece[];
    clear: LockClear;
    attack: number;
    garbageGauge: number;
    pendingHoles: number;
    sourceHeight: number;
    clippedRowCount: number;
}

// State after the last lock, ticked through to replay.frames. The losing
// side's terminal board contains the killing garbage, which no lock captures.
export interface TerminalPoint {
    frame: number;
    field: IRField;
    sourceHeight: number;
    clippedRowCount: number;
    garbageGauge: number;
    hold: Piece | null;
    current: Piece | null;
    // エンジンが保持している NEXT を全件。表示は画面側で切る
    next: Piece[];
    reason: string;
    alive: boolean;
}

export interface GarbageEvent {
    frame: number;
    kind: 'receive' | 'tank' | 'cancel';
    amount: number;
    column?: number;
    size?: number;
}

export interface VerificationValue {
    expected: number;
    actual: number;
}

export interface PlayerVerification {
    piecesplaced: VerificationValue;
    lines: VerificationValue;
    sent: VerificationValue;
    matched: boolean;
}

export interface PlayerRoundIR {
    id: string;
    username: string;
    resolvedOptions: { [key: string]: any };
    optionWarnings: string[];
    locks: LockPoint[];
    terminal: TerminalPoint;
    garbageEvents: GarbageEvent[];
    verification: PlayerVerification;
}

export interface RoundFailure {
    stage: string;
    message: string;
}

export interface RoundIR {
    index: number;
    startFrame: number;
    endFrame: number;
    result: {
        winnerId: string | null;
        reasons: { [playerId: string]: string };
    };
    status: 'ok' | 'failed';
    failure?: RoundFailure;
    players: PlayerRoundIR[];
}

export interface ReplayMeta {
    users: { id: string; username: string }[];
    gamemode: string;
    ts: string;
    version: number;
}

export interface ReplayIR {
    meta: ReplayMeta;
    rounds: RoundIR[];
}

// ---- Worker messages ----

export type ReplayWorkerRequest = {
    type: 'parse';
    text: string;
};

export type ReplayWorkerResponse =
    | { type: 'ir'; ir: ReplayIR }
    | { type: 'error'; stage: string; message: string };

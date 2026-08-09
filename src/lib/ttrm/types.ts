import { GarbageQueueSnapshot } from '@haelp/teto/engine';
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

// Worker で Engine を再生した結果から作る、表示用の軽量な変化点。
// raw key event は UI で再解釈せず、Engine が確定した姿勢だけを渡す。
export interface ReplayActiveFrame {
    frame: number;
    piece: Piece;
    rotation: number;
    x: number;
    y: number;
    cells: [number, number][];
}

export interface ReplayBoardFrame {
    frame: number;
    field: IRField;
    sourceHeight: number;
    clippedRowCount: number;
}

export interface ReplayQueueFrame {
    frame: number;
    hold: Piece | null;
    current: Piece | null;
    next: Piece[];
}

export interface ReplayGarbageFrame {
    frame: number;
    snapshot: GarbageQueueSnapshot;
}

export interface ReplayVisualTimeline {
    active: ReplayActiveFrame[];
    boards: ReplayBoardFrame[];
    queues: ReplayQueueFrame[];
    garbage: ReplayGarbageFrame[];
}

// 任意フレームを描画・INPUT 切り出しへ渡すときの合成済み表現。
export interface ReplayVisualState {
    frame: number;
    field: IRField;
    sourceHeight: number;
    clippedRowCount: number;
    active?: ReplayActiveFrame;
    hold: Piece | null;
    current: Piece | null;
    next: Piece[];
    garbage?: ReplayGarbageFrame;
}

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
    // 恒等式の突き合わせ先（P3 §3-3）。表示は garbage.ts の gaugeAtFrame に一本化する。
    garbageGauge: number;
    sourceHeight: number;
    clippedRowCount: number;
}

// ラウンド開始地点（設置 0 手目）。相手の初手は自陣より後になることが普通にあるため、
// 「まだ 1 手も置いていない」状態を指せないと共通フレーム軸で盤面を返せない（P2 §3-3）。
export interface InitialPoint {
    frame: number;          // 常に 0
    field: IRField;         // 開始時の盤面（実質は空）
    hold: Piece | null;     // 常に null
    current: Piece | null;  // 最初に操作するミノ
    next: Piece[];          // 開始時のキュー全件
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

export type GarbageEventKind = 'receive' | 'confirm' | 'tank' | 'cancel';

// P3 §3-3。1 回の攻撃は iid で同定される。garbageQueue.queue の要素は iid を
// 持たない（cid / gameid のみ）ので、parcel はこのイベント列だけから組む。
export interface GarbageEvent {
    frame: number;
    kind: GarbageEventKind;
    iid: number;
    amount: number;        // confirm は 0
    column?: number;       // tank のみ。実際に穴が開いた列
    size?: number;         // receive / tank / cancel
    gameid?: number;       // confirm のみ（送信元）
    senderFrame?: number;  // confirm のみ（送信側クロック）
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
    initial: InitialPoint;
    locks: LockPoint[];
    terminal: TerminalPoint;
    garbageEvents: GarbageEvent[];
    // Production の Worker IR は常に持つ。optional は既存の手作り test IR と
    // 後方互換のためで、timeline.ts は確定 ReplayPoint へフォールバックする。
    visual?: ReplayVisualTimeline;
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
    // 取り込み全体の解析所要時間（ミリ秒）。NFR-02 の実測を選択フェーズで出すために持つ。
    parseMs: number;
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

import { FieldConstants, Piece } from '../enums';
import { gaugeAtFrame, getGarbageTimeline, tankedAtFrame } from './garbage';
import {
    IRField,
    LockPoint,
    PlayerRoundIR,
    ReplayActiveFrame,
    ReplayBoardFrame,
    ReplayGarbageFrame,
    ReplayQueueFrame,
    ReplayVisualState,
} from './types';

// P2 §3-2「ポイント空間」。プレイヤー 1 人あたり、盤面が確定している地点を 1 本の配列として扱う。
//
//   index 0     : initial   ラウンド開始（設置 0）。frame = 0
//   index 1..L  : locks[index - 1]
//   index L + 1 : terminal  終端フレーム
//
// index がそのまま画面の手番番号になる（locks[0] が「手番 1」）。
// IR にも state にも依存しない純関数だけを置く。

export type ReplayPointKind = 'initial' | 'lock' | 'terminal';

export interface ReplayPoint {
    kind: ReplayPointKind;
    index: number;
    frame: number;
    field: IRField;
    hold: Piece | null;
    current: Piece | null;
    next: Piece[];
    clippedRowCount: number;
}

export const FRAMES_PER_SECOND = 60;

export const pointCount = (player: PlayerRoundIR): number => player.locks.length + 2;

export const lastPointIndex = (player: PlayerRoundIR): number => pointCount(player) - 1;

export const clampPointIndex = (player: PlayerRoundIR, index: number): number =>
    Math.min(lastPointIndex(player), Math.max(0, index));

export const pointAt = (player: PlayerRoundIR, index: number): ReplayPoint => {
    const clamped = clampPointIndex(player, index);
    if (clamped === 0) {
        const { initial } = player;
        return {
            index: 0,
            kind: 'initial',
            frame: initial.frame,
            field: initial.field,
            hold: initial.hold,
            current: initial.current,
            next: initial.next,
            clippedRowCount: 0,
        };
    }
    if (clamped === lastPointIndex(player)) {
        const { terminal } = player;
        return {
            index: clamped,
            kind: 'terminal',
            frame: terminal.frame,
            field: terminal.field,
            hold: terminal.hold,
            current: terminal.current,
            next: terminal.next,
            clippedRowCount: terminal.clippedRowCount,
        };
    }
    const lock = player.locks[clamped - 1];
    return {
        index: clamped,
        kind: 'lock',
        frame: lock.frame,
        field: lock.fieldAfter,
        hold: lock.hold,
        current: lock.current,
        next: lock.next,
        clippedRowCount: lock.clippedRowCount,
    };
};

export const frameAt = (player: PlayerRoundIR, index: number): number =>
    pointAt(player, index).frame;

// f 以前で最後に確定した地点。同一 frame に複数の lock が並ぶ（1 フレーム内の連続設置）
// ことがあるため、<= を満たす最後の要素を返す。
export const indexAtFrame = (player: PlayerRoundIR, frame: number): number => {
    if (player.terminal.frame <= frame) {
        return lastPointIndex(player);
    }
    const { locks } = player;
    if (locks.length === 0 || frame < locks[0].frame) {
        return 0;
    }
    // locks[lo].frame <= frame < locks[hi].frame を保ちながら詰める
    let lo = 0;
    let hi = locks.length;
    while (lo + 1 < hi) {
        const mid = (lo + hi) >>> 1;
        if (locks[mid].frame <= frame) {
            lo = mid;
        } else {
            hi = mid;
        }
    }
    return lo + 1;
};

const visualFrame = (player: PlayerRoundIR, frame: number): number => {
    const finite = Number.isFinite(frame) ? frame : 0;
    return Math.min(player.terminal.frame, Math.max(0, Math.floor(finite)));
};

// frame <= target を満たす最後の変化点。UI と INPUT 切り出しの双方が同じ境界規則を使う。
export const changePointAtFrame = <T extends { frame: number }>(
    points: T[], frame: number,
): T | undefined => {
    if (points.length === 0 || frame < points[0].frame) {
        return undefined;
    }
    let lo = 0;
    let hi = points.length;
    while (lo + 1 < hi) {
        const mid = (lo + hi) >>> 1;
        if (points[mid].frame <= frame) {
            lo = mid;
        } else {
            hi = mid;
        }
    }
    return points[lo];
};

const sourceHeightOf = (field: IRField): number => {
    for (let y = FieldConstants.Height - 1; 0 <= y; y -= 1) {
        const start = y * FieldConstants.Width;
        if (field.slice(start, start + FieldConstants.Width).some(cell => cell !== Piece.Empty)) {
            return y + 1;
        }
    }
    return 0;
};

const fallbackBoardAtFrame = (player: PlayerRoundIR, frame: number): ReplayBoardFrame => {
    const index = indexAtFrame(player, frame);
    if (index === 0) {
        return {
            frame: player.initial.frame,
            field: player.initial.field,
            sourceHeight: sourceHeightOf(player.initial.field),
            clippedRowCount: 0,
        };
    }
    if (index === lastPointIndex(player)) {
        return {
            frame: player.terminal.frame,
            field: player.terminal.field,
            sourceHeight: player.terminal.sourceHeight,
            clippedRowCount: player.terminal.clippedRowCount,
        };
    }
    const lock = player.locks[index - 1];
    return {
        frame: lock.frame,
        field: lock.fieldAfter,
        sourceHeight: lock.sourceHeight,
        clippedRowCount: lock.clippedRowCount,
    };
};

export const boardAtFrame = (player: PlayerRoundIR, frame: number): ReplayBoardFrame => {
    const target = visualFrame(player, frame);
    return changePointAtFrame(player.visual?.boards ?? [], target)
        ?? fallbackBoardAtFrame(player, target);
};

export const queueAtFrame = (player: PlayerRoundIR, frame: number): ReplayQueueFrame => {
    const target = visualFrame(player, frame);
    const point = changePointAtFrame(player.visual?.queues ?? [], target);
    if (point !== undefined) {
        return point;
    }
    const fallback = pointAt(player, indexAtFrame(player, target));
    return {
        frame: fallback.frame,
        hold: fallback.hold,
        current: fallback.current,
        next: fallback.next,
    };
};

export const activeAtFrame = (
    player: PlayerRoundIR, frame: number,
): ReplayActiveFrame | undefined => {
    const target = visualFrame(player, frame);
    if (player.terminal.frame <= target) {
        return undefined;
    }
    const active = changePointAtFrame(player.visual?.active ?? [], target);
    const point = pointAt(player, indexAtFrame(player, target));
    // 最新 lock 以降に新 active が無ければ、次の spawn まで直前ミノを再表示しない。
    if (point.kind === 'lock' && (active === undefined || active.frame < point.frame)) {
        return undefined;
    }
    return active;
};

export const garbageAtFrame = (
    player: PlayerRoundIR, frame: number,
): ReplayGarbageFrame | undefined => {
    const target = visualFrame(player, frame);
    return changePointAtFrame(player.visual?.garbage ?? [], target);
};

export const visualAtFrame = (player: PlayerRoundIR, frame: number): ReplayVisualState => {
    const target = visualFrame(player, frame);
    const board = boardAtFrame(player, target);
    const queue = queueAtFrame(player, target);
    return {
        frame: target,
        field: board.field,
        sourceHeight: board.sourceHeight,
        clippedRowCount: board.clippedRowCount,
        active: activeAtFrame(player, target),
        hold: queue.hold,
        current: queue.current,
        next: queue.next,
        garbage: garbageAtFrame(player, target),
    };
};

// 手番 index（1..L）の「接地直前」地点。設置は済んでいるが確定していない瞬間を指す。
// 確定地点を返す pointAt とは別の概念なので、ポイント空間そのものには触れない。
export interface ReplayPreLockPoint {
    index: number;           // 手番番号。停止地点の index と同じ
    frame: number;           // locks[index - 1].frame - 1
    confirmedIndex: number;  // この時点で確定している設置数（= ポイント空間の index）
    visual: ReplayVisualState;
}

// falling.lock.pre で採った設置姿勢。visual timeline の active は「その frame の最終状態」なので、
// ハードドロップした手番では 1 フレーム前がまだ空中にある。接地位置は lock 側からしか取れない。
const preLockActiveOf = (lock: LockPoint, frame: number): ReplayActiveFrame | undefined => {
    if (lock.cells === undefined || lock.cells.length === 0) {
        return undefined;
    }
    return {
        frame,
        piece: lock.piece,
        rotation: lock.rotation,
        x: lock.x,
        y: lock.y,
        cells: lock.cells.map(([x, y]) => [x, y] as [number, number]),
    };
};

// 設置直前の盤面へ、その手のセルがまだ入っていないこと。1 フレーム内の連続設置で
// 直前の変化点にひとつ前の設置が含まれないことがあり、そのまま出すと別の局面になる。
const fitsOnBoard = (field: IRField, cells: [number, number][]): boolean => cells.every(([x, y]) => {
    if (x < 0 || FieldConstants.Width <= x || y < 0 || FieldConstants.Height <= y) {
        return true;
    }
    return field[y * FieldConstants.Width + x] === Piece.Empty;
});

// 復元できない手番では undefined を返し、呼び出し側は従来の確定地点表示へ落とす。
export const preLockPointAt = (
    player: PlayerRoundIR, index: number,
): ReplayPreLockPoint | undefined => {
    const lock = player.locks[index - 1];
    if (index < 1 || lock === undefined || lock.frame <= 0) {
        return undefined;
    }
    // 直前の lock が同一フレームなら、この手の設置直前盤面は残っていない
    const previous = player.locks[index - 2];
    if (previous !== undefined && lock.frame <= previous.frame) {
        return undefined;
    }
    const frame = lock.frame - 1;
    const active = preLockActiveOf(lock, frame);
    if (active === undefined) {
        return undefined;
    }
    const board = boardAtFrame(player, frame);
    if (!fitsOnBoard(board.field, active.cells)) {
        return undefined;
    }
    return {
        index,
        frame,
        confirmedIndex: index - 1,
        visual: {
            frame,
            active,
            field: board.field,
            sourceHeight: board.sourceHeight,
            clippedRowCount: board.clippedRowCount,
            // HOLD は設置と spawn では動かないので lock の値がそのまま接地直前の値になる。
            // NEXT は lock 後に spawn したミノを先頭へ戻すと接地直前の並びになる。
            hold: lock.hold,
            current: lock.piece,
            next: lock.current !== null ? [lock.current, ...lock.next] : lock.next,
            garbage: garbageAtFrame(player, frame),
        },
    };
};

// 手番送りの着地フレーム。接地直前が復元できない地点では従来どおり確定地点のフレーム。
export const stopFrameAt = (player: PlayerRoundIR, index: number): number =>
    preLockPointAt(player, index)?.frame ?? frameAt(player, index);

export const framesToSeconds = (frames: number): number => frames / FRAMES_PER_SECOND;

// mm:ss.s（P2 §7-4）。総時間も同じ書式で出す。
export const formatFrameTime = (frames: number): string => {
    const seconds = Math.max(0, framesToSeconds(frames));
    const minutes = Math.floor(seconds / 60);
    const rest = seconds - minutes * 60;
    return `${minutes}:${rest < 10 ? '0' : ''}${rest.toFixed(1)}`;
};

export interface ReplayStats {
    // 表示上の手番番号（1..L）。initial は 0、terminal は L のまま据え置く。
    placed: number;
    totalLocks: number;
    frame: number;
    seconds: number;
    pps: number;
    apm: number;
    b2b: number;
    ren: number;
    attack: number;
    // P3 §3-8。TETR.IO の received は再現不能と確定したため、エンジン基準で
    // 自己整合する 2 つ（現在の保留量と被弾累計）を出す。ラベルは ☢ で区別する。
    gauge: number;
    tanked: number;
}

// FR-26。TETR.IO の received は出さない（R7 は「再現不能」としてクローズ / §3-8）。
//
// ガベージの 2 値だけは frame を明示できる。ゲージはカーソルの瞬間の量であり、
// 盤面が確定した最後の設置フレームではないため ―― 省略するとゲージバー（cursor.frame）と
// 統計行（lock の frame）で違う数字が並ぶ。
export const statsAt = (
    player: PlayerRoundIR, index: number, frame?: number,
): ReplayStats => {
    const point = pointAt(player, index);
    // terminal では最後の lock までを集計対象にする
    const placed = point.kind === 'initial' ? 0
        : point.kind === 'terminal' ? player.locks.length
        : point.index;
    const counted = player.locks.slice(0, placed);
    const attack = counted.reduce((sum, lock) => sum + lock.attack, 0);
    const seconds = framesToSeconds(point.frame);
    const last = counted[counted.length - 1];
    const garbage = getGarbageTimeline(player);
    const garbageFrame = frame !== undefined ? frame : point.frame;
    return {
        placed,
        attack,
        seconds,
        gauge: gaugeAtFrame(garbage, garbageFrame),
        tanked: tankedAtFrame(garbage, garbageFrame),
        frame: point.frame,
        totalLocks: player.locks.length,
        // 経過 0 秒（開始地点や 1 フレーム目）でのゼロ除算を避ける
        pps: seconds > 0 ? placed / seconds : 0,
        apm: seconds > 0 ? attack * 60 / seconds : 0,
        b2b: last !== undefined ? Math.max(0, last.clear.b2b) : 0,
        // エンジンの combo はコンボが途切れている間 -1 になる。表示上は 0 に丸める。
        ren: last !== undefined ? Math.max(0, last.clear.ren) : 0,
    };
};

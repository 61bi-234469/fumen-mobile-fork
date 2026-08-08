import { Piece } from '../enums';
import { gaugeAtFrame, getGarbageTimeline, tankedAtFrame } from './garbage';
import { IRField, PlayerRoundIR } from './types';

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

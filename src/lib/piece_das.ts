// ミノの左右移動ホールド(DAS/ARR)を管理するエンジン
// - 押下直後に1回移動し、DAS経過後はARR間隔でリピートする
// - ARRが0以下のときはDAS経過後に端まで即移動する（従来動作）
// - ホールドはIDごとに独立して管理するため、複数ボタン/キーの同時押しが可能

interface DasHoldCallbacks {
    // 1マス移動
    move: () => void;
    // 端まで移動（ARR=0のとき使用）
    moveToEnd: () => void;
}

export interface DasHoldOptions extends DasHoldCallbacks {
    dasFrames: number;
    arrFrames: number;
}

interface HoldState {
    dasTimer: ReturnType<typeof setTimeout> | null;
    arrTimer: ReturnType<typeof setInterval> | null;
    cutTimer: ReturnType<typeof setTimeout> | null;
    arrActive: boolean;
    move: () => void;
    moveToEnd: () => void;
    arrFrames: number;
    cutVersion: number;
}

const holds = new Map<string, HoldState>();
const softDropHolds = new Map<string, ReturnType<typeof setInterval>>();

export const FRAME_DURATION_MS = 1000 / 60;

export const framesToMilliseconds = (frames: number): number => {
    return Math.max(0, frames) * FRAME_DURATION_MS;
};

export const millisecondsToFrames = (milliseconds: number): number => {
    return Math.max(0, Math.round(milliseconds / FRAME_DURATION_MS));
};

export const startDasHold = (id: string, options: DasHoldOptions) => {
    endDasHold(id);

    const { dasFrames, arrFrames, move, moveToEnd } = options;

    // 押下した瞬間に1回移動（レスポンス優先）
    move();

    const hold: HoldState = {
        move,
        moveToEnd,
        arrFrames,
        dasTimer: null,
        arrTimer: null,
        cutTimer: null,
        arrActive: false,
        cutVersion: 0,
    };
    hold.dasTimer = setTimeout(() => {
        hold.dasTimer = null;
        startArr(hold);
    }, framesToMilliseconds(dasFrames));
    holds.set(id, hold);
};

const startArr = (hold: HoldState) => {
    hold.arrActive = true;
    if (hold.arrFrames <= 0) {
        hold.moveToEnd();
    } else {
        hold.move();
        hold.arrTimer = setInterval(hold.move, framesToMilliseconds(hold.arrFrames));
    }
};

export const endDasHold = (id: string) => {
    const hold = holds.get(id);
    if (hold === undefined) {
        return;
    }
    hold.cutVersion += 1;
    if (hold.dasTimer !== null) {
        clearTimeout(hold.dasTimer);
    }
    if (hold.arrTimer !== null) {
        clearInterval(hold.arrTimer);
    }
    if (hold.cutTimer !== null) {
        clearTimeout(hold.cutTimer);
    }
    holds.delete(id);
};

// TETR.IO準拠: ソフトドロップ速度は max(重力, 0.05G) × SDF。
// 標準重力0.02G（40L/TL開始時）では下限0.05Gが常に支配的なため、
// 自然落下のないエディタでは 0.05G × 60fps = 3マス/秒 をSDF 1あたりの基準にする。
export const SOFT_DROP_BASE_CELLS_PER_SECOND = 3;

/** Keep applying soft drop while the shortcut key remains pressed. */
export const startSoftDropHold = (id: string, move: () => void, sdf: number) => {
    endSoftDropHold(id);
    move();
    const intervalFrames = sdf === Infinity ? 1 : 60 / (sdf * SOFT_DROP_BASE_CELLS_PER_SECOND);
    softDropHolds.set(id, setInterval(move, framesToMilliseconds(intervalFrames)));
};

export const endSoftDropHold = (id: string) => {
    const timer = softDropHolds.get(id);
    if (timer !== undefined) {
        clearInterval(timer);
        softDropHolds.delete(id);
    }
};

/** Stop every continuous piece input registered under the same input ID. */
export const endPieceHold = (id: string) => {
    endDasHold(id);
    endSoftDropHold(id);
};

/** Return whether a DAS or soft-drop hold is active for the input ID. */
export const isPieceHoldActive = (id: string): boolean => {
    return holds.has(id) || softDropHolds.has(id);
};

/**
 * Pause already-active DAS/ARR holds for the configured DCD delay.
 *
 * A hold which is still waiting for its initial DAS timer is intentionally
 * left alone. DAS Cut is for charged/pre-input movement, so a normal tap
 * followed by a rotation must not gain an extra delay.
 */
export const cutDasHolds = (dcdFrames: number | undefined) => {
    if (dcdFrames === undefined || dcdFrames <= 0) {
        return;
    }

    const cutMilliseconds = framesToMilliseconds(dcdFrames);
    for (const hold of Array.from(holds.values())) {
        if (!hold.arrActive) {
            continue;
        }

        if (hold.arrTimer !== null) {
            clearInterval(hold.arrTimer);
        }
        hold.arrTimer = null;
        hold.arrActive = false;
        if (hold.cutTimer !== null) {
            clearTimeout(hold.cutTimer);
        }

        hold.cutVersion += 1;
        const cutVersion = hold.cutVersion;
        hold.cutTimer = setTimeout(() => {
            hold.cutTimer = null;
            if (!holdsHasValue(hold) || hold.cutVersion !== cutVersion) {
                return;
            }

            startArr(hold);
        }, cutMilliseconds);
    }
};

/**
 * Skip the initial DAS delay for every direction that is still held when a
 * new piece spawns. DCD delays the resulting ARR activation; DCD=0 starts it
 * immediately.
 */
export const activateDasCut = (dcdFrames: number | undefined) => {
    const delayMilliseconds = framesToMilliseconds(dcdFrames ?? 0);

    for (const hold of Array.from(holds.values())) {
        if (hold.dasTimer !== null) {
            clearTimeout(hold.dasTimer);
            hold.dasTimer = null;
        }
        if (hold.arrTimer !== null) {
            clearInterval(hold.arrTimer);
            hold.arrTimer = null;
        }
        if (hold.cutTimer !== null) {
            clearTimeout(hold.cutTimer);
            hold.cutTimer = null;
        }
        hold.arrActive = false;
        hold.cutVersion += 1;
        const cutVersion = hold.cutVersion;

        if (delayMilliseconds <= 0) {
            // spawnPiece can run inside a raw action sequence before Hyperapp commits
            // its global state. A microtask starts ARR against the committed spawn while
            // still running before Hyperapp's timer-based render.
            Promise.resolve().then(() => {
                if (holdsHasValue(hold) && hold.cutVersion === cutVersion) {
                    startArr(hold);
                }
            });
        } else {
            hold.cutTimer = setTimeout(() => {
                hold.cutTimer = null;
                if (holdsHasValue(hold) && hold.cutVersion === cutVersion) {
                    startArr(hold);
                }
            }, delayMilliseconds);
        }
    }
};

const holdsHasValue = (value: HoldState): boolean => {
    for (const hold of Array.from(holds.values())) {
        if (hold === value) {
            return true;
        }
    }
    return false;
};

export const endAllDasHolds = () => {
    for (const id of Array.from(holds.keys())) {
        endDasHold(id);
    }
    for (const id of Array.from(softDropHolds.keys())) {
        endSoftDropHold(id);
    }
};

export const isDasHoldActive = (id: string): boolean => {
    return holds.has(id);
};

// TETR.IO準拠のSDF設定範囲。UIの選択肢とlocalStorage復元の検証で共有する
export const SDF_MIN = 5;
export const SDF_MAX = 40;
export const isValidSdf = (value: unknown): value is number =>
    typeof value === 'number' && (value === Infinity || (SDF_MIN <= value && value <= SDF_MAX));

// フォーカスを失ったらpointerup/keyupを受け取れないため、全ホールドを解除する
if (typeof window !== 'undefined') {
    window.addEventListener('blur', endAllDasHolds);
}

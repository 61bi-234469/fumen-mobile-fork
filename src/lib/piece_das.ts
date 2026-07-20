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
}

const holds = new Map<string, HoldState>();

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

        hold.cutTimer = setTimeout(() => {
            hold.cutTimer = null;
            if (!holdsHasValue(hold)) {
                return;
            }

            startArr(hold);
        }, cutMilliseconds);
    }
};

/**
 * Skip the initial DAS delay for every held direction that has already
 * reached ARR when a new piece spawns. A non-zero DCD delays ARR activation.
 */
export const activateDasCut = (dcdFrames: number | undefined) => {
    const delayMilliseconds = framesToMilliseconds(dcdFrames ?? 0);

    for (const hold of Array.from(holds.values())) {
        if (!hold.arrActive) {
            continue;
        }

        if (hold.arrTimer !== null) {
            clearInterval(hold.arrTimer);
            hold.arrTimer = null;
        }
        hold.arrActive = false;

        if (delayMilliseconds <= 0) {
            startArr(hold);
        } else {
            hold.cutTimer = setTimeout(() => {
                hold.cutTimer = null;
                if (holdsHasValue(hold)) {
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
};

export const isDasHoldActive = (id: string): boolean => {
    return holds.has(id);
};

// フォーカスを失ったらpointerup/keyupを受け取れないため、全ホールドを解除する
if (typeof window !== 'undefined') {
    window.addEventListener('blur', endAllDasHolds);
}

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

    const hold: HoldState = { dasTimer: null, arrTimer: null };
    hold.dasTimer = setTimeout(() => {
        hold.dasTimer = null;
        if (arrFrames <= 0) {
            moveToEnd();
        } else {
            move();
            hold.arrTimer = setInterval(move, framesToMilliseconds(arrFrames));
        }
    }, framesToMilliseconds(dasFrames));
    holds.set(id, hold);
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
    holds.delete(id);
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

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

interface DasHoldOptions extends DasHoldCallbacks {
    dasMs: number;
    arrMs: number;
}

interface HoldState {
    dasTimer: ReturnType<typeof setTimeout> | null;
    arrTimer: ReturnType<typeof setInterval> | null;
}

const holds = new Map<string, HoldState>();

export const startDasHold = (id: string, options: DasHoldOptions) => {
    endDasHold(id);

    const { dasMs, arrMs, move, moveToEnd } = options;

    // 押下した瞬間に1回移動（レスポンス優先）
    move();

    const hold: HoldState = { dasTimer: null, arrTimer: null };
    hold.dasTimer = setTimeout(() => {
        hold.dasTimer = null;
        if (arrMs <= 0) {
            moveToEnd();
        } else {
            move();
            hold.arrTimer = setInterval(move, arrMs);
        }
    }, dasMs);
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

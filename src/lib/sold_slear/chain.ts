// S2 の連鎖状態（REN / B2B レベル）の更新。Sold Slear の応答は次状態を返さないため、
// 連続探索ではアプリ側で進める。規則は s2-bot-lab
// bot/cold-clear-2-s2/src/f14_compat/mod.rs の advance_f14_chain と同一
// （TETR.IO S2 v19: allclear_b2b = 1。input_stats.ts とは PC の扱いが異なるため流用しない）。

export type F14Spin = 'none' | 'mini' | 'normal';

export const TETRIO_S2_PERFECT_CLEAR_B2B_BONUS = 1;

export interface S2Chain {
    combo: number;
    b2b: number;
}

export interface F14ChainDelta {
    comboAfter: number;
    b2bAfter: number;
    brokeB2b: boolean;
    brokenB2bCount: number;
}

// CC2 の identity は spin を none / mini / full で表す。F14 は full を normal と呼ぶ。
export const toF14Spin = (spin: string | undefined): F14Spin => {
    if (spin === 'mini') {
        return 'mini';
    }
    if (spin === 'full' || spin === 'normal') {
        return 'normal';
    }
    return 'none';
};

export const advanceF14Chain = (
    combo: number,
    b2b: number,
    lines: number,
    spin: F14Spin,
    perfectClear: boolean,
    perfectClearB2bBonus: number = TETRIO_S2_PERFECT_CLEAR_B2B_BONUS,
): F14ChainDelta => {
    if (lines <= 0) {
        return { b2bAfter: b2b, brokeB2b: false, brokenB2bCount: 0, comboAfter: 0 };
    }
    const comboAfter = combo + 1;
    const difficult = spin !== 'none' || lines >= 4;
    if (perfectClear && perfectClearB2bBonus > 0) {
        return { comboAfter, b2bAfter: b2b + perfectClearB2bBonus, brokeB2b: false, brokenB2bCount: 0 };
    }
    if (difficult) {
        return { comboAfter, b2bAfter: b2b + 1, brokeB2b: false, brokenB2bCount: 0 };
    }
    return { comboAfter, b2bAfter: 0, brokeB2b: b2b > 0, brokenB2bCount: b2b };
};

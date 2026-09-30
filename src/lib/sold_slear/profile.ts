import { SoldSlearBudget } from './budget';

// Sold Slear（s2-bot-lab の development champion "Legacy backup consistency"）の F14 execution profile。
// 転記元: s2-bot-lab src-js/champion-identity.mjs（CHAMPION_PROFILE_ARGS）と
// src-js/s2-f14-compat-browser.mjs（createF14LeafConversionGatedProfile）、
// https://github.com/61bi-234469/s2-bot-lab commit ff7210f。WASM を更新するときはここと third_party/sold-slear/README.md を合わせる。

export const F14_COMPAT_RULESET_ID =
    'tetrio-s2-v19-2c47b3df945f6714449b92d1b44346ef4bf0e1a20e95be8ed10c28be75c66a60-beta-1-5-0';
export const F14_COMPAT_CONFIG_HASH =
    'sha256:12665e92fa86934d82b5fd909b1248954e267d4e5c8fcafb0c23024938d1a769';
export const F14_QUEUE_MINIMUM = 2;
export const F14_QUEUE_LIMIT = 14;

const PROFILE_ID = 'f14-leaf-conversion-gated-b/1';
const SEED = '5994928009864282113';
// 選択予算モードでも execution に載る上限値（Worker は時間では打ち切らない）
const SELECTION_MODE_MAX_MILLIS = 30000;

// キーはソート済み（s2-bot-lab の canonicalWeightOverrides と同じ正規形）。
const WEIGHT_OVERRIDES: Readonly<Record<string, string>> = Object.freeze({
    back_to_back_clear: '4.6655',
    cell_coveredness: '-0.4398',
    combo_attack: '2.2999',
    freestyle_exploitation: '0.5968',
    has_back_to_back: '7.7069',
    height: '-1.9529',
    height_upper_half: '-9.5488',
    height_upper_quarter: '-65.8205',
    holes: '-0.825',
    leaf_ren_attack_gain: '1',
    legacy_backup_consistency: '1',
    'mini_spin_clears.2': '1.0439',
    'normal_clears.4': '2.6543',
    row_transitions: '-0.9132',
    'spin_clears.1': '3.6892',
    'spin_clears.2': '2.1779',
    'spin_clears.3': '8.6403',
    wasted_t: '-2.7843',
});

export interface F14Execution {
    profileId: string;
    configHash: string;
    seed: string;
    workerConcurrency: 1;
    budget: { mode: 'selection' | 'time'; selections: number; maxMillis: number };
    allocationMode: string;
    leafConversionScale: string;
    leafConversionMaxHeight: string;
    finalOrderPolicyId: string;
    weightOverrides: Record<string, string>;
}

export const createSoldSlearProfile = (budget: SoldSlearBudget): F14Execution => ({
    profileId: PROFILE_ID,
    configHash: F14_COMPAT_CONFIG_HASH,
    seed: SEED,
    workerConcurrency: 1,
    budget: budget.mode === 'time'
        ? { mode: 'time', selections: budget.selections, maxMillis: budget.maxMillis }
        : { mode: 'selection', selections: budget.selections, maxMillis: SELECTION_MODE_MAX_MILLIS },
    allocationMode: 'leaf-conversion-gated-v1',
    leafConversionScale: '0.1164',
    leafConversionMaxHeight: '8',
    finalOrderPolicyId: 'cc2-rank-order/1',
    weightOverrides: { ...WEIGHT_OVERRIDES },
});

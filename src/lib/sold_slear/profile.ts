import { SoldSlearBudget } from './budget';

// Sold Slear 1.4（s2-bot-lab の GUI / INPUT champion "SPSA v11 guarded clear and B2B weights"）の F14 execution profile。
// 転記元: s2-bot-lab src-js/champion-identity.mjs（CHAMPION_PROFILE_ARGS）と
// src-js/champion-parameters.mjs（createChampionProfile）、commit 8dccbcd。
// WASM を更新するときはここと third_party/sold-slear/README.md を合わせる。

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
    back_to_back_clear: '5.1363',
    cell_coveredness: '-0.355',
    combo_attack: '2.2408',
    freestyle_exploitation: '0.4689',
    has_back_to_back: '6.3455',
    height: '-1.9339',
    height_upper_half: '-9.2752',
    height_upper_quarter: '-70.3881',
    holes: '-0.7294',
    leaf_ren_attack_gain: '1',
    legacy_backup_consistency: '1',
    'mini_spin_clears.1': '0.0005',
    'mini_spin_clears.2': '1.0439',
    'normal_clears.1': '0.0451',
    'normal_clears.2': '0.8246',
    'normal_clears.3': '2.3987',
    'normal_clears.4': '2.4037',
    rescue_topout_fallback: '1',
    row_transitions: '-1.0473',
    'spin_clears.1': '3.6697',
    'spin_clears.2': '2.4043',
    'spin_clears.3': '8.7453',
    tetris_well_depth: '0.3687',
    wasted_t: '-4.0602',
});
// 直前の要求で探索した木を、次の局面がその続きなら引き継ぐ（Worker の WASM インスタンス内で保持）。
// 選択予算だけで有効で、時間予算では champion と同じくキーごと外す。
const TREE_REUSE_FLOOR = 256;

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

const sortedKeys = (record: Record<string, string>): Record<string, string> => {
    const sorted: Record<string, string> = {};
    Object.keys(record).sort().forEach((key) => { sorted[key] = record[key]; });
    return sorted;
};

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
    // tree_reuse_floor を加えてもキーのソート順（canonical 形）を保つ
    weightOverrides: budget.mode === 'time' ? { ...WEIGHT_OVERRIDES } : sortedKeys({
        ...WEIGHT_OVERRIDES,
        tree_reuse_floor: String(Math.min(TREE_REUSE_FLOOR, budget.selections)),
    }),
});

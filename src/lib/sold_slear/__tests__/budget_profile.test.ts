import {
    normalizeSoldSlearBudgetId,
    soldSlearBudgetOf,
    SOLD_SLEAR_BUDGET_DEFAULT,
    SOLD_SLEAR_SELECTION_CAP,
} from '../budget';
import { createSoldSlearProfile, F14_COMPAT_CONFIG_HASH } from '../profile';

describe('Sold Slear budget', () => {
    test('standard is the 2,048-selection champion budget', () => {
        expect(SOLD_SLEAR_BUDGET_DEFAULT).toBe('standard');
        expect(soldSlearBudgetOf('standard')).toEqual({ mode: 'selection', selections: 2048 });
    });

    test('time budgets keep a selection cap', () => {
        expect(soldSlearBudgetOf('t500')).toEqual({
            mode: 'time', maxMillis: 500, selections: SOLD_SLEAR_SELECTION_CAP,
        });
    });

    test('unknown stored values fall back to standard', () => {
        expect(normalizeSoldSlearBudgetId('t2000')).toBe('t2000');
        expect(normalizeSoldSlearBudgetId('t300')).toBe('standard');
        expect(normalizeSoldSlearBudgetId(undefined)).toBe('standard');
    });
});

describe('Sold Slear profile', () => {
    // s2-bot-lab createChampionProfile()（commit 8dccbcd、SELECTION 2,048・THINK TIME off）の出力。
    // WASM を更新したら合わせて更新する
    test('matches the champion profile of the pinned s2-bot-lab commit', () => {
        expect(createSoldSlearProfile(soldSlearBudgetOf('standard'))).toEqual({
            profileId: 'f14-leaf-conversion-gated-b/1',
            configHash: F14_COMPAT_CONFIG_HASH,
            seed: '5994928009864282113',
            workerConcurrency: 1,
            budget: { mode: 'selection', selections: 2048, maxMillis: 30000 },
            allocationMode: 'leaf-conversion-gated-v1',
            leafConversionScale: '0.1164',
            leafConversionMaxHeight: '8',
            finalOrderPolicyId: 'cc2-rank-order/1',
            weightOverrides: {
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
                tree_reuse_floor: '256',
                wasted_t: '-4.0602',
            },
        });
    });

    test('weight overrides stay in sorted key order', () => {
        const keys = Object.keys(createSoldSlearProfile(soldSlearBudgetOf('standard')).weightOverrides);
        expect(keys).toEqual(keys.slice().sort());
    });

    // champion と同じく、時間予算では tree reuse を外す
    test('a time budget changes the budget and drops tree reuse', () => {
        const standard = createSoldSlearProfile(soldSlearBudgetOf('standard'));
        const profile = createSoldSlearProfile(soldSlearBudgetOf('t200'));
        expect(profile.budget).toEqual({ mode: 'time', selections: SOLD_SLEAR_SELECTION_CAP, maxMillis: 200 });
        const { tree_reuse_floor: _floor, ...rest } = standard.weightOverrides;
        expect(profile.weightOverrides).toEqual(rest);
    });
});

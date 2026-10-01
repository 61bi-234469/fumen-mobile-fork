import {
    normalizeSoldSlearBudgetId,
    soldSlearBudgetOf,
    SOLD_SLEAR_BUDGET_DEFAULT,
    SOLD_SLEAR_SELECTION_CAP,
} from '../budget';
import { createSoldSlearProfile, F14_COMPAT_CONFIG_HASH } from '../profile';

describe('Sold Slear budget', () => {
    test('standard is the deterministic 512-selection champion budget', () => {
        expect(SOLD_SLEAR_BUDGET_DEFAULT).toBe('standard');
        expect(soldSlearBudgetOf('standard')).toEqual({ mode: 'selection', selections: 512 });
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
    // s2-bot-lab createChampionBaseProfile()（commit 61c0efd）の出力。WASM を更新したら合わせて更新する
    test('matches the champion profile of the pinned s2-bot-lab commit', () => {
        expect(createSoldSlearProfile(soldSlearBudgetOf('standard'))).toEqual({
            profileId: 'f14-leaf-conversion-gated-b/1',
            configHash: F14_COMPAT_CONFIG_HASH,
            seed: '5994928009864282113',
            workerConcurrency: 1,
            budget: { mode: 'selection', selections: 512, maxMillis: 30000 },
            allocationMode: 'leaf-conversion-gated-v1',
            leafConversionScale: '0.1164',
            leafConversionMaxHeight: '8',
            finalOrderPolicyId: 'cc2-rank-order/1',
            weightOverrides: {
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
            },
        });
    });

    test('a time budget changes only the budget', () => {
        const profile = createSoldSlearProfile(soldSlearBudgetOf('t200'));
        expect(profile.budget).toEqual({ mode: 'time', selections: SOLD_SLEAR_SELECTION_CAP, maxMillis: 200 });
    });
});

import { advanceF14Chain, F14Spin, toF14Spin } from '../chain';

// s2-bot-lab fixtures/diagnostics/cc2-s2-f14-amount-only-native-compat-p3.json の syntheticChain。
// Rust の advance_f14_chain と同じ期待値。
const CASES: [string, number, number, number, F14Spin, boolean, number, number, number, boolean, number][] = [
    // id, combo, b2b, lines, spin, pc, pcBonus, comboAfter, b2bAfter, brokeB2b, brokenCount
    ['first-difficult-clear', 0, 0, 4, 'none', false, 1, 1, 1, false, 0],
    ['second-difficult-clear', 1, 1, 2, 'normal', false, 1, 2, 2, false, 0],
    ['ordinary-clear-breaks-b2b', 3, 5, 1, 'none', false, 1, 4, 0, true, 5],
    ['no-clear-preserves-b2b', 3, 5, 0, 'none', false, 1, 0, 5, false, 0],
    ['perfect-clear-adds-b2b', 0, 2, 2, 'none', true, 1, 1, 3, false, 0],
    ['b2b-6-break', 5, 6, 1, 'none', false, 1, 6, 0, true, 6],
    ['b2b-256-difficult-unclamped', 1, 256, 4, 'none', false, 1, 2, 257, false, 0],
    ['combo-256-clear-unclamped', 256, 0, 1, 'none', false, 1, 257, 0, false, 0],
    ['lines-5-difficult-ge4', 0, 0, 5, 'none', false, 1, 1, 1, false, 0],
    ['mini-single', 2, 1, 1, 'mini', false, 1, 3, 2, false, 0],
    ['pc-bonus-0-falls-through-difficult', 0, 2, 4, 'none', true, 0, 1, 3, false, 0],
];

describe('advanceF14Chain', () => {
    test.each(CASES)('%s', (_id, combo, b2b, lines, spin, pc, bonus, comboAfter, b2bAfter, broke, brokenCount) => {
        expect(advanceF14Chain(combo, b2b, lines, spin, pc, bonus)).toEqual({
            comboAfter,
            b2bAfter,
            brokeB2b: broke,
            brokenB2bCount: brokenCount,
        });
    });

    test('uses the TETR.IO S2 perfect clear bonus by default', () => {
        expect(advanceF14Chain(0, 2, 2, 'none', true).b2bAfter).toBe(3);
    });

    test('maps CC2 spin names to F14 spin names', () => {
        expect(toF14Spin('full')).toBe('normal');
        expect(toF14Spin('normal')).toBe('normal');
        expect(toF14Spin('mini')).toBe('mini');
        expect(toF14Spin('none')).toBe('none');
        expect(toF14Spin(undefined)).toBe('none');
    });
});

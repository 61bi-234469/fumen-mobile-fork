import { estimateTextWidth, measureTextWidth, resetTextMeasureForTest } from '../text_measure';

describe('text measure without a DOM', () => {
    beforeEach(() => resetTextMeasureForTest());

    test('falls back to the estimate when document is unavailable', () => {
        expect(typeof document).toBe('undefined');
        expect(() => measureTextWidth('INSERT', 10, 600)).not.toThrow();
        expect(measureTextWidth('INSERT', 10, 600)).toBeCloseTo(6 * .62 * 10, 6);
    });

    test('estimates full-width characters as 1em and others as 0.62em', () => {
        expect(estimateTextWidth('ペン', 10, 400)).toBeCloseTo(20, 6);
        expect(estimateTextWidth('ADD', 10, 400)).toBeCloseTo(18.6, 6);
        expect(estimateTextWidth('行A', 12, 400)).toBeCloseTo(12 + 12 * .62, 6);
    });

    test('treats a missing translation as empty text', () => {
        // i18next の初期化前の描画では翻訳が undefined になる
        const missing = undefined as unknown as string;
        expect(estimateTextWidth(missing, 10, 400)).toBe(0);
        expect(measureTextWidth(missing, 10, 400)).toBe(0);
    });

    test('counts a surrogate pair as a single wide character', () => {
        expect(estimateTextWidth('𠮷', 10, 400)).toBeCloseTo(10, 6);
    });
});

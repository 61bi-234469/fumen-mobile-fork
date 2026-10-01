/** @jest-environment jsdom */

import { estimateTextWidth, measureTextWidth, resetTextMeasureForTest } from '../text_measure';

describe('text measure with a DOM', () => {
    let getContextSpy: jest.SpyInstance;

    beforeEach(() => {
        resetTextMeasureForTest();
        document.body.style.fontFamily = 'TestSans';
    });

    afterEach(() => {
        getContextSpy?.mockRestore();
    });

    test('falls back to the estimate when the canvas context is unavailable', () => {
        getContextSpy = jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);

        expect(measureTextWidth('COPY', 11, 600)).toBeCloseTo(estimateTextWidth('COPY', 11, 600), 6);
    });

    test('uses the canvas measurement with the body font family', () => {
        const fonts: string[] = [];
        const context = {
            font: '',
            measureText(text: string) {
                fonts.push(this.font);
                return { width: text.length * 7 };
            },
        };
        getContextSpy = jest.spyOn(HTMLCanvasElement.prototype, 'getContext')
            .mockReturnValue(context as unknown as CanvasRenderingContext2D);

        expect(measureTextWidth('SELECT', 11, 600)).toBe(42);
        expect(fonts).toEqual(['600 11px TestSans']);
    });

    test('caches per font size, weight, and family', () => {
        const measureText = jest.fn((text: string) => ({ width: text.length }));
        getContextSpy = jest.spyOn(HTMLCanvasElement.prototype, 'getContext')
            .mockReturnValue({ measureText, font: '' } as unknown as CanvasRenderingContext2D);

        measureTextWidth('PAINT', 10, 600);
        measureTextWidth('PAINT', 10, 600);
        expect(measureText).toHaveBeenCalledTimes(1);

        measureTextWidth('PAINT', 11, 600);
        measureTextWidth('PAINT', 10, 500);
        expect(measureText).toHaveBeenCalledTimes(3);

        // フォントが変わった場合（言語切替でbodyの指定が変わるなど）は別の結果として測り直す
        resetTextMeasureForTest();
        document.body.style.fontFamily = 'OtherSans';
        measureTextWidth('PAINT', 10, 600);
        expect(measureText).toHaveBeenCalledTimes(4);
    });

    test('keeps the estimate when measureText throws', () => {
        getContextSpy = jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
            font: '',
            measureText: () => {
                throw new Error('unsupported');
            },
        } as unknown as CanvasRenderingContext2D);

        expect(measureTextWidth('CUT', 10, 400)).toBeCloseTo(estimateTextWidth('CUT', 10, 400), 6);
    });
});

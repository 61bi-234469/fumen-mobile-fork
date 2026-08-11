import { inputAiGuideBlockGeometry } from '../input_ai_guide_overlay';

describe('inputAiGuideBlockGeometry', () => {
    test('maps a playfield cell to the same grid used by the editor field', () => {
        expect(inputAiGuideBlockGeometry(3, 0, { x: 10, y: 20 }, 12)).toEqual({
            position: {
                x: 50,
                y: 301,
            },
            size: {
                width: 12,
                height: 12,
            },
        });
    });

    test('uses the half-height ceiling cell geometry for row 22', () => {
        expect(inputAiGuideBlockGeometry(0, 22, { x: 10, y: 20 }, 12)).toEqual({
            position: {
                x: 11,
                y: 21,
            },
            size: {
                width: 12,
                height: 6,
            },
        });
    });
});

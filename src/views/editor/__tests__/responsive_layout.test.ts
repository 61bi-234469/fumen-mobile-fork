import {
    getEditorBottomMetrics,
    getEditorRailConfig,
    getResponsiveRailCellHeight,
} from '../responsive_layout';

describe('editor responsive layout', () => {
    test('uses compact bottom controls on short displays', () => {
        expect(getEditorBottomMetrics(519)).toEqual({ commentHeight: 30, toolsHeight: 42 });
        expect(getEditorBottomMetrics(520)).toEqual({ commentHeight: 35, toolsHeight: 50 });
    });

    test('keeps a single rail column on normal-height displays', () => {
        expect(getEditorRailConfig(420)).toEqual({
            columns: 1,
            reserve: 90,
            minWidth: 56,
            maxWidth: 80,
            widthRatio: 0.6,
        });
    });

    test('uses a wider two-column rail on low landscape displays', () => {
        expect(getEditorRailConfig(419)).toEqual({
            columns: 2,
            reserve: 120,
            minWidth: 88,
            maxWidth: 104,
            widthRatio: 0.72,
        });
    });

    test('keeps usable rail cell heights for representative field sizes', () => {
        expect(getResponsiveRailCellHeight(676, 1)).toBe(32);
        expect(getResponsiveRailCellHeight(456, 1)).toBe(21);
        expect(getResponsiveRailCellHeight(282, 2)).toBe(20);
    });
});

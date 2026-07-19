import {
    getEditorBottomMetrics,
    getEditorRailConfig,
    getPieceRailMetrics,
    getResponsiveRailCellHeight,
    PIECE_RAIL_CELL_COUNT,
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

    test('forces a single rail column when the PIECE queue is visible', () => {
        expect(getEditorRailConfig(300, true)).toEqual({
            columns: 1,
            reserve: 90,
            minWidth: 56,
            maxWidth: 80,
            widthRatio: 0.6,
        });
    });

    test('keeps usable rail cell heights for representative field sizes', () => {
        expect(getResponsiveRailCellHeight(676, 1)).toBe(32);
        expect(getResponsiveRailCellHeight(456, 1)).toBe(21);
        expect(getResponsiveRailCellHeight(282, 2)).toBe(20);
    });

    test('sizes the PIECE queue and vertically stacked rail for representative fields', () => {
        expect(PIECE_RAIL_CELL_COUNT).toBe(16);
        const metrics = getPieceRailMetrics(340, 38);
        expect(metrics.nextMinoHeight).toBe(10);
        expect(metrics.nextPanelHeight).toBe(106);
        expect(metrics.railCellHeight).toBe(12);
        expect(metrics.nextPanelHeight + metrics.railCellHeight * PIECE_RAIL_CELL_COUNT + 41).toBeLessThanOrEqual(340);
    });
});

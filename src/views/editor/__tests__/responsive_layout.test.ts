import {
    getEditorBottomMetrics,
    getEditorRailConfig,
    getPieceRailMetrics,
    getPieceSideWidth,
    getResponsiveRailCellHeight,
    PIECE_RAIL_CHROME_HEIGHT,
    PIECE_RAIL_COLUMNS,
    PIECE_RAIL_ROW_COUNT,
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

    test('widens the PIECE side columns without exceeding the desktop cap', () => {
        expect(getPieceSideWidth(300)).toBe(60);
        expect(getPieceSideWidth(320)).toBeCloseTo(61.44);
        expect(getPieceSideWidth(375)).toBe(72);
        expect(getPieceSideWidth(500)).toBe(80);
    });

    test('keeps usable rail cell heights for representative field sizes', () => {
        expect(getResponsiveRailCellHeight(676, 1)).toBe(32);
        expect(getResponsiveRailCellHeight(456, 1)).toBe(21);
        expect(getResponsiveRailCellHeight(282, 2)).toBe(20);
    });

    test('sizes the PIECE queue above a two-column seven-row rail', () => {
        expect(PIECE_RAIL_COLUMNS).toBe(2);
        expect(PIECE_RAIL_ROW_COUNT).toBe(7);

        const compactLandscape = getPieceRailMetrics(340, 80);
        expect(compactLandscape).toEqual({ nextMinoHeight: 18, nextPanelHeight: 146, railCellHeight: 24 });
        expect(compactLandscape.nextPanelHeight
            + compactLandscape.railCellHeight * PIECE_RAIL_ROW_COUNT
            + PIECE_RAIL_CHROME_HEIGHT).toBeLessThanOrEqual(340);

        expect(getPieceRailMetrics(419, getPieceSideWidth(320)))
            .toEqual({ nextMinoHeight: 33, nextPanelHeight: 221, railCellHeight: 24 });
        expect(getPieceRailMetrics(493, getPieceSideWidth(375)))
            .toEqual({ nextMinoHeight: 38, nextPanelHeight: 246, railCellHeight: 31 });
    });
});

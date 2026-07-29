import {
    getEditorBottomMetrics,
    getEditorRailConfig,
    getPieceRailMetrics,
    getPieceSideWidth,
    getPlayfieldCeilingOffset,
    getResponsiveRailCellHeight,
    INFINITE_TOGGLE_HEIGHT,
    MIN_PIECE_RAIL_CELL_HEIGHT,
    NEXT_PANEL_CHROME_HEIGHT,
    PIECE_RAIL_CHROME_HEIGHT,
    PIECE_RAIL_CHROME_HEIGHT_SINGLE,
    PIECE_RAIL_ROWS_DUAL,
    PIECE_RAIL_ROWS_SINGLE,
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

    test('matches the field drawing formula for the 20-row ceiling', () => {
        [27.44, 19.62].forEach((blockSize) => {
            expect(getPlayfieldCeilingOffset(blockSize))
                .toBeCloseTo(2.5 * blockSize + 3.5, 8);
        });
        expect(getPlayfieldCeilingOffset(27.44)).toBeCloseTo(72.1, 8);
        expect(getPlayfieldCeilingOffset(19.62)).toBeCloseTo(52.55, 8);
    });

    test('uses a single-column PIECE palette when the rail has enough height', () => {
        expect(getPieceRailMetrics(600, 80, 32)).toEqual({
            columns: 1,
            nextMinoHeight: 26,
            nextPanelHeight: 156,
            railCellHeight: 32,
            railExtensionHeight: 0,
        });
    });

    test('falls back to a two-column PIECE palette on a small display', () => {
        const metrics = getPieceRailMetrics(436, 72, 24);
        expect(metrics).toEqual({
            columns: 2,
            nextMinoHeight: 38,
            nextPanelHeight: 216,
            railCellHeight: 24,
            railExtensionHeight: 0,
        });
        expect(metrics.railCellHeight).toBeGreaterThanOrEqual(MIN_PIECE_RAIL_CELL_HEIGHT);
    });

    test('fits the two-column PIECE rail into a short landscape display', () => {
        expect(getPieceRailMetrics(277, 80, 18, 33)).toEqual({
            columns: 2,
            nextMinoHeight: 16,
            nextPanelHeight: 106,
            railCellHeight: 22,
            railExtensionHeight: 33,
        });
    });

    test.each([
        [600, 80, 32, 0],
        [436, 72, 24, 0],
        [277, 80, 18, 33],
    ])('keeps the PIECE queue and rail within %ipx', (
        availableHeight, nextWidth, targetCellHeight, maxExtensionHeight,
    ) => {
        const metrics = getPieceRailMetrics(availableHeight, nextWidth, targetCellHeight, maxExtensionHeight);
        const rows = metrics.columns === 1 ? PIECE_RAIL_ROWS_SINGLE : PIECE_RAIL_ROWS_DUAL;
        const chrome = metrics.columns === 1
            ? PIECE_RAIL_CHROME_HEIGHT_SINGLE : PIECE_RAIL_CHROME_HEIGHT;
        expect(metrics.nextPanelHeight + INFINITE_TOGGLE_HEIGHT
            + metrics.railCellHeight * rows + chrome)
            .toBeLessThanOrEqual(availableHeight + metrics.railExtensionHeight);
    });

    test('switches to one column at the minimum available height', () => {
        expect(getPieceRailMetrics(472, 80, 32).columns).toBe(2);
        expect(getPieceRailMetrics(473, 80, 32).columns).toBe(1);
        expect(NEXT_PANEL_CHROME_HEIGHT).toBe(26);
    });
});

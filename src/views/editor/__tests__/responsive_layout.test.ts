import {
    getEditorBottomMetrics,
    getEditorRailConfig,
    getPlayfieldCeilingOffset,
    getPlayPieceQueueWidth,
    getPlayPieceRailMetrics,
    getPlayPieceUnitBound,
    getPieceSelectRailCellHeight,
    getResponsiveRailCellHeight,
    INFINITE_TOGGLE_HEIGHT,
    MAX_PIECE_QUEUE_WIDTH,
    MIN_PIECE_QUEUE_WIDTH,
    MIN_PIECE_RAIL_CELL_HEIGHT,
    MIN_PLAY_NEXT_MINO_HEIGHT,
    NEXT_PANEL_CHROME_HEIGHT,
    PLAY_RAIL_CHROME_HEIGHT,
    PLAY_RAIL_ROWS,
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
        expect(getResponsiveRailCellHeight(676, 1)).toBe(31);
        expect(getResponsiveRailCellHeight(456, 1)).toBe(20);
        expect(getResponsiveRailCellHeight(282, 2)).toBe(19);
    });

    test('reserves one more row for the PIECE normal layout', () => {
        // PIECE通常はSELECT/PAINTを各1行にしてパレット11セルを並べる
        expect(getPieceSelectRailCellHeight(672.78, 1)).toBe(30);
        expect(getPieceSelectRailCellHeight(569.97, 1)).toBe(25);
        expect(getPieceSelectRailCellHeight(473.0, 1)).toBe(20);
        expect(getPieceSelectRailCellHeight(311.47, 2)).toBe(19);

        // PAINT/SELECTは従来どおり20/13行
        expect(getResponsiveRailCellHeight(672.78, 1)).toBe(31);
        expect(getResponsiveRailCellHeight(569.97, 1)).toBe(26);
        expect(getResponsiveRailCellHeight(473.0, 1)).toBe(21);
        expect(getResponsiveRailCellHeight(311.47, 2)).toBe(21);
    });

    test('matches the field drawing formula for the 20-row ceiling', () => {
        [27.44, 19.62].forEach((blockSize) => {
            expect(getPlayfieldCeilingOffset(blockSize))
                .toBeCloseTo(2.5 * blockSize + 3.5, 8);
        });
        expect(getPlayfieldCeilingOffset(27.44)).toBeCloseTo(72.1, 8);
        expect(getPlayfieldCeilingOffset(19.62)).toBeCloseTo(52.55, 8);
    });

    test('sizes the PIECE queue columns from the board cell, not a fixed cap', () => {
        expect(getPlayPieceQueueWidth(20)).toBe(68);
        expect(getPlayPieceQueueWidth(28.4417)).toBe(97);
        expect(getPlayPieceQueueWidth(15)).toBe(MIN_PIECE_QUEUE_WIDTH);
        expect(getPlayPieceQueueWidth(40)).toBe(MAX_PIECE_QUEUE_WIDTH);
    });

    test('solves the width bound for the board and both queue columns', () => {
        expect(getPlayPieceUnitBound(674, 6)).toBeCloseTo(38.035, 3);
        expect(getPlayPieceUnitBound(375, 4.5)).toBeCloseTo(20.838, 3);
        // 解いた1マス寸法で並べると canvasWidth にちょうど収まる（盤面は従来式と同じ10.5マス相当）
        const unit = getPlayPieceUnitBound(674, 6);
        expect(unit * 10.5 + 2 * (unit * 3.4) + 6 + 10).toBeCloseTo(674, 6);
    });

    test('keeps usable NEXT and rail sizes after adding the AI row', () => {
        [
            getPlayPieceRailMetrics(600.68, 97, 32, 41.11),
            getPlayPieceRailMetrics(441, 71, 23),
            getPlayPieceRailMetrics(277.8, 66, 18, 33),
        ].forEach((metrics) => {
            expect(metrics.railCellHeight).toBeGreaterThanOrEqual(MIN_PIECE_RAIL_CELL_HEIGHT);
            expect(metrics.nextMinoHeight).toBeGreaterThanOrEqual(MIN_PLAY_NEXT_MINO_HEIGHT);
            expect(metrics.nextPanelHeight).toBe(NEXT_PANEL_CHROME_HEIGHT + metrics.nextMinoHeight * 5);
        });
    });

    test('caps the NEXT mino height by the column width', () => {
        // 高さは十分でも枠幅の9割を超えない
        expect(getPlayPieceRailMetrics(900, 66, 32).nextMinoHeight).toBe(59);
        expect(getPlayPieceRailMetrics(900, 132, 32).nextMinoHeight).toBe(96);
    });

    test('falls back to the minimum heights when even the extension cannot cover them', () => {
        // 最小値まで詰めたうえで延長を使い切っても足りない極端な画面
        const metrics = getPlayPieceRailMetrics(170, 66, 18, 40);
        expect(metrics).toEqual({
            nextMinoHeight: MIN_PLAY_NEXT_MINO_HEIGHT,
            nextPanelHeight: NEXT_PANEL_CHROME_HEIGHT + MIN_PLAY_NEXT_MINO_HEIGHT * 5,
            railCellHeight: MIN_PIECE_RAIL_CELL_HEIGHT,
            railExtensionHeight: 40,
        });
    });

    test.each([
        [600.68, 97, 32, 41.11],
        [441, 71, 23, 0],
        [277.8, 66, 18, 33],
    ])('keeps the PIECE queue and rail within %ipx', (
        availableHeight, queueWidth, targetCellHeight, maxExtensionHeight,
    ) => {
        const metrics = getPlayPieceRailMetrics(availableHeight, queueWidth, targetCellHeight,
            maxExtensionHeight);
        expect(metrics.railCellHeight).toBeGreaterThanOrEqual(MIN_PIECE_RAIL_CELL_HEIGHT);
        expect(metrics.nextMinoHeight).toBeGreaterThanOrEqual(MIN_PLAY_NEXT_MINO_HEIGHT);
        expect(PLAY_RAIL_CHROME_HEIGHT + INFINITE_TOGGLE_HEIGHT
            + NEXT_PANEL_CHROME_HEIGHT + PLAY_RAIL_ROWS * metrics.railCellHeight
            + metrics.nextMinoHeight * 5)
            .toBeLessThanOrEqual(availableHeight + metrics.railExtensionHeight);
    });
});

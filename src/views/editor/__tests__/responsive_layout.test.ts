import {
    fitsRailPairedLabels,
    getEditorBottomMetrics,
    getEditorRailConfig,
    getPlayfieldCeilingOffset,
    getPlayPieceQueueWidth,
    getPlayPieceRailMetrics,
    getPlayPieceUnitBound,
    getRailLabelAvailableWidth,
    getRailLabelFontSize,
    getResponsiveRailCellHeight,
    getInputStatsPanelTier,
    INFINITE_TOGGLE_HEIGHT,
    MAX_PIECE_QUEUE_WIDTH,
    MIN_PIECE_QUEUE_WIDTH,
    MIN_PIECE_RAIL_CELL_HEIGHT,
    MIN_PLAY_NEXT_MINO_HEIGHT,
    NEXT_PANEL_CHROME_HEIGHT,
    PLAY_RAIL_CHROME_HEIGHT,
    PLAY_RAIL_ROWS,
    RAIL_LABEL_MIN_FONT_SIZE,
} from '../responsive_layout';

describe('editor responsive layout', () => {
    test.each([
        [89, 'hidden'], [90, 'compact'], [139, 'compact'], [140, 'summary'],
        [199, 'summary'], [200, 'full'],
    ])('uses the input stats tier at %ipx', (height, tier) => {
        expect(getInputStatsPanelTier(height)).toBe(tier);
    });
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

    test('uses the same rail cell height for PAINT/SELECT and PIECE normal layouts', () => {
        // PIECE通常は10セル（9機能＋空き）へ揃え、PAINT/SELECTと同じ20/13行を使う
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

    describe('rail label sizing', () => {
        // 1文字あたり 0.6em、太さ600なら1割増しで測る擬似フォント
        const measure = (text: string, fontSize: number, weight: number) => (
            text.length * fontSize * .6 * (weight >= 600 ? 1.1 : 1)
        );

        test('subtracts the group border, padding, icon, and gap from the rail width', () => {
            expect(getRailLabelAvailableWidth(61.5, 18)).toBeCloseTo(61.5 - 2 - 4 - 18 - 2, 6);
        });

        test('keeps the base font size when the widest label fits at weight 600', () => {
            const railWidth = 2 + 4 + 18 + 2 + 6 * 11 * .6 * 1.1;
            expect(getRailLabelFontSize({
                railWidth, measure, iconSize: 18, baseFontSize: 11, labels: ['ADD', 'INSERT'],
            })).toBe(11);
        });

        test('measures with weight 600 so selected labels still fit', () => {
            // 太さ500なら11pxで入るが、600では入らない幅
            const railWidth = 2 + 4 + 18 + 2 + 6 * 11 * .6;
            expect(getRailLabelFontSize({
                railWidth, measure, iconSize: 18, baseFontSize: 11, labels: ['INSERT'],
            })).toBeLessThan(11);
        });

        test('chooses the shared size from the widest measured label, not the longest text', () => {
            const widthByLabel: Record<string, number> = { WWW: 40, INSERT: 30 };
            const pseudo = (text: string, fontSize: number) => (widthByLabel[text] ?? 0) * fontSize / 10;
            const railWidth = 2 + 4 + 18 + 2 + 36;
            // 文字数の多いINSERTではなく、測ると広いWWWが基準になる
            expect(getRailLabelFontSize({
                railWidth, iconSize: 18, baseFontSize: 10, labels: ['INSERT', 'WWW'], measure: pseudo,
            })).toBe(9);
            expect(getRailLabelFontSize({
                railWidth, iconSize: 18, baseFontSize: 10, labels: ['INSERT'], measure: pseudo,
            })).toBe(10);
        });

        test('shrinks down to 9px and hides the labels below that', () => {
            const at = (available: number) => getRailLabelFontSize({
                measure, railWidth: 2 + 4 + 18 + 2 + available, iconSize: 18, baseFontSize: 11, labels: ['SELECT'],
            });
            const size = at(6 * 10 * .6 * 1.1);
            expect(size).toBeGreaterThanOrEqual(RAIL_LABEL_MIN_FONT_SIZE);
            expect(size).toBeLessThan(11);
            expect(at(6 * 9 * .6 * 1.1)).toBe(9);
            expect(at(6 * 9 * .6 * 1.1 - .1)).toBeUndefined();
        });

        test('still tries 9px when the base size is fractional', () => {
            const linear = (text: string, fontSize: number) => 4 * fontSize;
            [9.2, 9.6, 10.4].forEach((baseFontSize) => {
                expect(getRailLabelFontSize({
                    baseFontSize, railWidth: 2 + 4 + 18 + 2 + 36, iconSize: 18, labels: ['X'], measure: linear,
                })).toBe(9);
            });
        });

        test('checks the paired UTILS and FLAGS labels at 9px and weight 600', () => {
            const calls: [number, number][] = [];
            const spy = (text: string, fontSize: number, weight: number) => {
                calls.push([fontSize, weight]);
                return measure(text, fontSize, weight);
            };
            expect(fitsRailPairedLabels(5 * 9 * .6 * 1.1, ['UTILS', 'FLAGS'], spy)).toBe(true);
            expect(fitsRailPairedLabels(5 * 9 * .6 * 1.1 - .1, ['UTILS', 'FLAGS'], spy)).toBe(false);
            expect(calls.every(([fontSize, weight]) => fontSize === 9 && weight === 600)).toBe(true);
        });
    });
});

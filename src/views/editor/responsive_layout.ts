export const EDITOR_COMPACT_HEIGHT = 520;
export const EDITOR_TWO_COLUMN_RAIL_HEIGHT = 420;
const MIN_RAIL_CELL_HEIGHT = 18;
const MAX_RAIL_CELL_HEIGHT = 32;
const RAIL_GROUP_GAPS_HEIGHT = 16;

// PIECE時の右列はPIECE・AI、SELECT・PAINTに続けてパレット10セルを並べる
export const PIECE_RAIL_ROWS_SINGLE = 12;
export const PIECE_RAIL_ROWS_DUAL = 7;
export const PIECE_RIGHT_COLUMN_GAP = 10;
export const MIN_PIECE_RAIL_CELL_HEIGHT = 22;
const MIN_SINGLE_COLUMN_RAIL_CELL_HEIGHT = 24;
export const PIECE_RAIL_GROUP_GAP_DUAL = 4;
// 3グループの枠線、パレット行区切り、グループ間gap
export const PIECE_RAIL_CHROME_HEIGHT = 18;
export const PIECE_RAIL_CHROME_HEIGHT_SINGLE = 27;
// NEXT見出し・枠線・行区切り。∞7bagトグルは別枠で確保する
export const NEXT_PANEL_CHROME_HEIGHT = 26;
export const INFINITE_TOGGLE_HEIGHT = 32;
export const MIN_NEXT_MINO_HEIGHT = 16;
export const MIN_SINGLE_COLUMN_MINO_HEIGHT = 20;

export const getEditorBottomMetrics = (displayHeight: number) => {
    const compact = displayHeight < EDITOR_COMPACT_HEIGHT;
    return {
        commentHeight: compact ? 30 : 35,
        toolsHeight: compact ? 42 : 50,
    };
};

export const getEditorRailConfig = (canvasHeight: number) => {
    const columns: 1 | 2 = canvasHeight < EDITOR_TWO_COLUMN_RAIL_HEIGHT ? 2 : 1;
    return columns === 2 ? {
        columns,
        reserve: 120,
        minWidth: 88,
        maxWidth: 104,
        widthRatio: 0.72,
    } : {
        columns,
        reserve: 90,
        minWidth: 56,
        maxWidth: 80,
        widthRatio: 0.6,
    };
};

export const getPieceSideWidth = (canvasWidth: number): number => (
    Math.min(80, Math.max(60, canvasWidth * .192))
);

export const shouldUseCompactEditorRail = (canvasHeight: number, columns: 1 | 2): boolean => (
    columns === 2 || canvasHeight < 560
);

export const getPlayfieldCeilingOffset = (blockSize: number): number => (
    (blockSize + 1) * 2.5 + 1
);

export const getPieceRailMetrics = (
    availableHeight: number,
    nextWidth: number,
    targetCellHeight: number,
    maxExtensionHeight = 0,
) => {
    const singleNeedHeight = PIECE_RAIL_ROWS_SINGLE * MIN_SINGLE_COLUMN_RAIL_CELL_HEIGHT
        + PIECE_RAIL_CHROME_HEIGHT_SINGLE + INFINITE_TOGGLE_HEIGHT
        + NEXT_PANEL_CHROME_HEIGHT + 5 * MIN_SINGLE_COLUMN_MINO_HEIGHT;
    const columns: 1 | 2 = singleNeedHeight <= availableHeight ? 1 : 2;
    const rows = columns === 1 ? PIECE_RAIL_ROWS_SINGLE : PIECE_RAIL_ROWS_DUAL;
    const chromeHeight = columns === 1 ? PIECE_RAIL_CHROME_HEIGHT_SINGLE : PIECE_RAIL_CHROME_HEIGHT;
    const reservedNextMinoHeight = columns === 1 ? MIN_SINGLE_COLUMN_MINO_HEIGHT : MIN_NEXT_MINO_HEIGHT;
    const minCellHeight = columns === 1 ? MIN_SINGLE_COLUMN_RAIL_CELL_HEIGHT : MIN_PIECE_RAIL_CELL_HEIGHT;
    const minimumLayoutHeight = rows * minCellHeight + chromeHeight + INFINITE_TOGGLE_HEIGHT
        + NEXT_PANEL_CHROME_HEIGHT + 5 * reservedNextMinoHeight;
    const railExtensionHeight = Math.min(Math.max(0, maxExtensionHeight),
        Math.max(0, minimumLayoutHeight - availableHeight));
    const effectiveAvailableHeight = availableHeight + railExtensionHeight;
    const targetPieceCellHeight = Math.max(minCellHeight, targetCellHeight);
    const fittingCellHeight = Math.floor((effectiveAvailableHeight - INFINITE_TOGGLE_HEIGHT
        - chromeHeight - NEXT_PANEL_CHROME_HEIGHT - 5 * reservedNextMinoHeight) / rows);
    const railCellHeight = Math.min(MAX_RAIL_CELL_HEIGHT, targetPieceCellHeight,
        Math.max(minCellHeight, fittingCellHeight));
    const maxMinoHeight = Math.min(38, Math.floor(nextWidth * .72));
    const nextMinoHeight = Math.min(maxMinoHeight, Math.max(reservedNextMinoHeight,
        Math.floor((effectiveAvailableHeight - INFINITE_TOGGLE_HEIGHT - chromeHeight
            - rows * railCellHeight - NEXT_PANEL_CHROME_HEIGHT) / 5)));
    const nextPanelHeight = NEXT_PANEL_CHROME_HEIGHT + nextMinoHeight * 5;
    return { columns, nextMinoHeight, nextPanelHeight, railCellHeight, railExtensionHeight };
};

export const getResponsiveRailCellHeight = (fieldHeight: number, columns: 1 | 2): number => {
    const rows = columns === 2 ? 12 : 19;
    const chromeHeight = columns === 2 ? 17 : 24;
    return Math.min(MAX_RAIL_CELL_HEIGHT, Math.max(MIN_RAIL_CELL_HEIGHT,
        Math.floor((fieldHeight - chromeHeight - RAIL_GROUP_GAPS_HEIGHT) / rows)));
};

export const EDITOR_COMPACT_HEIGHT = 520;
export const EDITOR_TWO_COLUMN_RAIL_HEIGHT = 420;
const MIN_RAIL_CELL_HEIGHT = 18;
const MAX_RAIL_CELL_HEIGHT = 32;
const RAIL_GROUP_GAPS_HEIGHT = 16;

// PIECE時の右列はPIECE・AI、SELECT・PAINT、パレット10セルを2列7行で重ねる
export const PIECE_RAIL_COLUMNS = 2;
export const PIECE_RAIL_ROW_COUNT = 7;
export const PIECE_RIGHT_COLUMN_GAP = 10;
const MIN_PIECE_RAIL_CELL_HEIGHT = 24;
// 3グループの枠線、パレット行区切り、グループ間gap、NEXT下の余白
export const PIECE_RAIL_CHROME_HEIGHT = 26;
// NEXT見出し・枠線・行区切りと∞7bagトグルぶん
const NEXT_PANEL_CHROME_HEIGHT = 56;
const MIN_NEXT_MINO_HEIGHT = 10;

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

export const getPieceRailMetrics = (fieldHeight: number, nextWidth: number) => {
    const railNeedHeight = PIECE_RAIL_ROW_COUNT * MIN_PIECE_RAIL_CELL_HEIGHT + PIECE_RAIL_CHROME_HEIGHT;
    const maxMinoHeight = Math.min(38, Math.floor(nextWidth * .72));
    const nextMinoHeight = Math.min(maxMinoHeight, Math.max(MIN_NEXT_MINO_HEIGHT,
        Math.floor((fieldHeight - NEXT_PANEL_CHROME_HEIGHT - railNeedHeight) / 5)));
    const nextPanelHeight = NEXT_PANEL_CHROME_HEIGHT + nextMinoHeight * 5;
    const railCellHeight = Math.min(MAX_RAIL_CELL_HEIGHT, Math.max(MIN_PIECE_RAIL_CELL_HEIGHT,
        Math.floor((fieldHeight - nextPanelHeight - PIECE_RAIL_CHROME_HEIGHT) / PIECE_RAIL_ROW_COUNT)));
    return { nextMinoHeight, nextPanelHeight, railCellHeight };
};

export const getResponsiveRailCellHeight = (fieldHeight: number, columns: 1 | 2): number => {
    const rows = columns === 2 ? 12 : 19;
    const chromeHeight = columns === 2 ? 17 : 24;
    return Math.min(MAX_RAIL_CELL_HEIGHT, Math.max(MIN_RAIL_CELL_HEIGHT,
        Math.floor((fieldHeight - chromeHeight - RAIL_GROUP_GAPS_HEIGHT) / rows)));
};

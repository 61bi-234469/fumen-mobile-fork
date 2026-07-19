export const EDITOR_COMPACT_HEIGHT = 520;
export const EDITOR_TWO_COLUMN_RAIL_HEIGHT = 420;
const MIN_RAIL_CELL_HEIGHT = 18;
const MAX_RAIL_CELL_HEIGHT = 32;
const RAIL_GROUP_GAPS_HEIGHT = 16;

// PIECE時の右列は共有・設定、PIECE・AI、SELECT・PAINT、パレット9セルを縦に重ねる
export const PIECE_RAIL_CELL_COUNT = 15;
const MIN_PIECE_RAIL_CELL_HEIGHT = 12;
// 4グループの枠線、セル間の区切り、グループ間gap、NEXT下の余白
const PIECE_RAIL_CHROME_HEIGHT = 41;
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

export const getEditorRailConfig = (canvasHeight: number, forceSingleColumn = false) => {
    const columns: 1 | 2 = !forceSingleColumn && canvasHeight < EDITOR_TWO_COLUMN_RAIL_HEIGHT ? 2 : 1;
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

export const getPieceRailMetrics = (fieldHeight: number, nextWidth: number) => {
    const railNeedHeight = PIECE_RAIL_CELL_COUNT * MIN_PIECE_RAIL_CELL_HEIGHT + PIECE_RAIL_CHROME_HEIGHT;
    const maxMinoHeight = Math.min(38, Math.floor(nextWidth * .72));
    const nextMinoHeight = Math.min(maxMinoHeight, Math.max(MIN_NEXT_MINO_HEIGHT,
        Math.floor((fieldHeight - NEXT_PANEL_CHROME_HEIGHT - railNeedHeight) / 5)));
    const nextPanelHeight = NEXT_PANEL_CHROME_HEIGHT + nextMinoHeight * 5;
    const railCellHeight = Math.min(MAX_RAIL_CELL_HEIGHT, Math.max(MIN_PIECE_RAIL_CELL_HEIGHT,
        Math.floor((fieldHeight - nextPanelHeight - PIECE_RAIL_CHROME_HEIGHT) / PIECE_RAIL_CELL_COUNT)));
    return { nextMinoHeight, nextPanelHeight, railCellHeight };
};

export const getResponsiveRailCellHeight = (fieldHeight: number, columns: 1 | 2): number => {
    const rows = columns === 2 ? 12 : 19;
    const chromeHeight = columns === 2 ? 17 : 24;
    return Math.min(MAX_RAIL_CELL_HEIGHT, Math.max(MIN_RAIL_CELL_HEIGHT,
        Math.floor((fieldHeight - chromeHeight - RAIL_GROUP_GAPS_HEIGHT) / rows)));
};

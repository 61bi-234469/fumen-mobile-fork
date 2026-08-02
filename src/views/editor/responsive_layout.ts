export const EDITOR_COMPACT_HEIGHT = 520;
export const EDITOR_TWO_COLUMN_RAIL_HEIGHT = 420;
const MIN_RAIL_CELL_HEIGHT = 18;
const MAX_RAIL_CELL_HEIGHT = 32;
const RAIL_GROUP_GAPS_HEIGHT = 16;

export const PIECE_RIGHT_COLUMN_GAP = 10;
export const MIN_PIECE_RAIL_CELL_HEIGHT = 22;
export const PIECE_RAIL_GROUP_GAP_DUAL = 4;
// NEXT見出し・枠線・行区切り。∞7bagトグルは別枠で確保する
export const NEXT_PANEL_CHROME_HEIGHT = 26;
export const INFINITE_TOGGLE_HEIGHT = 32;

// 操作重視レイアウト。[PLAY|AI]、PIECE、[PAINT|SELECT]、非常操作の4行を載せる。
export const PLAY_RAIL_ROWS = 4;
// 3グループの枠線とグループ間gap
export const PLAY_RAIL_CHROME_HEIGHT = 20;
export const MAX_PLAY_NEXT_MINO_HEIGHT = 96;
export const MIN_PLAY_NEXT_MINO_HEIGHT = 20;
// HOLD／NEXT列は他クライアントと同じく盤面3.4マス幅を基準にする
export const PIECE_QUEUE_COLUMN_UNITS = 3.4;
export const MIN_PIECE_QUEUE_WIDTH = 66;
export const MAX_PIECE_QUEUE_WIDTH = 132;

// PAINT/SELECTの共通レール行数
const RAIL_ROWS_SINGLE = 20;
const RAIL_ROWS_DUAL = 13;
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

// 幅律速時の1マス寸法。canvasWidth = 盤面10.5マス + キュー2列(各3.4マス) + 列間gap を解いたもの
export const getPlayPieceUnitBound = (canvasWidth: number, gap: number): number => (
    (canvasWidth - gap - PIECE_RIGHT_COLUMN_GAP) / (10.5 + 2 * PIECE_QUEUE_COLUMN_UNITS)
);

export const getPlayPieceQueueWidth = (unit: number): number => Math.min(
    MAX_PIECE_QUEUE_WIDTH,
    Math.max(MIN_PIECE_QUEUE_WIDTH, Math.round(unit * PIECE_QUEUE_COLUMN_UNITS)),
);

export const shouldUseCompactEditorRail = (canvasHeight: number, columns: 1 | 2): boolean => (
    columns === 2 || canvasHeight < 560
);

export const getPlayfieldCeilingOffset = (blockSize: number): number => (
    (blockSize + 1) * 2.5 + 1
);

export const getPlayPieceRailMetrics = (
    availableHeight: number,
    queueWidth: number,
    targetCellHeight: number,
    maxExtensionHeight = 0,
) => {
    const fixedHeight = PLAY_RAIL_CHROME_HEIGHT + INFINITE_TOGGLE_HEIGHT + NEXT_PANEL_CHROME_HEIGHT;
    const minimumLayoutHeight = fixedHeight + PLAY_RAIL_ROWS * MIN_PIECE_RAIL_CELL_HEIGHT
        + 5 * MIN_PLAY_NEXT_MINO_HEIGHT;
    const railExtensionHeight = Math.min(Math.max(0, maxExtensionHeight),
        Math.max(0, minimumLayoutHeight - availableHeight));
    const effectiveAvailableHeight = availableHeight + railExtensionHeight;
    const fittingCellHeight = Math.floor((effectiveAvailableHeight - fixedHeight
        - 5 * MIN_PLAY_NEXT_MINO_HEIGHT) / PLAY_RAIL_ROWS);
    const railCellHeight = Math.min(MAX_RAIL_CELL_HEIGHT,
        Math.max(MIN_PIECE_RAIL_CELL_HEIGHT, targetCellHeight),
        Math.max(MIN_PIECE_RAIL_CELL_HEIGHT, fittingCellHeight));
    // ミノ描画は最大4マス幅なので、枠幅の9割までを1個分の高さの上限にする
    const maxMinoHeight = Math.min(MAX_PLAY_NEXT_MINO_HEIGHT, Math.floor(queueWidth * .9));
    const nextMinoHeight = Math.min(maxMinoHeight, Math.max(MIN_PLAY_NEXT_MINO_HEIGHT,
        Math.floor((effectiveAvailableHeight - fixedHeight
            - PLAY_RAIL_ROWS * railCellHeight) / 5)));
    const nextPanelHeight = NEXT_PANEL_CHROME_HEIGHT + nextMinoHeight * 5;
    return { nextMinoHeight, nextPanelHeight, railCellHeight, railExtensionHeight };
};

export const getResponsiveRailCellHeight = (fieldHeight: number, columns: 1 | 2): number => {
    const railRows = columns === 2 ? RAIL_ROWS_DUAL : RAIL_ROWS_SINGLE;
    const chromeHeight = columns === 2 ? 17 : 24;
    return Math.min(MAX_RAIL_CELL_HEIGHT, Math.max(MIN_RAIL_CELL_HEIGHT,
        Math.floor((fieldHeight - chromeHeight - RAIL_GROUP_GAPS_HEIGHT) / railRows)));
};

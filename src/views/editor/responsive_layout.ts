export const EDITOR_COMPACT_HEIGHT = 520;
export const EDITOR_TWO_COLUMN_RAIL_HEIGHT = 420;
const MIN_RAIL_CELL_HEIGHT = 18;
const MAX_RAIL_CELL_HEIGHT = 32;
const RAIL_GROUP_GAPS_HEIGHT = 16;

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

export const getResponsiveRailCellHeight = (fieldHeight: number, columns: 1 | 2): number => {
    const rows = columns === 2 ? 12 : 19;
    const chromeHeight = columns === 2 ? 17 : 24;
    return Math.min(MAX_RAIL_CELL_HEIGHT, Math.max(MIN_RAIL_CELL_HEIGHT,
        Math.floor((fieldHeight - chromeHeight - RAIL_GROUP_GAPS_HEIGHT) / rows)));
};

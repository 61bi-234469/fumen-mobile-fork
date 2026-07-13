import { isMinoPiece, FieldConstants, Piece, Rotation } from './enums';
import { Page, Move } from './fumen/types';
import { Field } from './fumen/field';
import { PageFieldOperation, Pages, isTextCommentResult } from './pages';
import { decodeCoordinate, encodePosition } from './fumen/action';
import {
    calculateTreeLayout,
    embedTreeInPages,
    flattenTreeToPageIndices,
    generateNodeId,
} from './fumen/tree_utils';
import { SerializedTree, TreeNode, TreeNodeId } from './fumen/tree_types';

const TETGRAM_ROWS = 22;
const TETGRAM_COLUMNS = FieldConstants.Width;
const TETGRAM_MAX_ROWS = 26;
const TETGRAM_MAX_COLUMNS = 10;
const TETGRAM_MAX_PAGES = 250;

const FUMEN_TO_TETGRAM_PIECE: { [key: number]: number } = {
    [Piece.Empty]: 0,
    [Piece.I]: 8,
    [Piece.L]: 3,
    [Piece.O]: 7,
    [Piece.Z]: 6,
    [Piece.T]: 9,
    [Piece.J]: 4,
    [Piece.S]: 5,
    [Piece.Gray]: 2,
};

const TETGRAM_TO_FUMEN_PIECE: { [key: number]: Piece } = {
    0: Piece.Empty,
    1: Piece.Gray,
    2: Piece.Gray,
    3: Piece.L,
    4: Piece.J,
    5: Piece.S,
    6: Piece.Z,
    7: Piece.O,
    8: Piece.I,
    9: Piece.T,
};

interface TetgramAction {
    piece: number;
    rotation: number;
    loc: number;
    x: number;
    y: number;
    rise: boolean;
    mirror: boolean;
    lock: boolean;
}

interface TetgramListPosition {
    row: string;
    col: string;
}

interface TetgramListLayout {
    perPage: { [pageIndex: string]: TetgramListPosition };
    cols: number;
}

interface TetgramRawData {
    pages: number[][][];
    comments: string[];
    tags: string[][];
    actions: (TetgramAction | null)[];
    listLayout: TetgramListLayout;
}

interface GridPosition {
    pageIndex: number;
    row: number;
    col: number;
}

const isRecord = (value: unknown): value is { [key: string]: unknown } => (
    typeof value === 'object' && value !== null && !Array.isArray(value)
);

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const rowLabel = (row: number): string => String.fromCharCode('A'.charCodeAt(0) + row);

const isValidInteger = (value: unknown): value is number => (
    typeof value === 'number' && isFinite(value) && Math.floor(value) === value
);

const getResolvedComment = (pages: Pages, index: number): string => {
    const result = pages.getComment(index);
    return isTextCommentResult(result) ? result.text : result.quiz;
};

const toTetgramField = (field: Field): number[][] => {
    return Array.from({ length: TETGRAM_ROWS }, (_, row) => (
        Array.from({ length: TETGRAM_COLUMNS }, (_, col) => {
            const piece = field.get(col, TETGRAM_ROWS - 1 - row);
            return FUMEN_TO_TETGRAM_PIECE[piece] ?? 0;
        })
    ));
};

const toTetgramAction = (page: Page): TetgramAction | null => {
    if (!page.piece || !isMinoPiece(page.piece.type)) {
        return null;
    }

    return {
        piece: page.piece.type,
        rotation: page.piece.rotation,
        loc: encodePosition(page.piece),
        x: 0,
        y: 0,
        rise: page.flags.rise,
        mirror: page.flags.mirror,
        lock: page.flags.lock,
    };
};

const toListLayout = (pages: Page[], tree: SerializedTree | null): TetgramListLayout => {
    if (!tree) {
        return { perPage: {}, cols: 5 };
    }

    const layout = calculateTreeLayout(tree);
    const nodesByPageIndex = new Map<number, TreeNode>();
    tree.nodes.forEach((node) => {
        if (node.pageIndex >= 0) {
            nodesByPageIndex.set(node.pageIndex, node);
        }
    });

    const perPage: { [pageIndex: string]: TetgramListPosition } = {};
    pages.forEach((page, pageIndex) => {
        const node = nodesByPageIndex.get(pageIndex);
        const position = node ? layout.positions.get(node.id) : undefined;
        if (!position || position.x >= TETGRAM_MAX_COLUMNS || position.y >= TETGRAM_MAX_ROWS) {
            return;
        }
        perPage[String(pageIndex)] = {
            row: rowLabel(position.y),
            col: String(position.x + 1),
        };
    });

    return {
        perPage,
        cols: clamp(layout.maxDepth + 1, 1, TETGRAM_MAX_COLUMNS),
    };
};

const formatTetgramRawData = (rawData: TetgramRawData): string => {
    const pages = rawData.pages.map((page) => {
        const rows = page.map(row => `      ${JSON.stringify(row)}`).join(',\n');
        return `    [\n${rows}\n    ]`;
    }).join(',\n');
    const actions = rawData.actions.map(action => `    ${JSON.stringify(action)}`).join(',\n');

    return [
        '{',
        '  "pages": [',
        pages,
        '  ],',
        `  "comments": ${JSON.stringify(rawData.comments)},`,
        `  "tags": ${JSON.stringify(rawData.tags)},`,
        '  "actions": [',
        actions,
        '  ],',
        `  "listLayout": ${JSON.stringify(rawData.listLayout)}`,
        '}',
    ].join('\n');
};

export const generateTetgramRawData = (pages: Page[], tree: SerializedTree | null): string => {
    const pagesObj = new Pages(pages);
    const rawData: TetgramRawData = {
        pages: pages.map((_, index) => toTetgramField(pagesObj.getField(index, PageFieldOperation.Command))),
        comments: pages.map((_, index) => getResolvedComment(pagesObj, index)),
        tags: pages.map(() => []),
        actions: pages.map(page => toTetgramAction(page)),
        listLayout: toListLayout(pages, tree),
    };

    return formatTetgramRawData(rawData);
};

export const getTetgramRawDataWarnings = (pages: Page[], tree: SerializedTree | null): string[] => {
    const warnings: string[] = [];
    if (pages.length > TETGRAM_MAX_PAGES) {
        warnings.push(`tetgram displays at most ${TETGRAM_MAX_PAGES} pages`);
    }

    if (tree) {
        const layout = calculateTreeLayout(tree);
        if (layout.maxDepth >= TETGRAM_MAX_COLUMNS) {
            warnings.push('deep tree nodes will be auto-placed by tetgram');
        }
        if (layout.maxLane >= TETGRAM_MAX_ROWS) {
            warnings.push('many branch lanes will be auto-placed by tetgram');
        }
    }
    return warnings;
};

export const looksLikeTetgramRawData = (text: string): boolean => {
    const trimmed = text.trim();
    return trimmed.startsWith('{') && /"pages"\s*:/.test(trimmed);
};

const normalizeTetgramCell = (value: unknown): Piece => {
    if (!isValidInteger(value)) {
        return Piece.Empty;
    }
    return TETGRAM_TO_FUMEN_PIECE[value] ?? Piece.Empty;
};

const normalizeTetgramPage = (rawPage: unknown): Page['field']['obj'] => {
    const field = new Field({});
    const rows = Array.isArray(rawPage) ? rawPage : [];
    for (let row = 0; row < TETGRAM_ROWS; row += 1) {
        const rawRow = Array.isArray(rows[row]) ? rows[row] : [];
        for (let col = 0; col < TETGRAM_COLUMNS; col += 1) {
            const piece = normalizeTetgramCell(rawRow[col]);
            if (piece !== Piece.Empty) {
                field.add(col, TETGRAM_ROWS - 1 - row, piece);
            }
        }
    }
    return field;
};

const getRawString = (values: unknown, index: number): string => {
    if (!Array.isArray(values) || typeof values[index] !== 'string') {
        return '';
    }
    return values[index] as string;
};

const getRawAction = (values: unknown, index: number): TetgramAction | null => {
    if (!Array.isArray(values) || !isRecord(values[index])) {
        return null;
    }

    const value = values[index];
    const piece = value.piece;
    const rotation = value.rotation;
    const loc = value.loc;
    if (!isValidInteger(piece) || piece < Piece.I || piece > Piece.S
        || !isValidInteger(rotation) || rotation < Rotation.Spawn || rotation > Rotation.Left
        || !isValidInteger(loc) || loc < 0 || loc >= FieldConstants.AllBlocks) {
        return null;
    }

    return {
        piece,
        rotation,
        loc,
        x: 0,
        y: 0,
        rise: value.rise === true,
        mirror: value.mirror === true,
        lock: value.lock !== false,
    };
};

const actionToMove = (action: TetgramAction | null): Move | undefined => {
    if (!action) {
        return undefined;
    }
    const type = action.piece as Piece;
    const rotation = action.rotation as Rotation;
    return {
        type,
        rotation,
        coordinate: decodeCoordinate(action.loc, type, rotation, FieldConstants.Height),
    };
};

const normalizeRawListPosition = (value: unknown): { row: number; col: number } | null => {
    if (!isRecord(value) || typeof value.row !== 'string' || typeof value.col !== 'string') {
        return null;
    }
    if (!/^[A-Z]$/.test(value.row) || !/^\d+$/.test(value.col)) {
        return null;
    }
    const row = value.row.charCodeAt(0) - 'A'.charCodeAt(0);
    const col = parseInt(value.col, 10) - 1;
    if (row < 0 || row >= TETGRAM_MAX_ROWS || col < 0 || col >= TETGRAM_MAX_COLUMNS) {
        return null;
    }
    return { row, col };
};

const cellKey = (row: number, col: number): string => `${row}:${col}`;

const resolveGridPositions = (
    rawLayout: unknown,
    pageCount: number,
): GridPosition[] | null => {
    if (!isRecord(rawLayout) || !isRecord(rawLayout.perPage)) {
        return null;
    }

    const perPage = rawLayout.perPage;
    const layoutKeys = Object.keys(perPage);
    if (layoutKeys.length === 0) {
        return null;
    }

    const assigned = new Map<number, GridPosition>();
    const usedCells = new Set<string>();
    let maxAssignedCol = 0;

    layoutKeys.forEach((key) => {
        const pageIndex = parseInt(key, 10);
        const position = normalizeRawListPosition(perPage[key]);
        if (!isValidInteger(pageIndex) || pageIndex < 0 || pageIndex >= pageCount || !position) {
            return;
        }
        if (assigned.has(pageIndex) || usedCells.has(cellKey(position.row, position.col))) {
            return;
        }
        const gridPosition = { pageIndex, row: position.row, col: position.col };
        assigned.set(pageIndex, gridPosition);
        usedCells.add(cellKey(position.row, position.col));
        maxAssignedCol = Math.max(maxAssignedCol, position.col + 1);
    });

    const rawCols = rawLayout.cols;
    const cols = isValidInteger(rawCols) ? clamp(rawCols, 1, TETGRAM_MAX_COLUMNS) : 5;
    const placementCols = Math.max(cols, maxAssignedCol, 1);
    let fallbackRow = TETGRAM_MAX_ROWS;

    for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
        if (assigned.has(pageIndex)) {
            continue;
        }

        let placed = false;
        for (let row = 0; row < TETGRAM_MAX_ROWS && !placed; row += 1) {
            for (let col = 0; col < placementCols && !placed; col += 1) {
                if (!usedCells.has(cellKey(row, col))) {
                    assigned.set(pageIndex, { pageIndex, row, col });
                    usedCells.add(cellKey(row, col));
                    placed = true;
                }
            }
        }

        if (!placed) {
            assigned.set(pageIndex, { pageIndex, row: fallbackRow, col: 0 });
            fallbackRow += 1;
        }
    }

    return Array.from(assigned.values());
};

const buildTreeFromGrid = (positions: GridPosition[]): SerializedTree => {
    const sorted = positions.slice().sort((a, b) => (
        a.row - b.row || a.col - b.col || a.pageIndex - b.pageIndex
    ));
    const nodeByPageIndex = new Map<number, TreeNode>();
    const positionByNodeId = new Map<TreeNodeId, GridPosition>();
    const nodes: TreeNode[] = sorted.map((position) => {
        const node: TreeNode = {
            id: generateNodeId(),
            parentId: null,
            pageIndex: position.pageIndex,
            childrenIds: [],
        };
        nodeByPageIndex.set(position.pageIndex, node);
        positionByNodeId.set(node.id, position);
        return node;
    });

    const virtualRootId = generateNodeId();
    const virtualRoot: TreeNode = {
        id: virtualRootId,
        parentId: null,
        pageIndex: -1,
        childrenIds: [],
    };
    nodes.forEach((node) => {
        const position = positionByNodeId.get(node.id) as GridPosition;
        let parent: TreeNode | undefined;
        if (position.col > 0) {
            const candidates = sorted
                .filter(candidate => candidate.col === position.col - 1 && candidate.row <= position.row)
                .sort((a, b) => b.row - a.row);
            const candidate = candidates[0];
            parent = candidate ? nodeByPageIndex.get(candidate.pageIndex) : undefined;
        }

        if (parent) {
            node.parentId = parent.id;
            parent.childrenIds.push(node.id);
        } else {
            node.parentId = virtualRootId;
            virtualRoot.childrenIds.push(node.id);
        }
    });

    const sortChildrenByRow = (node: TreeNode) => {
        node.childrenIds.sort((a, b) => {
            const first = positionByNodeId.get(a) as GridPosition;
            const second = positionByNodeId.get(b) as GridPosition;
            return first.row - second.row || first.col - second.col;
        });
    };
    nodes.forEach(sortChildrenByRow);
    sortChildrenByRow(virtualRoot);

    return {
        nodes: [...nodes, virtualRoot],
        rootId: virtualRootId,
        version: 2,
    };
};

const clonePageWithComment = (page: Page, index: number, comment: string, commentRef?: number): Page => ({
    ...page,
    index,
    field: page.field.obj ? { obj: page.field.obj.copy() } : { obj: new Field({}) },
    comment: commentRef !== undefined ? { ref: commentRef } : { text: comment },
    flags: { ...page.flags },
    piece: page.piece ? {
        type: page.piece.type,
        rotation: page.piece.rotation,
        coordinate: { ...page.piece.coordinate },
    } : undefined,
});

const reorderImportedPages = (pages: Page[], tree: SerializedTree): { pages: Page[]; tree: SerializedTree } => {
    const order = flattenTreeToPageIndices(tree);
    const pageOrder = order.length === pages.length ? order : pages.map((_, index) => index);
    const indexMap = new Map<number, number>();
    pageOrder.forEach((oldIndex, newIndex) => indexMap.set(oldIndex, newIndex));
    const reorderedTree: SerializedTree = {
        ...tree,
        nodes: tree.nodes.map(node => ({
            ...node,
            pageIndex: node.pageIndex >= 0 ? (indexMap.get(node.pageIndex) ?? node.pageIndex) : node.pageIndex,
        })),
    };
    const lastTextIndex = new Map<string, number>();
    const reorderedPages = pageOrder.map((oldIndex, newIndex) => {
        const source = pages[oldIndex];
        const comment = source.comment.text ?? '';
        const previousCommentIndex = !source.flags.quiz ? lastTextIndex.get(comment) : undefined;
        const nextPage = clonePageWithComment(source, newIndex, comment, previousCommentIndex);
        if (previousCommentIndex === undefined) {
            lastTextIndex.set(comment, newIndex);
        }
        return nextPage;
    });
    return { pages: reorderedPages, tree: reorderedTree };
};

export const parseTetgramRawData = (
    text: string,
): { pages: Page[]; tree: SerializedTree | null } | { error: string } => {
    let raw: unknown;
    try {
        raw = JSON.parse(text);
    } catch (error) {
        return { error: `Invalid JSON: ${error}` };
    }

    if (!isRecord(raw) || !Array.isArray(raw.pages) || raw.pages.length === 0) {
        return { error: 'RawData must contain at least one page' };
    }

    const rawData = raw;
    const rawPages = rawData.pages as unknown[];
    const rawComments = rawData.comments;
    const rawActions = rawData.actions;
    const pages: Page[] = rawPages.map((rawPage, index) => {
        const comment = getRawString(rawComments, index);
        const action = getRawAction(rawActions, index);
        return {
            index,
            field: { obj: normalizeTetgramPage(rawPage) as Field },
            comment: { text: comment },
            piece: actionToMove(action),
            flags: {
                lock: action?.lock ?? true,
                mirror: action?.mirror ?? false,
                colorize: true,
                rise: action?.rise ?? false,
                quiz: comment.startsWith('#Q'),
            },
        };
    });

    const listLayout = rawData.listLayout;
    const positions = resolveGridPositions(listLayout, pages.length);
    if (!positions) {
        return { pages, tree: null };
    }

    const tree = buildTreeFromGrid(positions);
    const reordered = reorderImportedPages(pages, tree);
    return {
        tree: reordered.tree,
        pages: embedTreeInPages(reordered.pages, reordered.tree, true),
    };
};

/**
 * @jest-environment jsdom
 */
import { ModeTypes, Piece, Rotation, toPositionIndex, TouchTypes } from '../../lib/enums';
import { Field } from '../../lib/fumen/field';
import { Page } from '../../lib/fumen/types';
import { getBlockPositions } from '../../lib/piece';
import { PaintTool, PrimaryTool, RectSelectState } from '../../states';
import { HighlightType } from '../../state_types';

const mockCancelRectSelectionPreview = jest.fn(() => () => undefined);
const mockDeleteSelectionUnderEraser = jest.fn(() => () => undefined);
const mockStartRectSelection = jest.fn(() => () => undefined);
const mockClearPiece = jest.fn(() => () => undefined);
const mockReturnCurrentPieceToQueue = jest.fn(() => () => undefined);

jest.mock('../../actions', () => ({
    actions: {
        openPage: () => () => undefined,
        reopenCurrentPage: () => () => undefined,
        fixInferencePiece: () => () => undefined,
        ontouchMoveField: () => () => undefined,
        ontouchMoveSentLine: () => () => undefined,
        registerHistoryTask: () => () => undefined,
        cancelRectSelectionPreview: mockCancelRectSelectionPreview,
        deleteSelectionUnderEraser: mockDeleteSelectionUnderEraser,
        startRectSelection: mockStartRectSelection,
        clearPiece: mockClearPiece,
    },
    main: {},
}));

jest.mock('../../memento', () => ({
    memento: {
        lastKey: jest.fn(),
    },
    localStorageWrapper: {
        saveViewSettings: jest.fn(),
    },
}));

jest.mock('../../states', () => ({
    resources: {
        konva: {
            stage: {
                isReady: false,
            },
        },
        modals: {},
    },
}));

jest.mock('../../env', () => ({
    PageEnv: {
        Version: 'test',
        Debug: false,
    },
}));

jest.mock('../cold_clear', () => ({
    coldClearActions: {
        returnCurrentPieceToQueue: mockReturnCurrentPieceToQueue,
    },
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { fieldEditorActions, getRightClickOverride, isSelectionCell } = require('../field_editor');

const defaultFlags = {
    lock: false,
    mirror: false,
    colorize: true,
    rise: false,
    quiz: false,
};

const currentPiece = {
    type: Piece.T,
    rotation: Rotation.Spawn,
    coordinate: { x: 4, y: 0 },
};

const spawnCellIndex = toPositionIndex(getBlockPositions(
    currentPiece.type,
    currentPiece.rotation,
    currentPiece.coordinate.x,
    currentPiece.coordinate.y,
)[0]);

const createPage = (withPiece: boolean = false): Page => ({
    index: 0,
    field: { obj: new Field({}) },
    comment: { text: '' },
    flags: { ...defaultFlags },
    piece: withPiece ? { ...currentPiece } : undefined,
});

const emptyBlocks = (count: number) => Array.from({ length: count }, () => ({
    piece: Piece.Empty,
    highlight: HighlightType.Normal,
}));

const noSelection: RectSelectState = {
    status: 'none', rect: null, anchorIndex: null, floating: null,
};

interface StateOptions {
    page?: Page;
    primaryTool?: PrimaryTool;
    paintTool?: PaintTool;
    rectSelect?: RectSelectState;
    rightStroke?: 'erase' | 'suppressed';
    deleteSpawnMinoOnPaintDrag?: boolean;
    fieldBlocks?: ReturnType<typeof emptyBlocks>;
    inferences?: number[];
}

// COMP残骸: ミノとして解決していない推定セルは白い'inference'ブロックとして描画される。
const inferenceDebrisBlocks = (indexes: number[]) => {
    const blocks = emptyBlocks(240) as any[];
    for (const index of indexes) {
        blocks[index] = { piece: 'inference', highlight: HighlightType.Highlight2 };
    }
    return blocks;
};

const createState = (options: StateOptions = {}) => {
    const page = options.page ?? createPage();
    const primaryTool = options.primaryTool ?? 'select';
    return {
        mode: {
            touch: primaryTool === 'select' ? TouchTypes.Select : TouchTypes.Drawing,
            type: primaryTool === 'select' ? ModeTypes.Select : ModeTypes.DrawingTool,
            piece: Piece.Gray,
            ghostVisible: true,
            deleteSpawnMinoOnPaintDrag: options.deleteSpawnMinoOnPaintDrag ?? true,
        },
        events: {
            piece: undefined,
            drawing: false,
            rightStroke: options.rightStroke,
            inferences: options.inferences ?? [],
            prevPage: undefined,
            updated: false,
            lastTouchedIndex: undefined,
            lastTouchedSentIndex: undefined,
        },
        fumen: {
            pages: [page],
            currentIndex: 0,
            maxPage: 1,
            guideLineColor: true,
        },
        cache: {
            currentInitField: new Field({}),
        },
        editorUi: {
            primaryTool,
            paintTool: options.paintTool ?? 'pen',
        },
        rectSelect: options.rectSelect ?? noSelection,
        field: options.fieldBlocks ?? emptyBlocks(240),
        sentLine: emptyBlocks(10),
    } as any;
};

const merge = (state: any, next: any) => ({ ...state, ...next });

beforeEach(() => {
    mockCancelRectSelectionPreview.mockClear();
    mockDeleteSelectionUnderEraser.mockClear();
    mockStartRectSelection.mockClear();
    mockClearPiece.mockClear();
    mockReturnCurrentPieceToQueue.mockClear();
});

describe('getRightClickOverride', () => {
    test('follows the paint tool inside PAINT', () => {
        expect(getRightClickOverride(createState({ primaryTool: 'paint', paintTool: 'pen' })))
            .toEqual({ touch: TouchTypes.Drawing, piece: Piece.Empty });
        expect(getRightClickOverride(createState({ primaryTool: 'paint', paintTool: 'fill' })))
            .toEqual({ touch: TouchTypes.Fill, piece: Piece.Empty });
        expect(getRightClickOverride(createState({ primaryTool: 'paint', paintTool: 'fillRow' })))
            .toEqual({ touch: TouchTypes.FillRow, piece: Piece.Empty });
    });

    test('erases a single cell outside PAINT even when an area paint tool is armed', () => {
        expect(getRightClickOverride(createState({ primaryTool: 'select', paintTool: 'fill' })).touch)
            .toBe(TouchTypes.Drawing);
        expect(getRightClickOverride(createState({ primaryTool: 'piece', paintTool: 'fillRow' })).touch)
            .toBe(TouchTypes.Drawing);
    });
});

const settledRect = { minX: 2, minY: 0, maxX: 4, maxY: 1 };
const partFloating = {
    cells: [Piece.I, Piece.I], width: 2, height: 1,
    targetX: 3, targetY: 2, sourceRect: null,
    pointerOffsetX: 0, pointerOffsetY: 0,
};

describe('isSelectionCell', () => {
    test('detects the inside and outside of a rect being dragged', () => {
        const state = createState({
            rectSelect: { rect: settledRect, status: 'selecting', anchorIndex: 2, floating: null },
        });
        expect(isSelectionCell(state, 3)).toBe(true);
        expect(isSelectionCell(state, 14)).toBe(true);
        expect(isSelectionCell(state, 5)).toBe(false);
        expect(isSelectionCell(state, 22)).toBe(false);
    });

    test('detects the inside and outside of a floating preview', () => {
        const state = createState({
            rectSelect: {
                floating: partFloating, status: 'floating', rect: null, anchorIndex: null,
            },
        });
        expect(isSelectionCell(state, 23)).toBe(true);
        expect(isSelectionCell(state, 24)).toBe(true);
        expect(isSelectionCell(state, 25)).toBe(false);
        expect(isSelectionCell(state, 13)).toBe(false);
    });

    test('detects a settled selection', () => {
        const state = createState({
            rectSelect: { rect: settledRect, status: 'selected', anchorIndex: null, floating: null },
        });
        expect(isSelectionCell(state, 3)).toBe(true);
        expect(isSelectionCell(state, 5)).toBe(false);
    });

    test('no selection is never a selection cell', () => {
        expect(isSelectionCell(createState(), 3)).toBe(false);
    });
});

describe('onrightStartField', () => {
    test('deletes the whole selection when pressed inside a settled rect', () => {
        const state = createState({
            rectSelect: { rect: settledRect, status: 'selected', anchorIndex: null, floating: null },
        });

        const next = fieldEditorActions.onrightStartField({ index: 3 })(state) as any;

        expect(mockDeleteSelectionUnderEraser).toHaveBeenCalledTimes(1);
        // 続くドラッグで消しゴムが走らないように、ストロークは消費済みにする。
        expect(next.events.rightStroke).toBe('suppressed');
    });

    test('deletes a floating part preview when pressed inside it', () => {
        const state = createState({
            rectSelect: {
                floating: partFloating, status: 'floating', rect: null, anchorIndex: null,
            },
        });

        const next = fieldEditorActions.onrightStartField({ index: 23 })(state) as any;

        expect(mockDeleteSelectionUnderEraser).toHaveBeenCalledTimes(1);
        expect(next.events.rightStroke).toBe('suppressed');
    });

    test('erases a single cell outside the selection', () => {
        const page = createPage();
        page.commands = {
            pre: { 'block-7': { x: 7, y: 0, piece: Piece.I, type: 'block' } },
        };
        const fieldBlocks = emptyBlocks(240);
        fieldBlocks[7] = { piece: Piece.I, highlight: HighlightType.Normal };
        const state = createState({
            page,
            fieldBlocks,
            rectSelect: { rect: settledRect, status: 'selected', anchorIndex: null, floating: null },
        });

        const started = fieldEditorActions.onrightStartField({ index: 7 })(state) as any;

        expect(mockDeleteSelectionUnderEraser).not.toHaveBeenCalled();
        expect(started.events.rightStroke).toBe('erase');
        expect(started.rectSelect).toBeUndefined();

        fieldEditorActions.onrightMoveField({ index: 7 })(merge(state, started));
        expect(page.commands!.pre['block-7']).toBeUndefined();
    });

    test('returns the SPAWN mino to the queue in SELECT as well', () => {
        const state = createState({ page: createPage(true) });

        fieldEditorActions.onrightStartField({ index: spawnCellIndex })(state);

        expect(mockReturnCurrentPieceToQueue).toHaveBeenCalledTimes(1);
        expect(mockClearPiece).not.toHaveBeenCalled();
    });

    test('prefers erasing when a field block sits under the SPAWN mino', () => {
        const page = createPage(true);
        page.commands = {
            pre: {
                [`block-${spawnCellIndex}`]: {
                    x: spawnCellIndex % 10, y: Math.floor(spawnCellIndex / 10), piece: Piece.I, type: 'block',
                },
            },
        };
        const state = createState({ page });

        const next = fieldEditorActions.onrightStartField({ index: spawnCellIndex })(state) as any;

        expect(mockReturnCurrentPieceToQueue).not.toHaveBeenCalled();
        expect(next.events.rightStroke).toBe('erase');
    });
});

describe('onrightMoveField', () => {
    test('does nothing while the stroke is suppressed', () => {
        const state = createState({ rightStroke: 'suppressed' });
        expect(fieldEditorActions.onrightMoveField({ index: 4 })(state)).toBeUndefined();
    });

    test('deletes the SPAWN mino it passes over in SELECT when the setting is on', () => {
        const state = createState({ page: createPage(true), deleteSpawnMinoOnPaintDrag: true });

        fieldEditorActions.onrightMoveField({ index: spawnCellIndex })(state);

        expect(mockClearPiece).toHaveBeenCalledTimes(1);
    });

    test('keeps the SPAWN mino when the setting is off', () => {
        const state = createState({ page: createPage(true), deleteSpawnMinoOnPaintDrag: false });

        fieldEditorActions.onrightMoveField({ index: spawnCellIndex })(state);

        expect(mockClearPiece).not.toHaveBeenCalled();
    });

    test('deletes the selection it passes over when the setting is on', () => {
        const state = createState({
            deleteSpawnMinoOnPaintDrag: true,
            rectSelect: { rect: settledRect, status: 'selected', anchorIndex: null, floating: null },
        });

        fieldEditorActions.onrightMoveField({ index: 3 })(state);

        expect(mockDeleteSelectionUnderEraser).toHaveBeenCalledTimes(1);
    });

    test('keeps the selection it passes over when the setting is off', () => {
        const state = createState({
            deleteSpawnMinoOnPaintDrag: false,
            rectSelect: { rect: settledRect, status: 'selected', anchorIndex: null, floating: null },
        });

        fieldEditorActions.onrightMoveField({ index: 3 })(state);

        expect(mockDeleteSelectionUnderEraser).not.toHaveBeenCalled();
    });
});

describe('the PAINT eraser on a selection', () => {
    test('deletes the selection when tapped, regardless of the setting', () => {
        const state = createState({
            primaryTool: 'paint',
            deleteSpawnMinoOnPaintDrag: false,
            rectSelect: { rect: settledRect, status: 'selected', anchorIndex: null, floating: null },
        });
        state.mode.piece = Piece.Empty;

        fieldEditorActions.ontouchStartField({ index: 3 })(state);

        expect(mockDeleteSelectionUnderEraser).toHaveBeenCalledTimes(1);
    });

    test('paints normally when a color is armed instead of the eraser', () => {
        const state = createState({
            primaryTool: 'paint',
            rectSelect: { rect: settledRect, status: 'selected', anchorIndex: null, floating: null },
        });

        fieldEditorActions.ontouchStartField({ index: 3 })(state);

        expect(mockDeleteSelectionUnderEraser).not.toHaveBeenCalled();
    });

    test('does not touch the selection from SELECT, which moves it instead', () => {
        const state = createState({
            primaryTool: 'select',
            rectSelect: { rect: settledRect, status: 'selected', anchorIndex: null, floating: null },
        });
        state.mode.piece = Piece.Empty;

        fieldEditorActions.ontouchStartField({ index: 3 })(state);

        expect(mockDeleteSelectionUnderEraser).not.toHaveBeenCalled();
        expect(mockStartRectSelection).toHaveBeenCalledTimes(1);
    });

    test('deletes the selection an eraser drag passes over when the setting is on', () => {
        const state = createState({
            primaryTool: 'paint',
            deleteSpawnMinoOnPaintDrag: true,
            rectSelect: { rect: settledRect, status: 'selected', anchorIndex: null, floating: null },
        });
        state.mode.piece = Piece.Empty;
        state.events.piece = Piece.Empty;

        fieldEditorActions.ontouchMoveField({ index: 3 })(state);

        expect(mockDeleteSelectionUnderEraser).toHaveBeenCalledTimes(1);
    });
});

describe('COMP debris', () => {
    test('a right click drops the clicked cell from the inference set', () => {
        const state = createState({
            primaryTool: 'paint',
            inferences: [4, 5],
            fieldBlocks: inferenceDebrisBlocks([4, 5]),
        });

        const next = fieldEditorActions.onrightStartField({ index: 4 })(state) as any;

        expect(next.events.inferences).toEqual([5]);
        expect(next.events.rightStroke).toBe('erase');
    });

    test('a right drag drops every debris cell it passes over', () => {
        const state = createState({
            primaryTool: 'paint',
            inferences: [4, 5],
            fieldBlocks: inferenceDebrisBlocks([4, 5]),
        });

        const started = fieldEditorActions.onrightStartField({ index: 4 })(state) as any;
        const moved = fieldEditorActions.onrightMoveField({ index: 5 })(merge(state, started)) as any;

        expect(moved.events.inferences).toEqual([]);
    });

    test('a right click outside the debris keeps the inference set', () => {
        const state = createState({
            primaryTool: 'paint',
            inferences: [4, 5],
            fieldBlocks: inferenceDebrisBlocks([4, 5]),
        });

        const next = fieldEditorActions.onrightStartField({ index: 6 })(state) as any;

        expect(next.events.inferences).toEqual([4, 5]);
    });
});

describe('onrightEnd', () => {
    test('clears the suppressed marker without ending a drawing stroke', () => {
        const state = createState({ rightStroke: 'suppressed' });

        const next = fieldEditorActions.onrightEnd()(state) as any;

        expect(next.events.rightStroke).toBeUndefined();
    });

    test('ends the stroke and clears the marker in SELECT', () => {
        const state = createState({ rightStroke: 'erase' });
        state.events.piece = Piece.Empty;

        const next = fieldEditorActions.onrightEnd()(state) as any;

        expect(next.events.piece).toBeUndefined();
        expect(next.events.rightStroke).toBeUndefined();
    });
});

describe('left click after a right stroke', () => {
    test('a stale right-stroke marker never bridges into a left stroke', () => {
        const state = createState({ primaryTool: 'paint', rightStroke: 'erase' });

        const next = fieldEditorActions.ontouchStartField({ index: 4 })(state) as any;

        expect(next.events.rightStroke).toBeUndefined();
    });
});

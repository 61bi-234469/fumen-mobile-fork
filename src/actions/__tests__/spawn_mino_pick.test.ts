/**
 * @jest-environment jsdom
 */
import { ModeTypes, Piece, TouchTypes } from '../../lib/enums';
import { Field } from '../../lib/fumen/field';
import { Page } from '../../lib/fumen/types';
import { HighlightType } from '../../state_types';

// pickArmed 中のフィールドタップが、塗り・選択より先に「変換対象の指定」として横取りされることの検証。
const mockCancelSpawnMinoPick = jest.fn(() => (state: any) => ({
    editorUi: { ...state.editorUi, spawnMinoToggle: { ...state.editorUi.spawnMinoToggle, pickArmed: false } },
}));
const mockConvertBlocksToSpawnMino = jest.fn((data: { index: number }) => {
    void data;
    return () => undefined;
});
const mockStartRectSelection = jest.fn((data: { index: number }) => {
    void data;
    return () => undefined;
});
const mockDeleteSelectionUnderEraser = jest.fn(() => () => undefined);

jest.mock('../../actions', () => ({
    actions: {
        openPage: () => () => undefined,
        reopenCurrentPage: () => () => undefined,
        fixInferencePiece: () => () => undefined,
        ontouchMoveField: () => () => undefined,
        ontouchMoveSentLine: () => () => undefined,
        registerHistoryTask: () => () => undefined,
        cancelRectSelectionPreview: () => () => undefined,
        clearPiece: () => () => undefined,
        cancelSpawnMinoPick: (...args: []) => mockCancelSpawnMinoPick(...args),
        convertBlocksToSpawnMino: (data: { index: number }) => mockConvertBlocksToSpawnMino(data),
        deleteSelectionUnderEraser: (...args: []) => mockDeleteSelectionUnderEraser(...args),
        startRectSelection: (data: { index: number }) => mockStartRectSelection(data),
    },
    main: {},
}));

jest.mock('../../memento', () => ({
    memento: { lastKey: jest.fn() },
    localStorageWrapper: { saveViewSettings: jest.fn() },
}));

jest.mock('../../states', () => ({
    resources: { konva: { stage: { isReady: false } }, modals: {} },
}));

jest.mock('../../env', () => ({
    PageEnv: { Version: 'test', Debug: false },
}));

jest.mock('../cold_clear', () => ({
    coldClearActions: { returnCurrentPieceToQueue: () => () => undefined },
}));

const mockDrawBlockStart = jest.fn((data: { index: number }) => {
    void data;
    return () => undefined;
});
jest.mock('../draw_block', () => ({
    drawBlockActions: {
        ontouchStartField: (data: { index: number }) => mockDrawBlockStart(data),
        fixInferencePiece: () => () => undefined,
        clearInferencePiece: () => () => undefined,
        resetInferencePiece: () => () => undefined,
    },
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { fieldEditorActions } = require('../field_editor');

const createPage = (): Page => ({
    index: 0,
    field: { obj: new Field({}) },
    comment: { text: '' },
    flags: { lock: true, mirror: false, colorize: true, rise: false, quiz: false },
} as Page);

const emptyBlocks = (count: number) => Array.from({ length: count }, () => ({
    piece: Piece.Empty,
    highlight: HighlightType.Normal,
}));

const createState = (options: { pickArmed?: boolean, primaryTool?: string } = {}) => ({
    mode: {
        touch: TouchTypes.Drawing,
        type: ModeTypes.DrawingTool,
        piece: Piece.Gray,
        ghostVisible: true,
        deleteSpawnMinoOnPaintDrag: true,
    },
    events: {
        piece: undefined,
        drawing: false,
        inferences: [],
        prevPage: undefined,
        updated: false,
        lastTouchedIndex: undefined,
        lastTouchedSentIndex: undefined,
    },
    fumen: { pages: [createPage()], currentIndex: 0, maxPage: 1, guideLineColor: true },
    cache: { currentInitField: new Field({}) },
    editorUi: {
        primaryTool: options.primaryTool ?? 'paint',
        paintTool: 'pen',
        spawnMinoToggle: { lastCells: null, pickArmed: options.pickArmed ?? false },
    },
    rectSelect: { status: 'none', rect: null, anchorIndex: null, floating: null },
    field: emptyBlocks(240),
    sentLine: emptyBlocks(10),
}) as any;

beforeEach(() => {
    mockCancelSpawnMinoPick.mockClear();
    mockConvertBlocksToSpawnMino.mockClear();
    mockStartRectSelection.mockClear();
    mockDeleteSelectionUnderEraser.mockClear();
    mockDrawBlockStart.mockClear();
});

describe('pickArmed 中のフィールドタップ', () => {
    test('対象指定として横取りされ、塗りは行われない', () => {
        fieldEditorActions.ontouchStartField({ index: 42 })(createState({ pickArmed: true }));

        expect(mockConvertBlocksToSpawnMino).toHaveBeenCalledWith({ index: 42 });
        expect(mockCancelSpawnMinoPick).toHaveBeenCalledTimes(1);
        expect(mockDrawBlockStart).not.toHaveBeenCalled();
    });

    test('SELECT中でも横取りする（矩形選択を開始しない）', () => {
        const state = createState({ pickArmed: true, primaryTool: 'select' });
        state.mode.touch = TouchTypes.Select;

        fieldEditorActions.ontouchStartField({ index: 42 })(state);

        expect(mockConvertBlocksToSpawnMino).toHaveBeenCalledWith({ index: 42 });
        expect(mockStartRectSelection).not.toHaveBeenCalled();
    });

    test('持ち上げられないセルでも待機は必ず解除される', () => {
        // convertBlocksToSpawnMino は対象外なら undefined を返すが、解除は先に走る
        mockConvertBlocksToSpawnMino.mockImplementationOnce(() => () => undefined);

        fieldEditorActions.ontouchStartField({ index: 200 })(createState({ pickArmed: true }));

        expect(mockCancelSpawnMinoPick).toHaveBeenCalledTimes(1);
        expect(mockDrawBlockStart).not.toHaveBeenCalled();
    });

    test('待機していないときは通常どおり塗りへ進む', () => {
        fieldEditorActions.ontouchStartField({ index: 42 })(createState({ pickArmed: false }));

        expect(mockConvertBlocksToSpawnMino).not.toHaveBeenCalled();
        expect(mockDrawBlockStart).toHaveBeenCalledWith({ index: 42 });
    });
});

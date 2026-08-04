/**
 * @jest-environment jsdom
 */
import { Piece, Rotation, Screens } from '../../lib/enums';
import { Field } from '../../lib/fumen/field';
import { Page } from '../../lib/fumen/types';
import { PieceLayoutMode, PrimaryTool } from '../../states';

const mockUndo = jest.fn(async (..._args: any[]) => undefined);
const mockUndoToPieceSpawn = jest.fn(async (..._args: any[]) => undefined);
const mockRedo = jest.fn(async (..._args: any[]) => undefined);
const mockRedoToPieceSpawn = jest.fn(async (..._args: any[]) => undefined);
const mockClearInferencePiece = jest.fn(() => () => undefined);
const mockQueueCommentAt = jest.fn<string | null, [number]>(() => null);

jest.mock('../../actions', () => ({
    actions: {
        openPage: () => () => undefined,
        clearInferencePiece: mockClearInferencePiece,
        fixInferencePiece: () => () => undefined,
        setPages: () => () => undefined,
        setHistoryCount: () => () => undefined,
    },
    main: {
        loadPagesViaHistory: jest.fn(),
    },
}));

jest.mock('../../memento', () => ({
    memento: {
        register: jest.fn(() => 1),
        save: jest.fn(),
        undo: (...args: any[]) => mockUndo.apply(null, args as []),
        undoToPieceSpawn: (...args: any[]) => mockUndoToPieceSpawn.apply(null, args as []),
        redo: (...args: any[]) => mockRedo.apply(null, args as []),
        redoToPieceSpawn: (...args: any[]) => mockRedoToPieceSpawn.apply(null, args as []),
    },
    localStorageWrapper: {
        saveViewSettings: jest.fn(),
    },
}));

jest.mock('../../states', () => ({
    resources: {
        konva: { stage: { isReady: false } },
        modals: {},
    },
}));

jest.mock('../../env', () => ({
    PageEnv: { Version: 'test', Debug: false },
}));

jest.mock('../cold_clear', () => ({
    getCurrentColdClearQueueComment: (state: any) => mockQueueCommentAt(state.fumen.currentIndex),
    getColdClearQueueCommentAt: (_state: any, pageIndex: number) => mockQueueCommentAt(pageIndex),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { mementoActions, shouldRewindByPieceQueueStep } = require('../memento');

const createPage = (index: number, withPiece: boolean): Page => ({
    index,
    field: { obj: new Field({}) },
    comment: { text: '' },
    flags: { lock: true, mirror: false, colorize: true, rise: false, quiz: false },
    piece: withPiece ? { type: Piece.T, rotation: Rotation.Spawn, coordinate: { x: 4, y: 21 } } : undefined,
});

interface StateOptions {
    screen?: Screens;
    primaryTool?: PrimaryTool;
    pieceLayout?: PieceLayoutMode;
    queueComment?: string | null;
    // ページごとの解決済みコメント。指定するとqueueCommentより優先する
    comments?: (string | null)[];
    currentIndex?: number;
    withPiece?: boolean;
    inferences?: number[];
    undoCount?: number;
    redoCount?: number;
}

const createState = ({
    screen = Screens.Editor,
    primaryTool = 'piece',
    pieceLayout = 'play',
    queueComment = '#Q=[](T)IOSL',
    comments,
    currentIndex,
    withPiece = true,
    inferences = [],
    undoCount = 5,
    redoCount = 5,
}: StateOptions = {}): any => {
    const resolved = comments ?? [queueComment];
    const index = currentIndex ?? resolved.length - 1;
    mockQueueCommentAt.mockImplementation(pageIndex => resolved[pageIndex] ?? null);
    return {
        mode: { screen },
        editorUi: { primaryTool, pieceLayout },
        fumen: {
            currentIndex: index,
            pages: resolved.map((_, pageIndex) => createPage(pageIndex, pageIndex === index && withPiece)),
        },
        events: { inferences },
        history: { undoCount, redoCount },
        tree: { viewMode: undefined, nodes: [], rootId: null, enabled: false },
    };
};

beforeEach(() => {
    jest.clearAllMocks();
});

describe('shouldRewindByPieceQueueStep', () => {
    test('is true only in the INPUT layout with a queue comment', () => {
        expect(shouldRewindByPieceQueueStep(createState())).toBe(true);
    });

    test('is false outside the piece tool', () => {
        expect(shouldRewindByPieceQueueStep(createState({ primaryTool: 'paint' }))).toBe(false);
    });

    test('is false in the select layout', () => {
        expect(shouldRewindByPieceQueueStep(createState({ pieceLayout: 'select' }))).toBe(false);
    });

    test('is false without a comment', () => {
        expect(shouldRewindByPieceQueueStep(createState({ queueComment: null }))).toBe(false);
        expect(shouldRewindByPieceQueueStep(createState({ queueComment: '' }))).toBe(false);
    });

    test('is false when the comment is not a queue', () => {
        expect(shouldRewindByPieceQueueStep(createState({ queueComment: 'hello' }))).toBe(false);
    });

    test('accepts the legacy queue syntax', () => {
        expect(shouldRewindByPieceQueueStep(createState({ queueComment: 'T:IOSL' }))).toBe(true);
    });

    test('is false outside the editor screen', () => {
        expect(shouldRewindByPieceQueueStep(createState({ screen: Screens.ListView }))).toBe(false);
    });

    // キューを使い切ってスポーンできなかった直後は、コメントが空文字になり
    // 現在ページだけではキュー使用中と判定できない。
    test('is true right after the queue ran out and left no current piece', () => {
        expect(shouldRewindByPieceQueueStep(createState({
            comments: ['#Q=[](T)', ''],
            withPiece: false,
        }))).toBe(true);
    });

    test('is false when the previous page is not a queue either', () => {
        expect(shouldRewindByPieceQueueStep(createState({
            comments: ['memo', ''],
            withPiece: false,
        }))).toBe(false);
    });

    test('does not fall back to the previous page while a piece is spawned', () => {
        expect(shouldRewindByPieceQueueStep(createState({
            comments: ['#Q=[](T)', ''],
            withPiece: true,
        }))).toBe(false);
    });

    test('does not fall back on the first page', () => {
        expect(shouldRewindByPieceQueueStep(createState({
            comments: [''],
            withPiece: false,
        }))).toBe(false);
    });
});

describe('undo dispatch', () => {
    test('rewinds by queue step in the INPUT layout with a queue', async () => {
        mementoActions.undo()(createState());
        await Promise.resolve();

        expect(mockUndoToPieceSpawn).toHaveBeenCalledTimes(1);
        expect(mockUndoToPieceSpawn.mock.calls[0][1]).toEqual({ currentPieceSpawned: true });
        expect(mockUndo).not.toHaveBeenCalled();
    });

    test('passes currentPieceSpawned false when the page has no piece', async () => {
        mementoActions.undo()(createState({ withPiece: false }));
        await Promise.resolve();

        expect(mockUndoToPieceSpawn.mock.calls[0][1]).toEqual({ currentPieceSpawned: false });
    });

    test('uses the per-operation undo outside the INPUT queue flow', async () => {
        mementoActions.undo()(createState({ pieceLayout: 'select' }));
        await Promise.resolve();

        expect(mockUndo).toHaveBeenCalledTimes(1);
        expect(mockUndoToPieceSpawn).not.toHaveBeenCalled();
    });

    // キュー切れ直後（コメントが空・カレントミノ無し）でもキュー単位で戻す
    test('rewinds by queue step right after the queue ran out', async () => {
        mementoActions.undo()(createState({
            comments: ['#Q=[](T)', ''],
            withPiece: false,
        }));
        await Promise.resolve();

        expect(mockUndoToPieceSpawn).toHaveBeenCalledTimes(1);
        expect(mockUndoToPieceSpawn.mock.calls[0][1]).toEqual({ currentPieceSpawned: false });
        expect(mockUndo).not.toHaveBeenCalled();
    });

    test('clears the inference piece first without touching history', async () => {
        mementoActions.undo()(createState({ inferences: [0, 1, 2] }));
        await Promise.resolve();

        expect(mockClearInferencePiece).toHaveBeenCalledTimes(1);
        expect(mockUndo).not.toHaveBeenCalled();
        expect(mockUndoToPieceSpawn).not.toHaveBeenCalled();
    });

    test('does nothing when there is no undoable history', async () => {
        mementoActions.undo()(createState({ undoCount: 0 }));
        await Promise.resolve();

        expect(mockUndo).not.toHaveBeenCalled();
        expect(mockUndoToPieceSpawn).not.toHaveBeenCalled();
    });
});

describe('redo dispatch', () => {
    test('advances by queue step in the INPUT layout with a queue', async () => {
        mementoActions.redo()(createState());
        await Promise.resolve();

        expect(mockRedoToPieceSpawn).toHaveBeenCalledTimes(1);
        expect(mockRedo).not.toHaveBeenCalled();
    });

    test('uses the per-operation redo outside the INPUT queue flow', async () => {
        mementoActions.redo()(createState({ primaryTool: 'paint' }));
        await Promise.resolve();

        expect(mockRedo).toHaveBeenCalledTimes(1);
        expect(mockRedoToPieceSpawn).not.toHaveBeenCalled();
    });

    test('does nothing when there is no redoable history', async () => {
        mementoActions.redo()(createState({ redoCount: 0 }));
        await Promise.resolve();

        expect(mockRedo).not.toHaveBeenCalled();
        expect(mockRedoToPieceSpawn).not.toHaveBeenCalled();
    });
});

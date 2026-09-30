import {
    coldClearActions,
    effectiveAiSettings,
    initColdClearActions,
    resetForTesting,
} from '../../../actions/cold_clear';
import { Piece, Rotation, Screens } from '../../enums';
import { Field } from '../../fumen/field';
import { ColdClearWrapper } from '../../cold_clear/ColdClearWrapper';
import { persistViewSettings } from '../../../actions/view_settings';

jest.mock('../../cold_clear/ColdClearWrapper', () => ({
    ColdClearWrapper: jest.fn().mockImplementation(() => ({
        start: jest.fn(),
        requestMove: jest.fn(),
        requestTopMoves: jest.fn(),
        requestSequence: jest.fn(),
        terminate: jest.fn(),
    })),
}));

jest.mock('../../../actions/view_settings', () => ({
    persistViewSettings: jest.fn(),
}));

(global as any).M = { toast: jest.fn() };

jest.mock('../../../locales/keys', () => ({
    i18n: {
        ColdClear: {
            NoMoveFound: () => 'No move found',
            WorkerError: () => 'Worker error',
            InitTimeout: () => 'Init timeout',
            UsageHint: () => 'Usage hint',
            TopBranchesAdded: (count: number) => `${count} branches added`,
            InvalidQueueComment: () => 'Invalid queue comment',
            InsufficientQueueForHold: () => 'Insufficient queue for hold',
            SoldSlearNeedsNext: () => 'Needs NEXT',
            SoldSlearPlacedRank: (rank: number, total: number) => `rank ${rank}/${total}`,
            SoldSlearPlacedOutside: (total: number) => `outside ${total}`,
            ReplayAnalysisRunning: () => 'Replay analysis running',
        },
    },
}));

const wrapperCtor = ColdClearWrapper as any as jest.Mock;
const lastWrapper = () => wrapperCtor.mock.results[wrapperCtor.mock.results.length - 1].value;

const makeState = (overrides: {
    commentText: string;
    engine?: 'coldClear' | 'soldSlear';
    isRunning?: boolean;
    runId?: number;
    runType?: 'single' | 'top3' | 'placed';
    nextLimit?: number | null;
    holdAllowed?: boolean;
    field?: Field;
    piece?: any;
}) => ({
    coldClear: {
        isRunning: overrides.isRunning ?? false,
        abortRequested: false,
        runId: overrides.runId ?? 0,
        runType: overrides.runType ?? 'single',
        targetNodeId: overrides.isRunning ? 'n0' : null,
        progress: null,
        topBranchCount: 20,
        holdAllowed: overrides.holdAllowed ?? true,
        speculate: false,
        nextLimit: overrides.nextLimit !== undefined ? overrides.nextLimit : null,
        weightsPreset: 1,
        thinkMs: 1000,
        engine: overrides.engine ?? 'soldSlear',
        soldSlearBudget: 't200',
        queuePreview: null,
        inputGuide: { enabled: false, status: 'idle', runId: 0, positionKey: null, move: null, usedHold: false },
    },
    fumen: {
        currentIndex: 0,
        pages: [{
            flags: { lock: true, mirror: false, rise: false, quiz: false, colorize: true },
            field: { obj: (overrides.field ?? new Field({})).copy() },
            piece: overrides.piece,
            comment: { text: overrides.commentText },
            index: 0,
        }],
        maxPage: 1,
        guideLineColor: true,
    },
    comment: { text: overrides.commentText, changeKey: 0 },
    replay: { analysis: { status: 'idle' } },
    cache: { currentInitField: new Field({}) },
    modal: { coldClearMenu: true },
    tree: {
        enabled: true,
        nodes: [
            { id: 'root', parentId: null, pageIndex: -1, childrenIds: ['n0'] },
            { id: 'n0', parentId: 'root', pageIndex: 0, childrenIds: [] },
        ],
        rootId: 'root',
        activeNodeId: 'n0',
    },
    mode: { rotationSystem: 'srsPlus', screen: Screens.Editor },
    editorUi: { infinitePieceQueue: false, paletteSelection: 'comp', primaryTool: 'piece', pieceLayout: 'play' },
} as any);

// 最下段の x = 0..5 を灰色で埋める（I を x = 7 に置くと 1 ライン消える）
const bottomRowField = (): Field => {
    const field = new Field({});
    for (let x = 0; x < 6; x += 1) {
        field.setToPlayField(x, Piece.Gray);
    }
    return field;
};

describe('Sold Slear in the Cold Clear actions', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        resetForTesting();
        jest.clearAllMocks();
    });

    afterEach(() => {
        resetForTesting();
        jest.clearAllTimers();
        jest.useRealTimers();
    });

    test('ignores the hidden Cold Clear-only settings and raises NEXT limit 0 to 1', () => {
        const settings = effectiveAiSettings(makeState({
            commentText: '#Q=[](T)IO', holdAllowed: false, nextLimit: 0,
        }));
        expect(settings).toMatchObject({
            engine: 'soldSlear', holdAllowed: true, speculate: true, weightsPreset: 0, nextLimit: 1,
            soldSlearBudget: 't200',
        });
        expect(effectiveAiSettings(makeState({
            commentText: '#Q=[](T)IO', engine: 'coldClear', holdAllowed: false, nextLimit: 0,
        }))).toMatchObject({ engine: 'coldClear', holdAllowed: false, nextLimit: 0, weightsPreset: 1 });
    });

    test('starts a Sold Slear worker with the colored board, S2 chain and budget', () => {
        const field = bottomRowField();
        const result = coldClearActions.startColdClearSearch()(makeState({
            field, commentText: 'b2b=3 combo=2 | #Q=[](I)ZO', holdAllowed: false,
        })) as any;
        expect(result.coldClear.isRunning).toBe(true);
        expect(wrapperCtor).toHaveBeenCalledWith('soldSlear');
        const init = lastWrapper().start.mock.calls[0][0];
        expect(init.fieldCells.slice(0, 10)).toBe('GGGGGG____');
        expect(init.fieldCells).toHaveLength(400);
        expect(init.b2bLevel).toBe(3);
        expect(init.combo).toBe(2);
        expect(init.soldSlearBudget).toBe('t200');
        expect(init.holdAllowed).toBe(true);
        expect(init.weightsPreset).toBe(0);
        // Sold Slear は最後の 1 個に NEXT が無いため置けない
        expect(result.coldClear.progress).toEqual({ current: 0, total: 2 });
    });

    test('refuses to start without a NEXT piece', () => {
        const result = coldClearActions.startColdClearSearch()(makeState({ commentText: '#Q=[S](T)' }));
        expect(result).toBeUndefined();
        expect(wrapperCtor).not.toHaveBeenCalled();
        expect((global as any).M.toast).toHaveBeenCalledWith(expect.objectContaining({ html: 'Needs NEXT' }));
    });

    test('asks for one move at a time and re-inits with the advanced S2 chain', () => {
        const field = bottomRowField();
        // 2 段目にもブロックを置き、消去後に盤面が空（パーフェクトクリア）にならないようにする
        field.setToPlayField(10, Piece.Gray);
        const comment = 'b2b=2 | #Q=[](I)ZO';
        const start = coldClearActions.startColdClearSearch()(makeState({ field, commentText: comment })) as any;
        const runId = start.coldClear.runId;
        const first = lastWrapper();
        const running = makeState({ field, runId, commentText: comment, isRunning: true });

        coldClearActions.onColdClearInitDone({ runId })(running);
        expect(first.requestMove).toHaveBeenCalled();
        expect(first.requestSequence).not.toHaveBeenCalled();

        initColdClearActions({
            addColdClearBranches: jest.fn(),
            coldClearFinishSearch: jest.fn(),
            changeToTreeViewScreen: jest.fn(),
        } as any);
        // I を x = 7 に置いて 1 ライン消去（spin なし）: REN 0 -> 1、B2B 2 -> 0
        coldClearActions.onColdClearMoveResult({
            runId,
            result: {
                type: 'moveResult', hold: false, piece: 0, rotation: 0, x: 7, y: 0,
                s2: { spin: 'none', identity: 'id' },
            },
        })(running);

        expect(first.terminate).toHaveBeenCalled();
        const second = lastWrapper();
        expect(second).not.toBe(first);
        const init = second.start.mock.calls[0][0];
        expect(init.b2bLevel).toBe(0);
        expect(init.combo).toBe(1);
        expect(init.fieldCells.slice(0, 10)).toBe('G_________');
    });

    test('a perfect clear adds the S2 perfect-clear B2B bonus', () => {
        const field = bottomRowField();
        const comment = 'b2b=2 | #Q=[](I)ZO';
        const start = coldClearActions.startColdClearSearch()(makeState({ field, commentText: comment })) as any;
        const runId = start.coldClear.runId;
        initColdClearActions({ addColdClearBranches: jest.fn(), coldClearFinishSearch: jest.fn() } as any);
        coldClearActions.onColdClearMoveResult({
            runId,
            result: {
                type: 'moveResult', hold: false, piece: 0, rotation: 0, x: 7, y: 0,
                s2: { spin: 'none', identity: 'id' },
            },
        })(makeState({ field, runId, commentText: comment, isRunning: true }));
        expect(lastWrapper().start.mock.calls[0][0].b2bLevel).toBe(3);
    });

    test('writes the S2 B2B level and no score on result pages', () => {
        const comment = 'b2b=4 | #Q=[](T)SZ';
        const start = coldClearActions.startColdClearSearch()(makeState({ commentText: comment })) as any;
        const runId = start.coldClear.runId;
        const addColdClearBranches = jest.fn();
        initColdClearActions({
            addColdClearBranches,
            coldClearFinishSearch: jest.fn(),
            changeToTreeViewScreen: jest.fn(),
        } as any);
        const running = makeState({ runId, commentText: comment, isRunning: true });
        coldClearActions.onColdClearMoveResult({
            runId,
            result: {
                type: 'moveResult', hold: false, piece: 2, rotation: 0, x: 4, y: 0, score: 12,
                s2: { spin: 'none', identity: 'id' },
            },
        })(running);
        coldClearActions.stopColdClearSearch()(running);

        const page = addColdClearBranches.mock.calls[0][0].pages[0];
        expect(page.comment.text).toBe('b2b=4 | #Q=[](T)SZ');
    });

    test('reports the placed piece rank by toast without rewriting the comment', () => {
        const piece = { type: Piece.T, rotation: Rotation.Spawn, coordinate: { x: 4, y: 0 } };
        const comment = '#Q=[](T)SZ';
        const start = coldClearActions.evaluatePlacedSpawnMinoScore()(makeState({
            piece, commentText: comment,
        })) as any;
        const runId = start.coldClear.runId;
        const setCommentText = jest.fn();
        initColdClearActions({
            setCommentText,
            coldClearFinishSearch: jest.fn(),
            changeToDrawerScreen: jest.fn(),
            changeToDrawingToolMode: jest.fn(),
        } as any);
        const running = makeState({ piece, runId, commentText: comment, isRunning: true, runType: 'placed' });

        coldClearActions.onColdClearInitDone({ runId })(running);
        expect(lastWrapper().requestTopMoves).toHaveBeenCalledWith(16);

        coldClearActions.onColdClearTopMovesResult({
            runId,
            results: [
                { hold: false, piece: 2, rotation: 0, x: 1, y: 0 },
                { hold: false, piece: 2, rotation: 0, x: 4, y: 0 },
            ],
        })(running);
        expect((global as any).M.toast).toHaveBeenCalledWith(expect.objectContaining({ html: 'rank 2/2' }));
        expect(setCommentText).not.toHaveBeenCalled();
    });

    test('toggles the engine, persists it and clears the INPUT guide', () => {
        const state = makeState({ commentText: '#Q=[](T)SZ', engine: 'coldClear' });
        const next = coldClearActions.toggleAiEngine()(state) as any;
        expect(next.coldClear.engine).toBe('soldSlear');
        expect(next.coldClear.inputGuide.status).toBe('idle');
        expect(persistViewSettings).toHaveBeenCalledWith(state, { aiEngine: 'soldSlear' });

        const back = coldClearActions.toggleAiEngine()(makeState({ commentText: '', engine: 'soldSlear' })) as any;
        expect(back.coldClear.engine).toBe('coldClear');
    });

    test('does not switch engines while a search is running', () => {
        expect(coldClearActions.toggleAiEngine()(makeState({
            commentText: '', engine: 'coldClear', isRunning: true,
        }))).toBeUndefined();
        expect(coldClearActions.setAiEngine({ engine: 'unknown' })(makeState({
            commentText: '', engine: 'coldClear',
        }))).toBeUndefined();
    });
});

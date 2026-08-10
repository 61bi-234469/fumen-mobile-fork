/**
 * @jest-environment jsdom
 */

jest.mock('../../actions', () => ({
    actions: {
        changeScreen: ({ screen }: { screen: string }) => (state: any) => ({
            mode: { ...state.mode, screen },
        }),
    },
    main: {
        appendPages: jest.fn(),
        changeToDrawerScreen: jest.fn(),
        selectPieceLayout: jest.fn(),
        beginTtrmParse: jest.fn(),
        setReplayIR: jest.fn(),
        setReplayError: jest.fn(),
        tickReplayClock: jest.fn(),
        pauseReplayPlayback: jest.fn(),
        abortReplayAnalysis: jest.fn(),
    },
}));
jest.mock('../view_settings', () => ({
    loadPersistedReplaySelfPlayer: jest.fn(() => null),
    persistViewSettings: jest.fn(),
}));
// Worker を生成させない（AI 解析セッションはこのテストの対象外）
jest.mock('../../lib/cold_clear/ColdClearWrapper', () => ({
    ColdClearWrapper: jest.fn().mockImplementation(() => ({
        open: jest.fn(),
        start: jest.fn(),
        analyzePosition: jest.fn(),
        terminate: jest.fn(),
    })),
}));
jest.mock('../../states', () => ({
    initialReplayState: {
        phase: 'empty',
        fileName: undefined,
        ir: undefined,
        requestId: 0,
        selection: { roundIndex: 0, selfPlayerId: null },
        cursor: { frame: 0, selfIndex: 0, opponentIndex: 0, stepBasis: 'self', turnStop: false },
        playback: { status: 'pause', speed: 1 },
        view: { showOpponent: true, showGarbage: true },
        analysis: {
            key: null,
            status: 'idle',
            runId: 0,
            thinkMs: 100,
            progress: { current: 0, total: 0 },
            moves: [],
            error: undefined,
        },
        error: undefined,
    },
    initialReplayAnalysisState: {
        key: null,
        status: 'idle',
        runId: 0,
        thinkMs: 100,
        progress: { current: 0, total: 0 },
        moves: [],
        error: undefined,
    },
    REPLAY_SPEEDS: [0.25, 0.5, 1, 2, 4],
    DEFAULT_REPLAY_SPEED: 1,
    DEFAULT_REPLAY_SHOW_OPPONENT: true,
    DEFAULT_REPLAY_SHOW_GARBAGE: true,
}));
jest.mock('../../lib/ttrm/ReplayWorkerWrapper', () => {
    const start = jest.fn();
    const terminate = jest.fn();
    return {
        ReplayWorkerWrapper: class {
            start = start;
            terminate = terminate;
        },
        __mockWorker: { start, terminate },
    };
});

import {
    getCurrentReplayQueue,
    getReplayKiller,
    getReplayOpponentGarbage,
    getReplayOpponentPoint,
    getReplayOpponentVisual,
    getReplaySelfGarbage,
    getReplaySelfPoint,
    getReplaySelfVisual,
    getReplayStats,
    REPLAY_CLOCK_INTERVAL_MS,
    replayActions,
} from '../replay';
import { main } from '../../actions';
import { initialReplayState, State } from '../../states';
import { FieldConstants, Piece, Rotation } from '../../lib/enums';
import { GarbageEvent, IRField, LockPoint, ReplayIR } from '../../lib/ttrm/types';
import { clampPointIndex, frameAt, indexAtFrame } from '../../lib/ttrm/timeline';
import { loadPersistedReplaySelfPlayer, persistViewSettings } from '../view_settings';

// tslint:disable-next-line:no-var-requires
const { __mockWorker } = require('../../lib/ttrm/ReplayWorkerWrapper');

const flushPromises = () => new Promise(resolve => setTimeout(resolve, 0));

// 相手の設置は自陣とずれる。同一時刻で手番数が一致しないことを再現するためのオフセット。
const OPPONENT_FRAME_OFFSET = 15;

const emptyField = (): IRField =>
    Array.from({ length: FieldConstants.PlayBlocks }).map(() => Piece.Empty);

// 手番 i は frame (i+1)*30。相手側は offset ぶんずらして、両者の手番数が
// 一致しないこと（P2 が解こうとしている問題そのもの）をテストで再現する。
const lockAt = (pieceIndex: number, offset: number = 0): LockPoint => ({
    pieceIndex,
    frame: (pieceIndex + 1) * 30 + offset,
    fieldBefore: emptyField(),
    fieldAfter: emptyField(),
    piece: Piece.T,
    rotation: 0,
    x: 4,
    y: 0,
    hold: null,
    current: Piece.O,
    next: [Piece.I],
    clear: { lines: 0, spin: 'none', b2b: 0, ren: 0, perfectClear: false },
    attack: 0,
    garbageGauge: 0,
    sourceHeight: 1,
    clippedRowCount: 0,
});

const buildIR = (lockCount: number, roundStatus: 'ok' | 'failed' = 'ok'): ReplayIR => {
    const players = ['player-a-id', 'player-b-id'].map(id => ({
        id,
        username: id.replace('-id', ''),
        resolvedOptions: {},
        optionWarnings: [],
        initial: {
            frame: 0,
            field: emptyField(),
            hold: null,
            current: id === 'player-a-id' ? Piece.T : Piece.L,
            next: [Piece.J, Piece.S],
        },
        locks: Array.from({ length: lockCount })
            .map((ignore, i) => lockAt(i, id === 'player-b-id' ? OPPONENT_FRAME_OFFSET : 0)),
        terminal: {
            frame: lockCount * 30 + 60,
            field: emptyField(),
            sourceHeight: 0,
            clippedRowCount: 0,
            garbageGauge: 0,
            hold: null,
            current: Piece.S,
            next: [Piece.Z],
            reason: id === 'player-a-id' ? 'winner' : 'garbagesmash',
            alive: id === 'player-a-id',
        },
        garbageEvents: [],
        verification: {
            piecesplaced: { expected: lockCount, actual: lockCount },
            lines: { expected: 0, actual: 0 },
            sent: { expected: 0, actual: 0 },
            matched: true,
        },
    }));
    return {
        meta: {
            users: [
                { id: 'player-a-id', username: 'player-a' },
                { id: 'player-b-id', username: 'player-b' },
            ],
            gamemode: 'league',
            ts: '2026-03-27T00:00:00.000Z',
            version: 1,
            parseMs: 12,
        },
        rounds: [{
            players,
            index: 0,
            startFrame: 0,
            endFrame: lockCount * 30 + 60,
            result: { winnerId: 'player-a-id', reasons: {} },
            status: roundStatus,
        }],
    };
};

const createState = (overrides: Partial<State['replay']> = {}, undoCount: number = 0): State => ({
    replay: {
        ...initialReplayState,
        ...overrides,
    },
    history: { undoCount, redoCount: 0 },
    handlers: {},
    modal: {},
    mode: { screen: 'Editor' },
    fumen: { currentIndex: 2, guideLineColor: true },
} as unknown as State);

// カーソルは frame が唯一の真実。テストからは自陣の index を指定し、frame と
// 相手 index はプロダクションと同じ規則（明示側は据え置き）で組み立てる。
const cursorFor = (
    ir: ReplayIR, selfIndex: number, overrides: Partial<State['replay']['cursor']> = {},
): State['replay']['cursor'] => {
    const [self, opponent] = ir.rounds[0].players;
    const frame = frameAt(self, selfIndex);
    return {
        frame,
        selfIndex: clampPointIndex(self, selfIndex),
        opponentIndex: indexAtFrame(opponent, frame),
        stepBasis: 'self',
        turnStop: false,
        ...overrides,
    };
};

const playingState = (
    lockCount: number,
    selfIndex: number = 1,
    cursorOverrides: Partial<State['replay']['cursor']> = {},
    replayOverrides: Partial<State['replay']> = {},
): State => {
    const ir = buildIR(lockCount);
    return createState({
        ir,
        phase: 'playing',
        selection: { roundIndex: 0, selfPlayerId: 'player-a-id' },
        cursor: cursorFor(ir, selfIndex, cursorOverrides),
        ...replayOverrides,
    });
};

// アクションの戻り値を state に畳み込む（Hyperapp のトップレベル浅いマージと同じ）。
const applyResult = (state: State, result: Partial<State> | undefined): State =>
    result === undefined ? state : { ...state, ...result } as State;

describe('replayActions', () => {
    describe('phase transitions', () => {
        test('the realtime playback clock updates at about 60Hz', () => {
            expect(REPLAY_CLOCK_INTERVAL_MS).toEqual(16);
        });

        test('setReplayIR moves to select phase with the left player selected', () => {
            const result = replayActions.setReplayIR(
                { ir: buildIR(3), fileName: 'a.ttrm', requestId: 0 })(createState())!;
            expect(result.replay!.phase).toEqual('select');
            expect(result.replay!.fileName).toEqual('a.ttrm');
            expect(result.replay!.selection.selfPlayerId).toEqual('player-a-id');
        });

        test('setReplayIR prefers the remembered player over the left one (FR-13)', () => {
            (loadPersistedReplaySelfPlayer as jest.Mock).mockReturnValueOnce('player-b');
            const result = replayActions.setReplayIR(
                { ir: buildIR(3), fileName: 'a.ttrm', requestId: 0 })(createState())!;
            expect(result.replay!.selection.selfPlayerId).toEqual('player-b-id');
        });

        test('setReplayIR falls back to the left player when the remembered name is absent', () => {
            (loadPersistedReplaySelfPlayer as jest.Mock).mockReturnValueOnce('someone-else');
            const result = replayActions.setReplayIR(
                { ir: buildIR(3), fileName: 'a.ttrm', requestId: 0 })(createState())!;
            expect(result.replay!.selection.selfPlayerId).toEqual('player-a-id');
        });

        test('setReplayError moves to failed phase and keeps the file name', () => {
            const state = createState({ phase: 'parsing', fileName: 'bad.ttrm', requestId: 1 });
            const result = replayActions.setReplayError({ stage: 'json', message: 'broken', requestId: 1 })(state)!;
            expect(result.replay!.phase).toEqual('failed');
            expect(result.replay!.fileName).toEqual('bad.ttrm');
            expect(result.replay!.error).toEqual({ stage: 'json', message: 'broken' });
        });

        // P1 レビュー対応: 古いインポート試行の応答が後から届いても、最新の requestId と
        // 一致しない限り状態を更新しない（複数ファイル連続選択・リセットの競合対策）。
        test('setReplayIR ignores a stale requestId', () => {
            const state = createState({ phase: 'parsing', requestId: 2 });
            const result = replayActions.setReplayIR({ ir: buildIR(3), fileName: 'old.ttrm', requestId: 1 })(state);
            expect(result).toBeUndefined();
        });

        test('setReplayError ignores a stale requestId', () => {
            const state = createState({ phase: 'parsing', requestId: 2 });
            const result = replayActions.setReplayError({ stage: 'json', message: 'old', requestId: 1 })(state);
            expect(result).toBeUndefined();
        });

        test('beginTtrmParse starts the worker only when the requestId is still current', () => {
            __mockWorker.start.mockClear();
            const staleState = createState({ phase: 'parsing', requestId: 2 });
            expect(replayActions.beginTtrmParse(
                { requestId: 1, text: '{}', fileName: 'a.ttrm' })(staleState)).toBeUndefined();
            expect(__mockWorker.start).not.toHaveBeenCalled();

            const currentState = createState({ phase: 'parsing', requestId: 1 });
            replayActions.beginTtrmParse({ requestId: 1, text: '{}', fileName: 'a.ttrm' })(currentState);
            expect(__mockWorker.start).toHaveBeenCalledTimes(1);
        });

        test('importTtrmFile assigns a fresh, increasing requestId on each call', () => {
            const file = { name: 'a.ttrm', size: 10, text: async () => '{}' } as unknown as File;
            const first = replayActions.importTtrmFile({ file })(createState())!;
            const second = replayActions.importTtrmFile({ file })(createState())!;
            expect(second.replay!.requestId).toBeGreaterThan(first.replay!.requestId!);
        });

        // 先に選んだファイルの File.text() が、後から選んだファイルの取り込みより遅れて
        // 完了しても、最新の取り込みを上書きしないことを、実際の store 更新を模した
        // 小さなディスパッチループで確認する（P1 レビュー指摘の再現）。
        test('a slow-to-read earlier file does not clobber a later import', async () => {
            let liveState = createState();
            const dispatch = (partial: Partial<State> | undefined) => {
                if (partial !== undefined) {
                    liveState = { ...liveState, ...partial } as State;
                }
            };
            (main.beginTtrmParse as jest.Mock).mockImplementation(
                (data: { requestId: number, text: string, fileName: string }) => {
                    dispatch(replayActions.beginTtrmParse(data)(liveState));
                });
            (main.setReplayIR as jest.Mock).mockImplementation(
                (data: { ir: ReplayIR, fileName: string, requestId: number }) => {
                    dispatch(replayActions.setReplayIR(data)(liveState));
                });
            __mockWorker.start.mockImplementation(
                (text: string, onMessage: (msg: { type: 'ir', ir: ReplayIR }) => void) => {
                    // Worker は同期的に応答したことにして、応答順序ではなく
                    // requestId の照合だけで正しさが決まることを確認する。
                    onMessage({ type: 'ir', ir: buildIR(0) });
                });

            let resolveSlow: (text: string) => void = () => undefined;
            const slowFile = {
                name: 'slow.ttrm',
                size: 10,
                text: () => new Promise<string>((resolve) => { resolveSlow = resolve; }),
            } as unknown as File;
            const fastFile = {
                name: 'fast.ttrm',
                size: 10,
                text: async () => 'fast-text',
            } as unknown as File;

            dispatch(replayActions.importTtrmFile({ file: slowFile })(liveState));
            dispatch(replayActions.importTtrmFile({ file: fastFile })(liveState));

            // 速い方が先に解決し、select フェーズへ進む
            await flushPromises();
            expect(liveState.replay.phase).toEqual('select');
            expect(liveState.replay.fileName).toEqual('fast.ttrm');

            // 遅い方がその後に解決しても、requestId が古いため無視される
            resolveSlow('slow-text');
            await flushPromises();
            expect(liveState.replay.phase).toEqual('select');
            expect(liveState.replay.fileName).toEqual('fast.ttrm');

            (main.beginTtrmParse as jest.Mock).mockReset();
            (main.setReplayIR as jest.Mock).mockReset();
            __mockWorker.start.mockReset();
        });

        test('startReplayPlayback requires a self player (FR-10)', () => {
            const state = createState({
                ir: buildIR(3),
                phase: 'select',
                selection: { roundIndex: 0, selfPlayerId: null },
            });
            expect(replayActions.startReplayPlayback()(state)).toBeUndefined();
        });

        test('startReplayPlayback refuses failed rounds', () => {
            const state = createState({
                ir: buildIR(3, 'failed'),
                phase: 'select',
                selection: { roundIndex: 0, selfPlayerId: 'player-a-id' },
            });
            expect(replayActions.startReplayPlayback()(state)).toBeUndefined();
        });

        test('startReplayPlayback enters playing at frame 0 with both sides in sync', () => {
            const state = createState({
                ir: buildIR(3),
                phase: 'select',
                selection: { roundIndex: 0, selfPlayerId: 'player-a-id' },
            });
            const result = replayActions.startReplayPlayback()(state)!;
            expect(result.replay!.phase).toEqual('playing');
            expect(result.replay!.cursor.selfIndex).toEqual(0);
            expect(result.replay!.cursor.frame).toEqual(0);
            expect(result.replay!.cursor.opponentIndex).toEqual(0);
        });

        test('backToReplaySelect returns to select phase', () => {
            const result = replayActions.backToReplaySelect()(playingState(3))!;
            expect(result.replay!.phase).toEqual('select');
        });

        test('startReplayPlayback also starts at frame 0 when the self player has zero locks', () => {
            const state = createState({
                ir: buildIR(0),
                phase: 'select',
                selection: { roundIndex: 0, selfPlayerId: 'player-a-id' },
            });
            const result = replayActions.startReplayPlayback()(state)!;
            expect(result.replay!.phase).toEqual('playing');
            expect(result.replay!.cursor.selfIndex).toEqual(0);
            expect(result.replay!.cursor.frame).toEqual(0);
            expect(getReplaySelfPoint(applyResult(state, result))!.kind).toEqual('initial');
        });
    });

    describe('selection', () => {
        test('selectReplayRound ignores out-of-range indices', () => {
            const state = createState({ ir: buildIR(3), phase: 'select' });
            expect(replayActions.selectReplayRound({ roundIndex: 5 })(state)).toBeUndefined();
            expect(replayActions.selectReplayRound({ roundIndex: -1 })(state)).toBeUndefined();
        });

        test('selectReplaySelfPlayer persists the username (FR-13)', () => {
            const state = createState({ ir: buildIR(3), phase: 'select' });
            const result = replayActions.selectReplaySelfPlayer({ playerId: 'player-b-id' })(state)!;
            expect(result.replay!.selection.selfPlayerId).toEqual('player-b-id');
            expect(persistViewSettings).toHaveBeenCalledWith(state, { replaySelfPlayer: 'player-b' });
        });

        test('selectReplaySelfPlayer ignores unknown ids', () => {
            const state = createState({ ir: buildIR(3), phase: 'select' });
            expect(replayActions.selectReplaySelfPlayer({ playerId: 'nobody' })(state)).toBeUndefined();
        });
    });

    describe('stepReplayLock boundaries (FR-21/28)', () => {
        test('stepping back from piece 1 reaches the round start point', () => {
            const result = replayActions.stepReplayLock({ step: -1 })(playingState(3, 1))!;
            expect(result.replay!.cursor.selfIndex).toEqual(0);
            expect(result.replay!.cursor.frame).toEqual(0);
        });

        test('does not step back from the start point', () => {
            expect(replayActions.stepReplayLock({ step: -1 })(playingState(3, 0))).toBeUndefined();
        });

        test('stepping forward from the last lock reaches the terminal', () => {
            const state = playingState(3, 3);
            const result = replayActions.stepReplayLock({ step: 1 })(state)!;
            expect(result.replay!.cursor.selfIndex).toEqual(4);
            expect(getReplaySelfPoint(applyResult(state, result))!.kind).toEqual('terminal');
        });

        test('does not step forward past the terminal', () => {
            expect(replayActions.stepReplayLock({ step: 1 })(playingState(3, 4))).toBeUndefined();
        });

        test('stepping back from the terminal returns to the last lock', () => {
            const result = replayActions.stepReplayLock({ step: -1 })(playingState(3, 4))!;
            expect(result.replay!.cursor.selfIndex).toEqual(3);
            expect(result.replay!.cursor.frame).toEqual(90);
        });

        // P2 §7-2 の意図的変更: 先頭は「手番 1」ではなく「開始（設置 0）」
        test('replayFirstLock and replayLastLock jump to the start and the terminal', () => {
            const state = playingState(5, 3);
            expect(replayActions.replayFirstLock()(state)!.replay!.cursor.selfIndex).toEqual(0);
            expect(replayActions.replayLastLock()(state)!.replay!.cursor.selfIndex).toEqual(6);
        });

        describe('zero-lock rounds (P2)', () => {
            // ポイント空間は [initial, terminal] の 2 点だけ
            test('the two points can be walked back and forth', () => {
                const atTerminal = playingState(0, 1);
                const back = replayActions.stepReplayLock({ step: -1 })(atTerminal)!;
                expect(back.replay!.cursor.selfIndex).toEqual(0);

                const forward = replayActions.stepReplayLock({ step: 1 })(
                    applyResult(atTerminal, back))!;
                expect(forward.replay!.cursor.selfIndex).toEqual(1);
            });

            test('does not step back from the start point', () => {
                expect(replayActions.stepReplayLock({ step: -1 })(playingState(0, 0))).toBeUndefined();
            });

            test('does not step forward past terminal', () => {
                expect(replayActions.stepReplayLock({ step: 1 })(playingState(0, 1))).toBeUndefined();
            });

            test('replayFirstLock reaches the start and replayLastLock the terminal', () => {
                expect(replayActions.replayFirstLock()(playingState(0, 1))!.replay!.cursor.selfIndex)
                    .toEqual(0);
                expect(replayActions.replayLastLock()(playingState(0, 0))!.replay!.cursor.selfIndex)
                    .toEqual(1);
            });
        });
    });

    describe('getCurrentReplayQueue', () => {
        test('reads the lock point queue while stepping', () => {
            expect(getCurrentReplayQueue(playingState(3))).toEqual({
                hold: null, current: Piece.O, next: [Piece.I],
            });
        });

        test('reads the terminal queue at the end', () => {
            const state = playingState(3, 4);
            expect(getCurrentReplayQueue(state)).toEqual({
                hold: null, current: Piece.S, next: [Piece.Z],
            });
        });

        test('is undefined outside the playing phase', () => {
            const state = createState({
                ir: buildIR(3),
                phase: 'select',
                selection: { roundIndex: 0, selfPlayerId: 'player-a-id' },
            });
            expect(getCurrentReplayQueue(state)).toBeUndefined();
        });
    });

    describe('openReplayInEditor', () => {
        beforeEach(() => {
            (main.appendPages as jest.Mock).mockClear();
            (main.changeToDrawerScreen as jest.Mock).mockClear();
            (main.selectPieceLayout as jest.Mock).mockClear();
        });

        test('inserts the point as a new page after the current one', () => {
            // currentIndex は 2。既存ページを置き換えず 3 番目の次に挿入する
            replayActions.openReplayInEditor()(playingState(3));

            expect(main.appendPages).toHaveBeenCalledTimes(1);
            const call = (main.appendPages as jest.Mock).mock.calls[0][0];
            expect(call.pageIndex).toEqual(3);
            expect(call.pages).toHaveLength(1);
            expect(call.pages[0].comment.text).toEqual('#Q=[](O)I');
            expect(call.pieceSpawn).toBeTruthy();
            expect(call.pages[0].internal.inputReplayContext.stats).toMatchObject({
                pieces: 1,
                b2bChain: 1,
                renChain: 1,
            });
        });

        test('hands the current mino over as a spawned piece', () => {
            replayActions.openReplayInEditor()(playingState(3));

            const call = (main.appendPages as jest.Mock).mock.calls[0][0];
            expect(call.pages[0].piece).toEqual({
                type: Piece.O,
                rotation: Rotation.Spawn,
                coordinate: { x: 4, y: 20 },
            });
        });

        test('the spawn position follows the rotation system setting', () => {
            const state = playingState(3);
            replayActions.openReplayInEditor()({
                ...state,
                mode: { ...state.mode, rotationSystem: 'classic' },
            } as State);

            const call = (main.appendPages as jest.Mock).mock.calls[0][0];
            expect(call.pages[0].piece.coordinate).toEqual({ x: 5, y: 21 });
        });

        test('opens the editor in the INPUT layout', () => {
            replayActions.openReplayInEditor()(playingState(3));

            expect(main.changeToDrawerScreen).toHaveBeenCalledWith({});
            expect(main.selectPieceLayout).toHaveBeenCalledWith({ layout: 'play' });
        });

        test('does nothing outside the playing phase', () => {
            const state = createState({
                ir: buildIR(3),
                phase: 'select',
                selection: { roundIndex: 0, selfPlayerId: 'player-a-id' },
            });
            expect(replayActions.openReplayInEditor()(state)).toBeUndefined();
            expect(main.appendPages).not.toHaveBeenCalled();
        });

        test('never asks to discard: editing the session does not change the flow', () => {
            const withEdits = {
                ...playingState(3),
                history: { undoCount: 5, redoCount: 0 },
            } as State;
            replayActions.openReplayInEditor()(withEdits);

            expect(main.appendPages).toHaveBeenCalledTimes(1);
        });

        // P2 レビュー対応: 設置数 0 のラウンドは terminal を切り出せること
        test('exports the terminal point when the self player has zero locks', () => {
            const state = playingState(0, 1);
            replayActions.openReplayInEditor()(state);

            expect(main.appendPages).toHaveBeenCalledTimes(1);
            const call = (main.appendPages as jest.Mock).mock.calls[0][0];
            expect(call.pages[0].comment.text).toEqual('#Q=[](S)Z');
        });

        // P2 §3-3: 開始地点（空盤面 ＋ 初期 NEXT 全件）も切り出せる
        test('exports the round start point with the whole opening queue', () => {
            replayActions.openReplayInEditor()(playingState(3, 0));

            const call = (main.appendPages as jest.Mock).mock.calls[0][0];
            expect(call.pages[0].comment.text).toEqual('#Q=[](T)JS');
        });
    });

    // ---- P2: フレーム共通軸 ----

    describe('frame axis (FR-24)', () => {
        test('stepping a piece writes the frame and pulls the opponent along', () => {
            // 自陣の手番 3 は frame 90。相手の設置は 45/75/105 なので手番 2 が対応する。
            const result = replayActions.stepReplayLock({ step: 1 })(playingState(3, 2))!;
            expect(result.replay!.cursor.selfIndex).toEqual(3);
            expect(result.replay!.cursor.frame).toEqual(90);
            expect(result.replay!.cursor.opponentIndex).toEqual(2);
        });

        test('seeking a frame recomputes both sides (FR-25)', () => {
            const state = playingState(3, 1);
            const result = replayActions.seekReplayFrame({ frame: 80 })(state)!;
            expect(result.replay!.cursor.frame).toEqual(80);
            // 自陣 60 <= 80 < 90 なので手番 2、相手 75 <= 80 < 105 なので手番 2
            expect(result.replay!.cursor.selfIndex).toEqual(2);
            expect(result.replay!.cursor.opponentIndex).toEqual(2);
        });

        test('seeking clamps to the round bounds', () => {
            const state = playingState(3, 1);
            expect(replayActions.seekReplayFrame({ frame: -50 })(state)!.replay!.cursor.frame)
                .toEqual(0);
            // endFrame は terminal の 150
            expect(replayActions.seekReplayFrame({ frame: 9999 })(state)!.replay!.cursor.frame)
                .toEqual(150);
        });

        test('seeking does not pause playback', () => {
            const state = playingState(3, 1, {}, { playback: { status: 'play' as any, speed: 1 } });
            const result = replayActions.seekReplayFrame({ frame: 80 })(state)!;
            expect(result.replay!.playback.status).toEqual('play');
        });

        // 同一 frame に複数の lock が並ぶとき、明示的に送った側の index は再計算しない
        test('an explicit step is not re-derived from a shared frame', () => {
            const ir = buildIR(3);
            const self = ir.rounds[0].players[0];
            self.locks[1].frame = self.locks[0].frame;   // 手番 1 と 2 が同一フレーム
            const state = createState({
                ir,
                phase: 'playing',
                selection: { roundIndex: 0, selfPlayerId: 'player-a-id' },
                cursor: {
                    frame: 30, selfIndex: 1, opponentIndex: 0, stepBasis: 'self', turnStop: false,
                },
            });

            const result = replayActions.stepReplayLock({ step: 1 })(state)!;
            // frame は変わらないが、送った手番は確実に 2 へ進む
            expect(result.replay!.cursor.frame).toEqual(30);
            expect(result.replay!.cursor.selfIndex).toEqual(2);
        });
    });

    // ---- 手番停止は「接地直前（設置済み・未確定）」 ----

    describe('turn stop at the pre-lock point', () => {
        // 設置セルを持つ IR。cells が無い IR は接地直前を復元できないので従来表示へ落ちる。
        const CELLS: [number, number][] = [[3, 0], [4, 0], [5, 0], [4, 1]];

        const withCells = (
            selfIndex: number = 1,
            cursorOverrides: Partial<State['replay']['cursor']> = {},
        ): State => {
            const ir = buildIR(3);
            for (const player of ir.rounds[0].players) {
                for (const lock of player.locks) {
                    lock.cells = CELLS.map(([x, y]) => [x, y] as [number, number]);
                }
            }
            return createState({
                ir,
                phase: 'playing',
                selection: { roundIndex: 0, selfPlayerId: 'player-a-id' },
                cursor: cursorFor(ir, selfIndex, cursorOverrides),
            });
        };

        test('stepping stops one frame before the lock and marks the turn stop', () => {
            const result = replayActions.stepReplayLock({ step: 1 })(withCells(1))!;
            expect(result.replay!.cursor.selfIndex).toEqual(2);
            // 手番 2 の lock は frame 60。停止はその 1 つ前
            expect(result.replay!.cursor.frame).toEqual(59);
            expect(result.replay!.cursor.turnStop).toBeTruthy();
        });

        test('the stopped board carries the placed but unconfirmed piece', () => {
            const stopped = applyResult(
                withCells(1), replayActions.stepReplayLock({ step: 1 })(withCells(1)));
            const visual = getReplaySelfVisual(stopped)!;

            expect(visual.frame).toEqual(59);
            expect(visual.active!.cells).toEqual(CELLS);
            expect(visual.active!.piece).toEqual(Piece.T);
            // カレントはこれから置くミノ。NEXT は lock 後に spawn したミノを先頭へ戻した並び
            expect(visual.current).toEqual(Piece.T);
            expect(visual.hold).toBeNull();
            expect(visual.next).toEqual([Piece.O, Piece.I]);
        });

        test('the statistics stay on the turn being played', () => {
            const stopped = applyResult(
                withCells(1), replayActions.stepReplayLock({ step: 1 })(withCells(1)));
            expect(getReplayStats(stopped)!.placed).toEqual(2);
        });

        test('seeking drops the turn stop and returns to the frame-based board', () => {
            const stopped = applyResult(
                withCells(1), replayActions.stepReplayLock({ step: 1 })(withCells(1)));
            const seeked = applyResult(
                stopped, replayActions.seekReplayFrame({ frame: 59 })(stopped));

            expect(seeked.replay.cursor.turnStop).toBeFalsy();
            expect(getReplaySelfVisual(seeked)!.active).toBeUndefined();
        });

        test('playback clears the turn stop', () => {
            const stopped = applyResult(
                withCells(1), replayActions.stepReplayLock({ step: 1 })(withCells(1)));
            jest.useFakeTimers();
            const played = applyResult(
                stopped, replayActions.toggleReplayPlayback()(stopped));
            jest.advanceTimersByTime(100);
            const ticked = replayActions.tickReplayClock()(played)!;
            jest.clearAllTimers();
            jest.useRealTimers();

            expect(ticked.replay!.cursor.turnStop).toBeFalsy();
        });

        test('only the step basis side shows the pre-lock board', () => {
            const state = withCells(1, { stepBasis: 'opponent' });
            const stopped = applyResult(state, replayActions.stepReplayLock({ step: 1 })(state));

            expect(getReplayOpponentVisual(stopped)!.active).toBeDefined();
            expect(getReplaySelfVisual(stopped)!.active).toBeUndefined();
        });

        test('a turn whose pre-lock board cannot be restored keeps the old landing', () => {
            const state = withCells(1);
            // 手番 1 と 2 が同一フレーム。この場合は設置直前の盤面が残っていない
            state.replay.ir!.rounds[0].players[0].locks[1].frame =
                state.replay.ir!.rounds[0].players[0].locks[0].frame;

            const result = replayActions.stepReplayLock({ step: 1 })(state)!;
            expect(result.replay!.cursor.frame).toEqual(30);
            const stopped = applyResult(state, result);
            expect(getReplaySelfVisual(stopped)!.active).toBeUndefined();
        });

        // 切り出す盤面は i-1 手ぶんの結果なので、INPUT の統計もそこへそろえる
        test('exporting a turn stop counts only the confirmed placements', () => {
            (main.appendPages as jest.Mock).mockClear();
            const stopped = applyResult(
                withCells(1), replayActions.stepReplayLock({ step: 1 })(withCells(1)));

            replayActions.openReplayInEditor()(stopped);
            const call = (main.appendPages as jest.Mock).mock.calls[0][0];
            expect(call.pages[0].comment.text).toEqual('#Q=[](T)OI');
            expect(call.pages[0].internal.inputReplayContext.stats.pieces).toEqual(1);
        });

        test('showReplayMove parks on the move with the self side as the basis', () => {
            const state = withCells(1, { stepBasis: 'opponent' });
            const result = replayActions.showReplayMove({ index: 3 })(state)!;

            expect(result.replay!.cursor.stepBasis).toEqual('self');
            expect(result.replay!.cursor.selfIndex).toEqual(3);
            // 手番 3 の lock は frame 90
            expect(result.replay!.cursor.frame).toEqual(89);
            expect(result.replay!.cursor.turnStop).toBeTruthy();
        });

        test('showReplayMove is inert outside the playing phase', () => {
            const state = createState({
                ir: buildIR(3),
                phase: 'select',
                selection: { roundIndex: 0, selfPlayerId: 'player-a-id' },
            });
            expect(replayActions.showReplayMove({ index: 2 })(state)).toBeUndefined();
        });
    });

    describe('swapping sides (FR-11/12)', () => {
        test('the frame is preserved and the two indices trade places', () => {
            const state = playingState(3, 3);
            const before = state.replay.cursor;
            const result = replayActions.swapReplaySides()(state)!;

            expect(result.replay!.selection.selfPlayerId).toEqual('player-b-id');
            expect(result.replay!.cursor.frame).toEqual(before.frame);
            expect(result.replay!.cursor.selfIndex).toEqual(before.opponentIndex);
            expect(result.replay!.cursor.opponentIndex).toEqual(before.selfIndex);
        });

        test('the swap is not remembered in localStorage (P2 §7-4)', () => {
            (persistViewSettings as jest.Mock).mockClear();
            replayActions.swapReplaySides()(playingState(3, 3));
            expect(persistViewSettings).not.toHaveBeenCalled();
        });

        test('the swapped board is what gets exported to the editor (FR-55 route)', () => {
            (main.appendPages as jest.Mock).mockClear();
            const state = playingState(3, 3);
            const swapped = applyResult(state, replayActions.swapReplaySides()(state));

            replayActions.openReplayInEditor()(swapped);
            expect(main.appendPages).toHaveBeenCalledTimes(1);
            // 相手側の initial の current は L（buildIR）。入れ替え後の自陣は相手なので
            // frame 90 時点の相手のポイントが切り出される。
            expect(getReplaySelfPoint(swapped)!.index).toEqual(state.replay.cursor.opponentIndex);
        });

        test('does nothing when there is no opponent', () => {
            const ir = buildIR(3);
            ir.rounds[0].players = [ir.rounds[0].players[0]];
            const state = createState({
                ir,
                phase: 'playing',
                selection: { roundIndex: 0, selfPlayerId: 'player-a-id' },
                cursor: cursorFor(buildIR(3), 1),
            });
            expect(replayActions.swapReplaySides()(state)).toBeUndefined();
        });
    });

    describe('step basis (FR-22)', () => {
        test('with the opponent as the basis the opponent index advances by one', () => {
            const state = playingState(3, 3, { stepBasis: 'opponent' });
            const before = state.replay.cursor.opponentIndex;
            const result = replayActions.stepReplayLock({ step: 1 })(state)!;

            expect(result.replay!.cursor.opponentIndex).toEqual(before + 1);
            // frame は相手の設置に合わせて動き、自陣 index は追従で決まる
            expect(result.replay!.cursor.frame)
                .toEqual(frameAt(state.replay.ir!.rounds[0].players[1], before + 1));
        });

        test('setReplayStepBasis is a no-op when the basis is unchanged', () => {
            expect(replayActions.setReplayStepBasis({ basis: 'self' })(playingState(3, 1)))
                .toBeUndefined();
        });
    });

    describe('playback clock (FR-23/27)', () => {
        beforeEach(() => {
            jest.useFakeTimers();
        });
        afterEach(() => {
            // 停止経路を通さないケースが interval を残すので、実タイマへ戻す前に捨てる
            jest.clearAllTimers();
            jest.useRealTimers();
        });

        const startedState = (state: State): State =>
            applyResult(state, replayActions.toggleReplayPlayback()(state));

        test('starting playback registers a clock and marks the state as playing', () => {
            const started = startedState(playingState(3, 1));
            expect(started.replay.playback.status).toEqual('play');
            expect(started.handlers.replayClock).toBeDefined();
        });

        test('a tick advances the frame by the elapsed real time', () => {
            const started = startedState(playingState(3, 1));
            jest.advanceTimersByTime(500);
            const result = replayActions.tickReplayClock()(started)!;
            // 0.5 秒 x 60fps x 1 倍 = 30 フレーム進む
            expect(result.replay!.cursor.frame).toBeCloseTo(60, 0);
        });

        test('the speed multiplier scales the advance', () => {
            const started = startedState(
                playingState(3, 1, {}, { playback: { status: 'pause' as any, speed: 2 } }));
            jest.advanceTimersByTime(500);
            const result = replayActions.tickReplayClock()(started)!;
            // 0.5 秒 x 60fps x 2 倍 = 60 フレーム進む
            expect(result.replay!.cursor.frame).toBeCloseTo(90, 0);
        });

        test('reaching the end pins the frame and pauses automatically', () => {
            const started = startedState(playingState(3, 1));
            jest.advanceTimersByTime(10000);
            const result = replayActions.tickReplayClock()(started)!;

            expect(result.replay!.cursor.frame).toEqual(150);
            expect(result.replay!.playback.status).toEqual('pause');
            expect(result.handlers!.replayClock).toBeUndefined();
        });

        test('pressing play at the end restarts from the beginning', () => {
            const atEnd = playingState(3, 4, { frame: 150 });
            const result = replayActions.toggleReplayPlayback()(atEnd)!;
            expect(result.replay!.cursor.frame).toEqual(0);
            expect(result.replay!.playback.status).toEqual('play');
        });

        test('pressing pause stops the clock', () => {
            const started = startedState(playingState(3, 1));
            const result = replayActions.toggleReplayPlayback()(started)!;
            expect(result.replay!.playback.status).toEqual('pause');
            expect(result.handlers!.replayClock).toBeUndefined();
        });

        // §3-5 の二重防御: 画面遷移の取りこぼしがあっても tick 自身が止まる
        test('a tick outside the playing phase stops the clock itself', () => {
            const started = startedState(playingState(3, 1));
            const left = { ...started, replay: { ...started.replay, phase: 'select' } } as State;

            const result = replayActions.tickReplayClock()(left)!;
            expect(result.handlers!.replayClock).toBeUndefined();
            expect(result.replay!.playback.status).toEqual('pause');
        });

        test('leaving for the select phase stops the clock', () => {
            const started = startedState(playingState(3, 1));
            const result = replayActions.backToReplaySelect()(started)!;
            expect(result.handlers!.replayClock).toBeUndefined();
            expect(result.replay!.playback.status).toEqual('pause');
        });

        test('resetting the import stops the clock', () => {
            const started = startedState(playingState(3, 1));
            const result = replayActions.resetReplayImport()(started)!;
            expect(result.handlers!.replayClock).toBeUndefined();
        });

        // 画面を離れる 2 経路は、handlers を上書きしないよう停止を入れ子のアクションで投げる
        test('handing the point to the editor dispatches the pause', () => {
            (main.pauseReplayPlayback as jest.Mock).mockClear();
            replayActions.openReplayInEditor()(startedState(playingState(3, 1)));
            expect(main.pauseReplayPlayback).toHaveBeenCalledTimes(1);
        });

        test('closing the screen dispatches the pause before leaving', () => {
            (main.pauseReplayPlayback as jest.Mock).mockClear();
            (main.changeToDrawerScreen as jest.Mock).mockClear();
            replayActions.closeReplayScreen()(startedState(playingState(3, 1)));
            expect(main.pauseReplayPlayback).toHaveBeenCalledTimes(1);
            expect(main.changeToDrawerScreen).toHaveBeenCalled();
        });

        test('pauseReplayPlayback itself clears the interval', () => {
            const started = startedState(playingState(3, 1));
            const result = replayActions.pauseReplayPlayback()(started)!;
            expect(result.handlers!.replayClock).toBeUndefined();
            expect(result.replay!.playback.status).toEqual('pause');
        });
    });

    describe('opponent visibility (FR-34)', () => {
        test('toggling saves through persistViewSettings', () => {
            (persistViewSettings as jest.Mock).mockClear();
            const state = playingState(3, 1);
            const result = replayActions.toggleReplayOpponent()(state)!;

            expect(result.replay!.view.showOpponent).toBeFalsy();
            expect(persistViewSettings).toHaveBeenCalledWith(state, { replayShowOpponent: false });
        });

        test('restoring from localStorage does not write back', () => {
            (persistViewSettings as jest.Mock).mockClear();
            const result = replayActions.setReplayShowOpponent(
                { showOpponent: false, persist: false })(playingState(3, 1))!;

            expect(result.replay!.view.showOpponent).toBeFalsy();
            expect(persistViewSettings).not.toHaveBeenCalled();
        });

        test('the setting survives a new import', () => {
            const hidden = playingState(3, 1, {}, { view: { showOpponent: false, showGarbage: true } });
            expect(replayActions.resetReplayImport()(hidden)!.replay!.view.showOpponent).toBeFalsy();
            expect(replayActions.setReplayIR(
                { ir: buildIR(3), fileName: 'a.ttrm', requestId: 0 },
            )(hidden)!.replay!.view.showOpponent).toBeFalsy();
        });
    });

    // ---- P3: ガベージ（FR-40 / 41 / 45 / 54） ----

    describe('garbage', () => {
        // player-a の locks は frame 30/60/90、terminal は 150。
        // frame 45 に 4 行受信し、frame 100 に列 7 で全量が盤面へ入る。
        const SELF_EVENTS: GarbageEvent[] = [
            { frame: 45, iid: 1, amount: 4, kind: 'receive' },
            { frame: 100, iid: 1, amount: 4, column: 7, size: 1, kind: 'tank' },
        ];

        const withGarbage = (
            selfIndex: number,
            events: { self?: GarbageEvent[], opponent?: GarbageEvent[] } = {},
            selfPlayerId: string = 'player-a-id',
        ): State => {
            const ir = buildIR(3);
            ir.rounds[0].players[0].garbageEvents = events.self ?? SELF_EVENTS;
            ir.rounds[0].players[1].garbageEvents = events.opponent ?? [];
            const players = selfPlayerId === 'player-a-id'
                ? ir.rounds[0].players
                : [ir.rounds[0].players[1], ir.rounds[0].players[0]];
            const frame = frameAt(players[0], selfIndex);
            return createState({
                ir,
                phase: 'playing',
                selection: { selfPlayerId, roundIndex: 0 },
                cursor: {
                    frame,
                    selfIndex: clampPointIndex(players[0], selfIndex),
                    opponentIndex: indexAtFrame(players[1], frame),
                    stepBasis: 'self',
                    turnStop: false,
                },
            });
        };

        // FR-40: ゲージ量はカーソルのフレームで決まる（lock 単位のスナップショットではない）
        test('the gauge follows the cursor frame', () => {
            expect(getReplaySelfGarbage(withGarbage(1))!.gauge).toEqual(0);
            expect(getReplaySelfGarbage(withGarbage(2))!.gauge).toEqual(4);
            expect(getReplaySelfGarbage(withGarbage(3))!.gauge).toEqual(4);
            // terminal（frame 150）では tank 済みなので 0 に戻る
            expect(getReplaySelfGarbage(withGarbage(4))!.gauge).toEqual(0);
        });

        // FR-42/43: 予告は実測の tank をそのまま読む。ゲージ 0 の地点では出さない。
        test('the rise forecast is the tank that actually followed', () => {
            expect(getReplaySelfGarbage(withGarbage(1))!.rise).toBeUndefined();
            const view = getReplaySelfGarbage(withGarbage(2))!;
            expect(view.rise!.column).toEqual(7);
            expect(view.moreRows).toEqual(3);
        });

        test('the opponent gauge is read at the same instant', () => {
            const state = withGarbage(2, {
                self: SELF_EVENTS,
                opponent: [{ frame: 40, iid: 9, amount: 2, kind: 'receive' }],
            });
            expect(getReplayOpponentGarbage(state)!.gauge).toEqual(2);
        });

        test('the garbage selectors are undefined outside the playing phase', () => {
            const state = createState({
                ir: buildIR(3),
                phase: 'select',
                selection: { roundIndex: 0, selfPlayerId: 'player-a-id' },
            });
            expect(getReplaySelfGarbage(state)).toBeUndefined();
            expect(getReplayOpponentGarbage(state)).toBeUndefined();
            expect(getReplayKiller(state)).toBeUndefined();
        });

        // FR-45: 死因は自陣の終端地点でのみ返る
        test('the cause of loss only shows at the terminal point of a losing side', () => {
            // player-b は garbagesmash 側。locks は 45/75/105、terminal は 150
            const killerEvents: GarbageEvent[] = [
                { frame: 100, iid: 5, gameid: 3, senderFrame: 80, amount: 0, kind: 'confirm' },
                { frame: 100, iid: 5, amount: 4, kind: 'receive' },
                { frame: 120, iid: 5, amount: 4, column: 3, size: 1, kind: 'tank' },
            ];
            expect(getReplayKiller(withGarbage(2, { opponent: killerEvents }, 'player-b-id')))
                .toBeUndefined();

            const killer = getReplayKiller(
                withGarbage(4, { opponent: killerEvents }, 'player-b-id'))!;
            expect(killer.amount).toEqual(4);
            expect(killer.column).toEqual(3);
            expect(killer.senderFrame).toEqual(80);
        });

        test('the winning side never reports a cause of loss', () => {
            expect(getReplayKiller(withGarbage(4))).toBeUndefined();
        });

        // FR-54: ゲージがある地点でだけ、せり上がり行を切り出しに載せる
        describe('carrying the gauge into the editor (FR-54)', () => {
            const sentLineOf = (call: any) => call.pages[0].field.obj.toSentLintPieces();

            beforeEach(() => {
                (main.appendPages as jest.Mock).mockClear();
            });

            test('a point with no gauge exports exactly what P1 / P2 exported', () => {
                replayActions.openReplayInEditor()(withGarbage(1));
                const call = (main.appendPages as jest.Mock).mock.calls[0][0];
                expect(call.pages[0].flags.rise).toBeFalsy();
                expect(sentLineOf(call).every((cell: Piece) => cell === Piece.Empty)).toBeTruthy();
            });

            test('a point with a gauge exports the next rise as the sent line', () => {
                replayActions.openReplayInEditor()(withGarbage(2));
                const call = (main.appendPages as jest.Mock).mock.calls[0][0];
                expect(call.pages[0].flags.rise).toBeTruthy();
                const sentLine = sentLineOf(call);
                expect(sentLine[7]).toEqual(Piece.Empty);
                expect(sentLine.filter((cell: Piece) => cell === Piece.Gray)).toHaveLength(9);
            });

            // FR-11 × FR-54: 入れ替え後は「新しい自陣」のゲージが載る
            test('after swapping sides the new self side supplies the gauge', () => {
                const state = withGarbage(2, {
                    self: [],
                    opponent: [
                        { frame: 40, iid: 9, amount: 2, kind: 'receive' },
                        { frame: 200, iid: 9, amount: 2, column: 1, size: 1, kind: 'tank' },
                    ],
                });
                // 入れ替え前の自陣はガベージ無しなので、せり上がり行は空
                expect(getReplaySelfGarbage(state)!.gauge).toEqual(0);

                const swapped = applyResult(state, replayActions.swapReplaySides()(state));
                expect(getReplaySelfGarbage(swapped)!.gauge).toEqual(2);

                replayActions.openReplayInEditor()(swapped);
                const call = (main.appendPages as jest.Mock).mock.calls[0][0];
                expect(call.pages[0].flags.rise).toBeTruthy();
                expect(sentLineOf(call)[1]).toEqual(Piece.Empty);
            });

            // §7-4: 表示の好みと成果物の内容は別の関心事
            test('hiding the garbage display does not change what gets exported', () => {
                const hidden = {
                    ...withGarbage(2),
                    replay: {
                        ...withGarbage(2).replay,
                        view: { showOpponent: true, showGarbage: false },
                    },
                } as State;
                replayActions.openReplayInEditor()(hidden);
                const call = (main.appendPages as jest.Mock).mock.calls[0][0];
                expect(call.pages[0].flags.rise).toBeTruthy();
            });
        });
    });

    describe('garbage visibility (NFR-08)', () => {
        test('toggling saves through persistViewSettings', () => {
            (persistViewSettings as jest.Mock).mockClear();
            const state = playingState(3, 1);
            const result = replayActions.toggleReplayGarbage()(state)!;

            expect(result.replay!.view.showGarbage).toBeFalsy();
            expect(persistViewSettings).toHaveBeenCalledWith(state, { replayShowGarbage: false });
        });

        test('restoring from localStorage does not write back', () => {
            (persistViewSettings as jest.Mock).mockClear();
            const result = replayActions.setReplayShowGarbage(
                { showGarbage: false, persist: false })(playingState(3, 1))!;

            expect(result.replay!.view.showGarbage).toBeFalsy();
            expect(persistViewSettings).not.toHaveBeenCalled();
        });

        // P2 §8 で踏んだ initialReplayState の全体置換と同じ罠
        test('the setting survives a new import and a reset', () => {
            const hidden = playingState(3, 1, {}, {
                view: { showOpponent: true, showGarbage: false },
            });
            expect(replayActions.resetReplayImport()(hidden)!.replay!.view.showGarbage).toBeFalsy();
            expect(replayActions.setReplayIR(
                { ir: buildIR(3), fileName: 'a.ttrm', requestId: 0 },
            )(hidden)!.replay!.view.showGarbage).toBeFalsy();
        });
    });

    describe('selectors', () => {
        test('visual selectors use the common floored frame for both sides', () => {
            const state = playingState(3, 0, { frame: 29.9 });
            const self = getReplaySelfVisual(state)!;
            const opponent = getReplayOpponentVisual(state)!;

            expect(self.frame).toEqual(29);
            expect(opponent.frame).toEqual(29);
            // visualの無い既存・手作りIRは直前の確定pointへfallbackする。
            expect(self.current).toEqual(Piece.T);
            expect(opponent.current).toEqual(Piece.L);
        });

        test('the opponent point is read at the same instant as the self point', () => {
            const state = playingState(3, 3);
            expect(getReplaySelfPoint(state)!.frame).toEqual(90);
            // 相手の設置は 45/75/105 なので、frame 90 では手番 2 が最後の確定地点
            expect(getReplayOpponentPoint(state)!.index).toEqual(2);
            expect(getReplayOpponentPoint(state)!.frame).toEqual(75);
        });

        test('the stats follow the self cursor (FR-26)', () => {
            const stats = getReplayStats(playingState(3, 2))!;
            expect(stats.placed).toEqual(2);
            expect(stats.totalLocks).toEqual(3);
            expect(stats.frame).toEqual(60);
        });

        test('the selectors are undefined outside the playing phase', () => {
            const state = createState({
                ir: buildIR(3),
                phase: 'select',
                selection: { roundIndex: 0, selfPlayerId: 'player-a-id' },
            });
            expect(getReplaySelfPoint(state)).toBeUndefined();
            expect(getReplayOpponentPoint(state)).toBeUndefined();
            expect(getReplaySelfVisual(state)).toBeUndefined();
            expect(getReplayOpponentVisual(state)).toBeUndefined();
            expect(getReplayStats(state)).toBeUndefined();
        });
    });
});

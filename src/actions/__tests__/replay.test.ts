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
    },
}));
jest.mock('../view_settings', () => ({
    loadPersistedReplaySelfPlayer: jest.fn(() => null),
    persistViewSettings: jest.fn(),
}));
jest.mock('../../states', () => ({
    initialReplayState: {
        phase: 'empty',
        fileName: undefined,
        ir: undefined,
        requestId: 0,
        selection: { roundIndex: 0, selfPlayerId: null },
        cursor: { lockIndex: 0, atTerminal: false },
        error: undefined,
    },
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

import { getCurrentReplayQueue, replayActions } from '../replay';
import { main } from '../../actions';
import { initialReplayState, State } from '../../states';
import { FieldConstants, Piece, Rotation } from '../../lib/enums';
import { IRField, LockPoint, ReplayIR } from '../../lib/ttrm/types';
import { loadPersistedReplaySelfPlayer, persistViewSettings } from '../view_settings';

// tslint:disable-next-line:no-var-requires
const { __mockWorker } = require('../../lib/ttrm/ReplayWorkerWrapper');

const flushPromises = () => new Promise(resolve => setTimeout(resolve, 0));

const emptyField = (): IRField =>
    Array.from({ length: FieldConstants.PlayBlocks }).map(() => Piece.Empty);

const lockAt = (pieceIndex: number): LockPoint => ({
    pieceIndex,
    frame: pieceIndex * 30,
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
    pendingHoles: 0,
    sourceHeight: 1,
    clippedRowCount: 0,
});

const buildIR = (lockCount: number, roundStatus: 'ok' | 'failed' = 'ok'): ReplayIR => {
    const players = ['player-a-id', 'player-b-id'].map(id => ({
        id,
        username: id.replace('-id', ''),
        resolvedOptions: {},
        optionWarnings: [],
        locks: Array.from({ length: lockCount }).map((ignore, i) => lockAt(i)),
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
    modal: {},
    mode: { screen: 'Editor' },
    fumen: { currentIndex: 2, guideLineColor: true },
} as unknown as State);

const playingState = (lockCount: number, cursor?: State['replay']['cursor']): State =>
    createState({
        ir: buildIR(lockCount),
        phase: 'playing',
        selection: { roundIndex: 0, selfPlayerId: 'player-a-id' },
        cursor: cursor ?? { lockIndex: 0, atTerminal: false },
    });

describe('replayActions', () => {
    describe('phase transitions', () => {
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

        test('startReplayPlayback enters playing with the cursor reset', () => {
            const state = createState({
                ir: buildIR(3),
                phase: 'select',
                selection: { roundIndex: 0, selfPlayerId: 'player-a-id' },
            });
            const result = replayActions.startReplayPlayback()(state)!;
            expect(result.replay!.phase).toEqual('playing');
            expect(result.replay!.cursor).toEqual({ lockIndex: 0, atTerminal: false });
        });

        test('backToReplaySelect returns to select phase', () => {
            const result = replayActions.backToReplaySelect()(playingState(3))!;
            expect(result.replay!.phase).toEqual('select');
        });

        // P2 レビュー対応: piecesplaced: 0（自己突合済み）のラウンドは locks が空で
        // lockIndex:0 の盤面が存在しないため、terminal から開始しないと描画が失敗する。
        test('startReplayPlayback starts at terminal when the self player has zero locks', () => {
            const state = createState({
                ir: buildIR(0),
                phase: 'select',
                selection: { roundIndex: 0, selfPlayerId: 'player-a-id' },
            });
            const result = replayActions.startReplayPlayback()(state)!;
            expect(result.replay!.phase).toEqual('playing');
            expect(result.replay!.cursor).toEqual({ lockIndex: 0, atTerminal: true });
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
        test('does not step back from the first lock', () => {
            expect(replayActions.stepReplayLock({ step: -1 })(playingState(3))).toBeUndefined();
        });

        test('stepping forward from the last lock reaches the terminal', () => {
            const state = playingState(3, { lockIndex: 2, atTerminal: false });
            const result = replayActions.stepReplayLock({ step: 1 })(state)!;
            expect(result.replay!.cursor).toEqual({ lockIndex: 2, atTerminal: true });
        });

        test('does not step forward past the terminal', () => {
            const state = playingState(3, { lockIndex: 2, atTerminal: true });
            expect(replayActions.stepReplayLock({ step: 1 })(state)).toBeUndefined();
        });

        test('stepping back from the terminal returns to the last lock', () => {
            const state = playingState(3, { lockIndex: 2, atTerminal: true });
            const result = replayActions.stepReplayLock({ step: -1 })(state)!;
            expect(result.replay!.cursor).toEqual({ lockIndex: 2, atTerminal: false });
        });

        test('replayFirstLock and replayLastLock jump to the boundaries', () => {
            const state = playingState(5, { lockIndex: 3, atTerminal: false });
            expect(replayActions.replayFirstLock()(state)!.replay!.cursor)
                .toEqual({ lockIndex: 0, atTerminal: false });
            expect(replayActions.replayLastLock()(state)!.replay!.cursor)
                .toEqual({ lockIndex: 4, atTerminal: true });
        });

        describe('zero-lock rounds (P2)', () => {
            const zeroLockState = () => playingState(0, { lockIndex: 0, atTerminal: true });

            test('does not step back from terminal when there is no lock to return to', () => {
                expect(replayActions.stepReplayLock({ step: -1 })(zeroLockState())).toBeUndefined();
            });

            test('does not step forward past terminal', () => {
                expect(replayActions.stepReplayLock({ step: 1 })(zeroLockState())).toBeUndefined();
            });

            test('replayFirstLock is a no-op', () => {
                expect(replayActions.replayFirstLock()(zeroLockState())).toBeUndefined();
            });

            test('replayLastLock stays at terminal with lockIndex clamped to 0', () => {
                const result = replayActions.replayLastLock()(zeroLockState())!;
                expect(result.replay!.cursor).toEqual({ lockIndex: 0, atTerminal: true });
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
            const state = playingState(3, { lockIndex: 2, atTerminal: true });
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
            const state = playingState(0, { lockIndex: 0, atTerminal: true });
            replayActions.openReplayInEditor()(state);

            expect(main.appendPages).toHaveBeenCalledTimes(1);
            const call = (main.appendPages as jest.Mock).mock.calls[0][0];
            expect(call.pages[0].comment.text).toEqual('#Q=[](S)Z');
        });
    });
});

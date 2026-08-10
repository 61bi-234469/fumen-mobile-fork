/**
 * @jest-environment jsdom
 */

jest.mock('../../actions', () => ({
    main: {
        onReplayAnalysisResult: jest.fn(),
        onReplayAnalysisNoMove: jest.fn(),
        onReplayAnalysisError: jest.fn(),
    },
}));
jest.mock('../view_settings', () => ({
    loadPersistedReplaySelfPlayer: jest.fn(() => null),
    persistViewSettings: jest.fn(),
}));
// states.ts は env.ts のビルド時置換に依存するため、Jest では読み込めない
jest.mock('../../states', () => ({
    initialReplayAnalysisState: {
        key: null,
        status: 'idle',
        runId: 0,
        thinkMs: 100,
        progress: { current: 0, total: 0 },
        moves: [],
        error: undefined,
    },
    initialReplayState: {},
}));
jest.mock('../../lib/ttrm/ReplayWorkerWrapper', () => ({
    ReplayWorkerWrapper: class {
        start = jest.fn();
        terminate = jest.fn();
    },
}));
jest.mock('../../lib/cold_clear/ColdClearWrapper', () => {
    const open = jest.fn();
    const analyzePosition = jest.fn();
    const terminate = jest.fn();
    return {
        ColdClearWrapper: class {
            open = open;
            analyzePosition = analyzePosition;
            terminate = terminate;
        },
        __mockWrapper: { open, analyzePosition, terminate },
    };
});

import {
    analysisKeyOf,
    canStartReplayAnalysis,
    getReplayAnalysis,
    replayAnalysisActions,
    resetReplayAnalysisForTesting,
} from '../replay_analysis';
import { initialReplayAnalysisState, ReplayAnalysisState, State } from '../../states';
import { buildReplayIR } from '../../lib/ttrm/simulator';
import { ReplayIR, TtrmFile } from '../../lib/ttrm/types';
import { CCAnalysisResult } from '../../lib/cold_clear/types';
import { persistViewSettings } from '../view_settings';

// tslint:disable-next-line:no-var-requires
const { __mockWrapper } = require('../../lib/cold_clear/ColdClearWrapper');
const leagueLoss = require('../../lib/ttrm/__tests__/fixtures/league_loss.json') as TtrmFile;

const ir: ReplayIR = buildReplayIR(leagueLoss);
const SELF_ID = 'player-a-id';

const stateWith = (analysis: ReplayAnalysisState, overrides: any = {}): State => ({
    replay: {
        ir,
        analysis,
        phase: 'playing',
        fileName: 'league_loss.ttrm',
        requestId: 1,
        selection: { roundIndex: 0, selfPlayerId: SELF_ID },
        cursor: { frame: 0, selfIndex: 0, opponentIndex: 0, stepBasis: 'self' },
        playback: { status: 'pause', speed: 1 },
        view: { showOpponent: true, showGarbage: true },
        error: undefined,
        ...(overrides.replay ?? {}),
    },
    coldClear: {
        isRunning: false,
        holdAllowed: true,
        speculate: true,
        weightsPreset: 0,
        ...(overrides.coldClear ?? {}),
    },
} as any as State);

const idleState = (overrides: any = {}) => stateWith(initialReplayAnalysisState, overrides);

const workerCallback = (): ((msg: any) => void) =>
    __mockWrapper.open.mock.calls[__mockWrapper.open.mock.calls.length - 1][0];

const analysisOf = (next: any): ReplayAnalysisState => next.replay.analysis;

const resultFor = (index: number, best: number, played: number | null, rank: number | null): CCAnalysisResult => ({
    index,
    rank,
    bestScore: best,
    playedScore: played,
    type: 'analysisResult',
    candidateCount: 40,
});

describe('replayAnalysisActions', () => {
    beforeEach(() => {
        resetReplayAnalysisForTesting();
        __mockWrapper.open.mockClear();
        __mockWrapper.analyzePosition.mockClear();
        __mockWrapper.terminate.mockClear();
        (persistViewSettings as jest.Mock).mockClear();
    });

    test('開始すると全手が pending で並び、最初の局面だけ Worker へ渡る', () => {
        const state = idleState();
        const next = replayAnalysisActions.startReplayAnalysis()(state) as any;
        const analysis = analysisOf(next);

        expect(analysis.status).toEqual('running');
        expect(analysis.key).toEqual(analysisKeyOf(state));
        expect(analysis.progress.total).toEqual(analysis.moves.length);
        expect(analysis.moves.length).toBeGreaterThan(0);
        expect(analysis.moves[0].index).toEqual(1);
        // 逐次実行。応答を受けるまで次は投げない
        expect(__mockWrapper.analyzePosition).toHaveBeenCalledTimes(1);
        expect(__mockWrapper.open).toHaveBeenCalledTimes(1);
    });

    test('結果が届くと損失と順位が入り、次の局面が投げられる', () => {
        let state = idleState();
        state = { ...state, replay: { ...state.replay, analysis: analysisOf(
            replayAnalysisActions.startReplayAnalysis()(state) as any) } } as State;

        const first = __mockWrapper.analyzePosition.mock.calls[0][0];
        const next = replayAnalysisActions.onReplayAnalysisResult({
            runId: state.replay.analysis.runId,
            result: resultFor(first.index, 500, 380, 4),
        })(state) as any;
        const move = analysisOf(next).moves[first.index - 1];

        expect(move.status).toEqual('ok');
        expect(move.bestScore).toEqual(500);
        expect(move.playedScore).toEqual(380);
        expect(move.loss).toEqual(120);
        expect(move.rank).toEqual(4);
        expect(analysisOf(next).progress.current).toBeGreaterThan(0);
        expect(__mockWrapper.analyzePosition).toHaveBeenCalledTimes(2);
    });

    test('実手が候補に無ければ圏外として記録し、損失は出さない', () => {
        let state = idleState();
        state = { ...state, replay: { ...state.replay, analysis: analysisOf(
            replayAnalysisActions.startReplayAnalysis()(state) as any) } } as State;

        const first = __mockWrapper.analyzePosition.mock.calls[0][0];
        const next = replayAnalysisActions.onReplayAnalysisResult({
            runId: state.replay.analysis.runId,
            result: resultFor(first.index, 500, null, null),
        })(state) as any;
        const move = analysisOf(next).moves[first.index - 1];

        expect(move.status).toEqual('unmatched');
        expect(move.loss).toBeUndefined();
        expect(move.bestScore).toEqual(500);
    });

    test('中止すると Worker を止め、そこまでの結果を残す', () => {
        let state = idleState();
        state = { ...state, replay: { ...state.replay, analysis: analysisOf(
            replayAnalysisActions.startReplayAnalysis()(state) as any) } } as State;
        const first = __mockWrapper.analyzePosition.mock.calls[0][0];
        state = { ...state, replay: { ...state.replay, analysis: analysisOf(
            replayAnalysisActions.onReplayAnalysisResult({
                runId: state.replay.analysis.runId,
                result: resultFor(first.index, 500, 500, 1),
            })(state) as any) } } as State;

        const posted = __mockWrapper.analyzePosition.mock.calls.length;
        const next = replayAnalysisActions.abortReplayAnalysis()(state) as any;
        const analysis = analysisOf(next);

        expect(analysis.status).toEqual('aborted');
        expect(analysis.moves[first.index - 1].status).toEqual('ok');
        expect(__mockWrapper.terminate).toHaveBeenCalled();
        // 中止後は新しい局面を投げない
        expect(__mockWrapper.analyzePosition).toHaveBeenCalledTimes(posted);
    });

    test('中止後に遅れて届いた結果は捨てる', () => {
        let state = idleState();
        state = { ...state, replay: { ...state.replay, analysis: analysisOf(
            replayAnalysisActions.startReplayAnalysis()(state) as any) } } as State;
        const first = __mockWrapper.analyzePosition.mock.calls[0][0];
        state = { ...state, replay: { ...state.replay, analysis: analysisOf(
            replayAnalysisActions.abortReplayAnalysis()(state) as any) } } as State;

        const next = replayAnalysisActions.onReplayAnalysisResult({
            runId: state.replay.analysis.runId,
            result: resultFor(first.index, 500, 100, 9),
        })(state);
        expect(next).toBeUndefined();
    });

    test('Worker エラーで失敗状態になり、その局面は failed になる', () => {
        let state = idleState();
        state = { ...state, replay: { ...state.replay, analysis: analysisOf(
            replayAnalysisActions.startReplayAnalysis()(state) as any) } } as State;
        const first = __mockWrapper.analyzePosition.mock.calls[0][0];

        const next = replayAnalysisActions.onReplayAnalysisError({
            runId: state.replay.analysis.runId,
            message: 'boom',
        })(state) as any;

        expect(analysisOf(next).status).toEqual('failed');
        expect(analysisOf(next).error).toEqual('boom');
        expect(analysisOf(next).moves[first.index - 1].status).toEqual('failed');
        expect(__mockWrapper.terminate).toHaveBeenCalled();
    });

    test('候補が 1 件も無い局面は欠測として次へ進む', () => {
        let state = idleState();
        state = { ...state, replay: { ...state.replay, analysis: analysisOf(
            replayAnalysisActions.startReplayAnalysis()(state) as any) } } as State;
        const first = __mockWrapper.analyzePosition.mock.calls[0][0];

        const next = replayAnalysisActions.onReplayAnalysisNoMove({
            runId: state.replay.analysis.runId,
        })(state) as any;

        expect(analysisOf(next).moves[first.index - 1].status).toEqual('skipped');
        expect(__mockWrapper.analyzePosition).toHaveBeenCalledTimes(2);
    });

    test('Worker のメッセージは runId つきでアクションへ橋渡しされる', () => {
        // tslint:disable-next-line:no-var-requires
        const { main } = require('../../actions');
        const state = idleState();
        const next = replayAnalysisActions.startReplayAnalysis()(state) as any;
        const runId = analysisOf(next).runId;

        const callback = workerCallback();
        callback({ type: 'analysisResult', index: 1, bestScore: 1, playedScore: 1, rank: 1, candidateCount: 1 });
        callback({ type: 'noMove' });
        callback({ type: 'error', message: 'ng' });

        expect(main.onReplayAnalysisResult).toHaveBeenCalledWith(
            expect.objectContaining({ runId }));
        expect(main.onReplayAnalysisNoMove).toHaveBeenCalledWith({ runId });
        expect(main.onReplayAnalysisError).toHaveBeenCalledWith({ runId, message: 'ng' });
    });

    test('Editor 側の探索が走っている間は開始できない', () => {
        const state = idleState({ coldClear: { isRunning: true } });
        expect(canStartReplayAnalysis(state)).toBe(false);
        expect(replayAnalysisActions.startReplayAnalysis()(state)).toBeUndefined();
        expect(__mockWrapper.open).not.toHaveBeenCalled();
    });

    test('再生フェーズ以外では開始できない', () => {
        const state = idleState({ replay: { phase: 'select' } });
        expect(canStartReplayAnalysis(state)).toBe(false);
    });

    test('ラウンドや自陣が変わった結果は表示しない', () => {
        let state = idleState();
        state = { ...state, replay: { ...state.replay, analysis: analysisOf(
            replayAnalysisActions.startReplayAnalysis()(state) as any) } } as State;
        expect(getReplayAnalysis(state)).toBeDefined();

        const swapped = {
            ...state,
            replay: {
                ...state.replay,
                selection: { ...state.replay.selection, selfPlayerId: 'player-b-id' },
            },
        } as State;
        expect(getReplayAnalysis(swapped)).toBeUndefined();
    });

    test('思考時間を変えると結果を捨てて設定を保存する', () => {
        let state = idleState();
        state = { ...state, replay: { ...state.replay, analysis: analysisOf(
            replayAnalysisActions.startReplayAnalysis()(state) as any) } } as State;

        const next = replayAnalysisActions.setReplayAnalysisThinkMs({ thinkMs: 500 })(state) as any;
        expect(analysisOf(next).thinkMs).toEqual(500);
        expect(analysisOf(next).moves).toEqual([]);
        expect(analysisOf(next).key).toBeNull();
        expect(__mockWrapper.terminate).toHaveBeenCalled();
        expect(persistViewSettings).toHaveBeenCalledWith(state, { replayAnalysisThinkMs: 500 });
    });

    test('プリセット外の思考時間は既定へ丸める', () => {
        const state = idleState();
        const next = replayAnalysisActions.setReplayAnalysisThinkMs({ thinkMs: 12345 })(state);
        // 既定値と同じなら状態は変えない
        expect(next).toBeUndefined();
    });

    test('resetReplayAnalysis は実行中でも結果を捨てる', () => {
        let state = idleState();
        state = { ...state, replay: { ...state.replay, analysis: analysisOf(
            replayAnalysisActions.startReplayAnalysis()(state) as any) } } as State;

        const next = replayAnalysisActions.resetReplayAnalysis()(state) as any;
        expect(analysisOf(next).status).toEqual('idle');
        expect(analysisOf(next).moves).toEqual([]);
        expect(__mockWrapper.terminate).toHaveBeenCalled();
    });
});

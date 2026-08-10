import { NextState } from './commons';
import { action, main } from '../actions';
import {
    ReplayAnalysisState,
    ReplayMoveEval,
    State,
    initialReplayAnalysisState,
} from '../states';
import { ColdClearWrapper } from '../lib/cold_clear/ColdClearWrapper';
import { CCAnalysisResult, WorkerResponse } from '../lib/cold_clear/types';
import {
    AnalysisSettings,
    ANALYSIS_NEXT_COUNT,
    analysisMoveCount,
    buildAnalysisPosition,
    lossOf,
    normalizeAnalysisThinkMs,
} from '../lib/cold_clear/replay_analysis';
import { PlayerRoundIR } from '../lib/ttrm/types';
import { getSelfPlayerRound } from './replay';
import { persistViewSettings } from './view_settings';

// リプレイ 1 ラウンドを Cold Clear で通し解析する。1 局面ずつ Worker へ投げ、
// 応答を受けてから次を投げる（中断は「次を投げない」だけで成立する）。
// 結果は state.replay.analysis にのみ置き、fumen / コメント / localStorage へは書かない。

interface AnalysisSession {
    runId: number;
    key: string;
    player: PlayerRoundIR;
    settings: AnalysisSettings;
    wrapper: ColdClearWrapper;
    moves: ReplayMoveEval[];
    total: number;
    // 次に処理する手番（1..total）
    nextIndex: number;
    // Worker へ投げて応答待ちの手番。noMove / error の紐付けに使う
    pendingIndex: number | null;
    aborted: boolean;
}

let currentSession: AnalysisSession | null = null;
let nextRunId = 1;

const settingsOf = (state: State): AnalysisSettings => ({
    thinkMs: normalizeAnalysisThinkMs(state.replay.analysis.thinkMs),
    holdAllowed: state.coldClear.holdAllowed,
    speculate: state.coldClear.speculate,
    weightsPreset: state.coldClear.weightsPreset,
});

// 解析結果の有効範囲。ここが変わったら結果は捨てる。
export const analysisKeyOf = (state: State): string | null => {
    const player = getSelfPlayerRound(state);
    if (player === undefined) {
        return null;
    }
    const settings = settingsOf(state);
    return [
        state.replay.requestId,
        state.replay.selection.roundIndex,
        player.id,
        settings.thinkMs,
        settings.holdAllowed ? 1 : 0,
        settings.speculate ? 1 : 0,
        settings.weightsPreset,
        ANALYSIS_NEXT_COUNT,
    ].join(':');
};

export const canStartReplayAnalysis = (state: State): boolean => {
    if (state.replay.phase !== 'playing' || state.coldClear.isRunning) {
        return false;
    }
    if (state.replay.analysis.status === 'running') {
        return false;
    }
    const player = getSelfPlayerRound(state);
    return player !== undefined && analysisMoveCount(player) > 0;
};

// 現在のキーで有効な結果だけを返す。ラウンド・自陣・設定を変えた直後は null。
export const getReplayAnalysis = (state: State): ReplayAnalysisState | undefined => {
    const analysis = state.replay.analysis;
    if (analysis.key === null || analysis.key !== analysisKeyOf(state)) {
        return undefined;
    }
    return analysis;
};

const terminateSession = () => {
    if (currentSession !== null) {
        currentSession.wrapper.terminate();
        currentSession = null;
    }
};

// 画面遷移・ラウンド変更などから呼ぶ停止契機（アクションではない）。
export const stopReplayAnalysisSession = () => {
    terminateSession();
};

export const clearedReplayAnalysisState = (state: State): ReplayAnalysisState => ({
    ...initialReplayAnalysisState,
    thinkMs: state.replay.analysis.thinkMs,
});

// 画面を離れるときなど、結果は残して実行だけ止めたい場合の状態。
export const haltedReplayAnalysisState = (state: State): ReplayAnalysisState => (
    state.replay.analysis.status === 'running'
        ? { ...state.replay.analysis, status: 'aborted' }
        : state.replay.analysis
);

const pendingMoves = (player: PlayerRoundIR): ReplayMoveEval[] => {
    const moves: ReplayMoveEval[] = [];
    for (let index = 1; index <= analysisMoveCount(player); index += 1) {
        moves.push({ index, status: 'pending', frame: player.locks[index - 1].frame });
    }
    return moves;
};

// 次に解析できる局面まで進める。除外条件に当たった手はその場で skipped にする。
// Worker へ投げたら true、全手処理し終えたら false。
const postNextPosition = (session: AnalysisSession): boolean => {
    while (session.nextIndex <= session.total) {
        const index = session.nextIndex;
        const position = buildAnalysisPosition(session.player, index, session.settings);
        if (position.request === undefined) {
            session.moves[index - 1] = { index, status: 'skipped', frame: position.frame };
            session.nextIndex += 1;
            continue;
        }
        session.pendingIndex = index;
        session.nextIndex += 1;
        session.wrapper.analyzePosition(position.request);
        return true;
    }
    session.pendingIndex = null;
    return false;
};

const processedCount = (session: AnalysisSession): number =>
    session.moves.filter(move => move.status !== 'pending').length;

const runningState = (state: State, session: AnalysisSession): ReplayAnalysisState => ({
    ...state.replay.analysis,
    key: session.key,
    runId: session.runId,
    status: 'running',
    moves: session.moves.slice(),
    progress: { current: processedCount(session), total: session.total },
    error: undefined,
});

const finishedState = (
    state: State, session: AnalysisSession, status: ReplayAnalysisState['status'], error?: string,
): ReplayAnalysisState => ({
    ...state.replay.analysis,
    status,
    error,
    key: session.key,
    runId: session.runId,
    moves: session.moves.slice(),
    progress: { current: processedCount(session), total: session.total },
});

const handleWorkerMessage = (runId: number, msg: WorkerResponse) => {
    switch (msg.type) {
    case 'analysisResult':
        main.onReplayAnalysisResult({ runId, result: msg });
        break;
    case 'noMove':
        // 候補が 1 件も出ない局面（詰み・入力異常）。エラーにはせず欠測として進める。
        main.onReplayAnalysisNoMove({ runId });
        break;
    case 'error':
        main.onReplayAnalysisError({ runId, message: msg.message });
        break;
    default:
        break;
    }
};

export interface ReplayAnalysisActions {
    startReplayAnalysis: () => action;
    abortReplayAnalysis: () => action;
    resetReplayAnalysis: () => action;
    setReplayAnalysisThinkMs: (data: { thinkMs: number }) => action;
    onReplayAnalysisResult: (data: { runId: number, result: CCAnalysisResult }) => action;
    onReplayAnalysisNoMove: (data: { runId: number }) => action;
    onReplayAnalysisError: (data: { runId: number, message: string }) => action;
}

export const replayAnalysisActions: Readonly<ReplayAnalysisActions> = {
    startReplayAnalysis: () => (state): NextState => {
        const player = getSelfPlayerRound(state);
        const key = analysisKeyOf(state);
        if (!canStartReplayAnalysis(state) || player === undefined || key === null) {
            return undefined;
        }

        terminateSession();

        const runId = nextRunId;
        nextRunId += 1;

        const session: AnalysisSession = {
            runId,
            key,
            player,
            settings: settingsOf(state),
            wrapper: new ColdClearWrapper(),
            moves: pendingMoves(player),
            total: analysisMoveCount(player),
            nextIndex: 1,
            pendingIndex: null,
            aborted: false,
        };
        currentSession = session;

        session.wrapper.open(msg => handleWorkerMessage(runId, msg));
        const posted = postNextPosition(session);

        if (!posted) {
            // 全手が除外条件に当たった（解析できる局面が無い）
            terminateSession();
            return { replay: { ...state.replay, analysis: finishedState(state, session, 'done') } };
        }

        return { replay: { ...state.replay, analysis: runningState(state, session) } };
    },

    abortReplayAnalysis: () => (state): NextState => {
        const session = currentSession;
        if (session === null || state.replay.analysis.status !== 'running') {
            return undefined;
        }
        session.aborted = true;
        terminateSession();
        return { replay: { ...state.replay, analysis: finishedState(state, session, 'aborted') } };
    },

    // ラウンド・自陣・IR が変わったときの破棄。実行中なら Worker も止める。
    resetReplayAnalysis: () => (state): NextState => {
        if (currentSession === null && state.replay.analysis.key === null) {
            return undefined;
        }
        terminateSession();
        return { replay: { ...state.replay, analysis: clearedReplayAnalysisState(state) } };
    },

    setReplayAnalysisThinkMs: ({ thinkMs }) => (state): NextState => {
        const validMs = normalizeAnalysisThinkMs(thinkMs);
        if (state.replay.analysis.thinkMs === validMs) {
            return undefined;
        }
        // 思考時間が変わるとスコアの前提が変わるため、既存の結果は破棄する
        terminateSession();
        persistViewSettings(state, { replayAnalysisThinkMs: validMs });
        return {
            replay: {
                ...state.replay,
                analysis: { ...clearedReplayAnalysisState(state), thinkMs: validMs },
            },
        };
    },

    onReplayAnalysisResult: ({ runId, result }) => (state): NextState => {
        const session = currentSession;
        if (session === null || session.runId !== runId || session.aborted) {
            return undefined;
        }
        if (state.replay.analysis.key !== session.key) {
            terminateSession();
            return undefined;
        }

        const move = session.moves[result.index - 1];
        if (move !== undefined) {
            session.moves[result.index - 1] = result.playedScore === null
                ? {
                    index: result.index,
                    frame: move.frame,
                    status: 'unmatched',
                    bestScore: result.bestScore,
                    candidateCount: result.candidateCount,
                }
                : {
                    index: result.index,
                    frame: move.frame,
                    status: 'ok',
                    bestScore: result.bestScore,
                    playedScore: result.playedScore,
                    loss: lossOf(result.bestScore, result.playedScore),
                    rank: result.rank ?? undefined,
                    candidateCount: result.candidateCount,
                };
        }

        if (postNextPosition(session)) {
            return { replay: { ...state.replay, analysis: runningState(state, session) } };
        }

        terminateSession();
        return { replay: { ...state.replay, analysis: finishedState(state, session, 'done') } };
    },

    onReplayAnalysisNoMove: ({ runId }) => (state): NextState => {
        const session = currentSession;
        if (session === null || session.runId !== runId || session.aborted) {
            return undefined;
        }

        const index = session.pendingIndex;
        if (index !== null && session.moves[index - 1] !== undefined) {
            session.moves[index - 1] = {
                index,
                status: 'skipped',
                frame: session.moves[index - 1].frame,
            };
        }

        if (postNextPosition(session)) {
            return { replay: { ...state.replay, analysis: runningState(state, session) } };
        }

        terminateSession();
        return { replay: { ...state.replay, analysis: finishedState(state, session, 'done') } };
    },

    onReplayAnalysisError: ({ runId, message }) => (state): NextState => {
        const session = currentSession;
        if (session === null || session.runId !== runId) {
            return undefined;
        }

        const index = session.pendingIndex;
        if (index !== null && session.moves[index - 1] !== undefined) {
            session.moves[index - 1] = {
                index,
                status: 'failed',
                frame: session.moves[index - 1].frame,
            };
        }

        terminateSession();
        return { replay: { ...state.replay, analysis: finishedState(state, session, 'failed', message) } };
    },
};

export function resetReplayAnalysisForTesting() {
    terminateSession();
    nextRunId = 1;
}

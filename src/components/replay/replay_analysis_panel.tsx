import { h } from 'hyperapp';
import { Actions } from '../../actions';
import { ReplayAnalysisState, ReplayMoveEval, State } from '../../states';
import { i18n } from '../../locales/keys';
import { px, style } from '../../lib/types';
import {
    ANALYSIS_THINK_MS_PRESETS,
    frameToX,
    lossScaleOf,
    summarizeAnalysis,
} from '../../lib/cold_clear/replay_analysis';
import {
    EVAL_GRAPH_HEIGHT,
    hasDrawableEval,
    moveAtGraphX,
    renderReplayEvalGraph,
} from './replay_eval_graph';

const ACCENT = '#00796b';
const MUTED = '#777';

const formatLoss = (loss: number): string => {
    if (loss >= 1000) {
        return Math.round(loss).toLocaleString('en-US');
    }
    return loss >= 10 ? loss.toFixed(0) : loss.toFixed(1);
};

const currentMoveOf = (
    moves: ReplayMoveEval[], selfIndex: number,
): ReplayMoveEval | undefined => moves[selfIndex - 1];

const currentText = (move: ReplayMoveEval | undefined): string => {
    if (move === undefined || move.status === 'pending') {
        return i18n.Replay.Analysis.CurrentPending();
    }
    switch (move.status) {
    case 'unmatched':
        return i18n.Replay.Analysis.CurrentUnmatched();
    case 'skipped':
    case 'failed':
        return i18n.Replay.Analysis.CurrentSkipped();
    default:
        break;
    }
    if (move.rank === 1 || (move.loss ?? 0) <= 0) {
        return i18n.Replay.Analysis.CurrentBest();
    }
    return i18n.Replay.Analysis.CurrentLoss(formatLoss(move.loss ?? 0), move.rank ?? 0);
};

interface ReplayAnalysisPanelProps {
    state: State;
    actions: Actions;
    analysis: ReplayAnalysisState | undefined;
    thinkMs: number;
    totalMoves: number;
    endFrame: number;
    width: number;
    canStart: boolean;
}

// 解析の起動・進捗・手評価グラフ・サマリ。グラフはフレーム軸なので、
// 直上のタイムラインおよびガベージマーカー帯と横位置が一致する。
export const replayAnalysisPanel = (
    { state, actions, analysis, thinkMs, totalMoves, endFrame, width, canStart }: ReplayAnalysisPanelProps,
) => {
    const running = analysis !== undefined && analysis.status === 'running';
    const moves = analysis !== undefined ? analysis.moves : [];
    const drawable = hasDrawableEval(moves);
    const summary = summarizeAnalysis(moves);
    const scale = lossScaleOf(moves);
    const cursorX = frameToX(state.replay.cursor.frame, endFrame, width);
    const current = analysis !== undefined
        ? currentMoveOf(moves, state.replay.cursor.selfIndex) : undefined;
    const worst = moves
        .filter(move => move.status === 'ok' && (move.loss ?? 0) > 0)
        .sort((left, right) => (right.loss ?? 0) - (left.loss ?? 0))
        .slice(0, 3);

    return (
        <div
            key="replay-analysis-panel"
            datatest="replay-analysis-panel"
            style={style({ margin: '10px 0 4px', textAlign: 'left' })}
        >
            <div
                key="replay-analysis-head"
                style={style({
                    alignItems: 'center', display: 'flex', flexWrap: 'wrap',
                    fontSize: px(12), gap: px(6), justifyContent: 'space-between',
                })}
            >
                <span key="replay-analysis-title" style={style({ fontWeight: 'bold' })}>
                    {i18n.Replay.Analysis.Title()}
                </span>
                <span
                    key="replay-analysis-actions"
                    style={style({ alignItems: 'center', display: 'flex', gap: px(6) })}
                >
                    <select
                        key="replay-analysis-think-select"
                        datatest="replay-analysis-think-select"
                        aria-label={i18n.Replay.Analysis.ThinkMs()}
                        value={String(thinkMs)}
                        disabled={running}
                        style={style({
                            border: '1px solid #ccc',
                            borderRadius: px(4),
                            display: 'block',
                            fontSize: px(12),
                            height: px(26),
                            padding: '0 4px',
                            width: px(72),
                        })}
                        onchange={(e: Event) => {
                            actions.setReplayAnalysisThinkMs({
                                thinkMs: Number((e.target as HTMLSelectElement).value),
                            });
                        }}
                    >
                        {ANALYSIS_THINK_MS_PRESETS.map(ms => (
                            <option key={`replay-analysis-think-${ms}`} value={String(ms)}>
                                {i18n.Replay.Analysis.ThinkMsOption(ms)}
                            </option>
                        ))}
                    </select>
                    {running ? (
                        <a
                            href="#"
                            key="btn-replay-analysis-abort"
                            datatest="btn-replay-analysis-abort"
                            className="btn-flat"
                            style={style({
                                border: '1px solid #b3261e', borderRadius: px(4), color: '#b3261e',
                                fontSize: px(11), lineHeight: px(24), padding: '0 10px',
                                textTransform: 'none',
                            })}
                            onclick={(e: MouseEvent) => {
                                e.preventDefault();
                                actions.abortReplayAnalysis();
                            }}
                        >
                            {i18n.Replay.Analysis.Abort()}
                        </a>
                    ) : (
                        <a
                            href="#"
                            key="btn-replay-analysis-start"
                            datatest="btn-replay-analysis-start"
                            className={`btn-flat ${canStart ? '' : 'disabled'}`}
                            style={style({
                                border: `1px solid ${ACCENT}`, borderRadius: px(4), color: ACCENT,
                                fontSize: px(11), lineHeight: px(24), padding: '0 10px',
                                textTransform: 'none',
                            })}
                            onclick={(e: MouseEvent) => {
                                e.preventDefault();
                                if (canStart) {
                                    actions.startReplayAnalysis();
                                }
                            }}
                        >
                            {drawable ? i18n.Replay.Analysis.Reanalyze() : i18n.Replay.Analysis.Start()}
                        </a>
                    )}
                </span>
            </div>

            <div
                key="replay-analysis-progress"
                datatest="replay-analysis-progress"
                data-current={String(analysis !== undefined ? analysis.progress.current : 0)}
                data-total={String(analysis !== undefined ? analysis.progress.total : 0)}
                data-status={analysis !== undefined ? analysis.status : 'idle'}
                style={style({ color: MUTED, fontSize: px(11), margin: '2px 0 4px' })}
            >
                {running
                    ? i18n.Replay.Analysis.Progress(analysis!.progress.current, analysis!.progress.total)
                    : analysis !== undefined && analysis.status === 'failed'
                        ? i18n.Replay.Analysis.Failed()
                        : analysis !== undefined && analysis.status === 'aborted'
                            ? i18n.Replay.Analysis.Aborted()
                            : i18n.Replay.Analysis.Estimate(
                                totalMoves, Math.max(1, Math.round(totalMoves * thinkMs / 1000)))}
            </div>

            {drawable ? (
                <div
                    key="replay-analysis-graph-area"
                    style={style({ position: 'relative', height: px(EVAL_GRAPH_HEIGHT) })}
                    onclick={(e: MouseEvent) => {
                        const target = e.currentTarget as HTMLElement;
                        const rect = target.getBoundingClientRect();
                        const move = moveAtGraphX(
                            moves, e.clientX - rect.left, rect.width || width, endFrame);
                        if (move !== undefined) {
                            actions.seekReplayFrame({ frame: move.frame });
                        }
                    }}
                >
                    <img
                        key="replay-analysis-graph"
                        datatest="replay-analysis-graph"
                        src={renderReplayEvalGraph(moves, width, endFrame)}
                        alt={i18n.Replay.Analysis.Graph()}
                        style={style({
                            display: 'block',
                            height: px(EVAL_GRAPH_HEIGHT),
                            width: '100%',
                        })}
                    />
                    <div
                        key="replay-analysis-cursor"
                        datatest="replay-analysis-cursor"
                        style={style({
                            backgroundColor: ACCENT,
                            height: px(EVAL_GRAPH_HEIGHT),
                            left: `${cursorX / Math.max(1, width) * 100}%`,
                            position: 'absolute',
                            top: px(0),
                            width: px(2),
                        })}
                    />
                </div>
            ) : undefined}

            {drawable ? (
                <div
                    key="replay-analysis-summary"
                    datatest="replay-analysis-summary"
                    data-match-rate={String(Math.round(summary.matchRate * 100))}
                    data-mean-loss={String(Math.round(summary.meanLoss))}
                    data-max-loss={String(Math.round(summary.maxLoss))}
                    data-analyzed={String(summary.analyzed)}
                    data-unmatched={String(summary.unmatched)}
                    data-skipped={String(summary.skipped)}
                    style={style({
                        color: '#555', display: 'flex', flexWrap: 'wrap', fontSize: px(11),
                        gap: px(10), margin: '4px 0',
                    })}
                >
                    <span key="analysis-match">
                        {i18n.Replay.Analysis.MatchRate(Math.round(summary.matchRate * 100))}
                    </span>
                    <span key="analysis-mean">
                        {i18n.Replay.Analysis.MeanLoss(formatLoss(summary.meanLoss))}
                    </span>
                    <span key="analysis-max">
                        {i18n.Replay.Analysis.MaxLoss(formatLoss(summary.maxLoss))}
                    </span>
                    {0 < summary.unmatched ? (
                        <span key="analysis-unmatched" style={style({ color: '#5e35b1' })}>
                            {i18n.Replay.Analysis.Unmatched(summary.unmatched)}
                        </span>
                    ) : undefined}
                    {0 < summary.skipped ? (
                        <span key="analysis-skipped" style={style({ color: MUTED })}>
                            {i18n.Replay.Analysis.Skipped(summary.skipped)}
                        </span>
                    ) : undefined}
                </div>
            ) : undefined}

            {drawable ? (
                <div
                    key="replay-analysis-current"
                    datatest="replay-analysis-current"
                    data-index={String(current !== undefined ? current.index : 0)}
                    data-status={current !== undefined ? current.status : 'pending'}
                    data-loss={String(current !== undefined && current.loss !== undefined
                        ? Math.round(current.loss) : '')}
                    style={style({ color: '#555', fontSize: px(11), margin: '2px 0' })}
                >
                    {i18n.Replay.Playing.LockLabel()} {current !== undefined ? current.index : '—'}
                    {' — '}{currentText(current)}
                </div>
            ) : undefined}

            {0 < worst.length ? (
                <div
                    key="replay-analysis-worst"
                    style={style({
                        alignItems: 'center', display: 'flex', flexWrap: 'wrap',
                        fontSize: px(11), gap: px(6), margin: '2px 0',
                    })}
                >
                    <span key="analysis-worst-label" style={style({ color: MUTED })}>
                        {i18n.Replay.Analysis.Worst()}
                    </span>
                    {worst.map((move, order) => (
                        <a
                            href="#"
                            key={`replay-analysis-worst-${order}`}
                            datatest={`replay-analysis-worst-${order}`}
                            className="btn-flat"
                            style={style({
                                border: '1px solid #ccc', borderRadius: px(4),
                                color: (move.loss ?? 0) / scale >= 0.5 ? '#b3261e' : '#e65100',
                                fontSize: px(11), lineHeight: px(20), padding: '0 8px',
                                textTransform: 'none',
                            })}
                            onclick={(e: MouseEvent) => {
                                e.preventDefault();
                                actions.seekReplayFrame({ frame: move.frame });
                            }}
                        >
                            {i18n.Replay.Analysis.WorstItem(move.index, formatLoss(move.loss ?? 0))}
                        </a>
                    ))}
                </div>
            ) : undefined}

            {drawable ? (
                <div
                    key="replay-analysis-note"
                    style={style({ color: MUTED, fontSize: px(10), margin: '2px 0 0' })}
                >
                    {i18n.Replay.Analysis.Note()}
                </div>
            ) : undefined}
        </div>
    );
};

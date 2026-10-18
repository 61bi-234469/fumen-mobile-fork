import { h, View } from 'hyperapp';
import { Actions } from '../actions';
import { State } from '../states';
import { i18n } from '../locales/keys';
import { FieldConstants, Piece } from '../lib/enums';
import { px, style } from '../lib/types';
import {
    getOpponentPlayerRound,
    getReplayEndFrame,
    getReplayKiller,
    getReplayOpponentGarbage,
    getReplayOpponentPoint,
    getReplayOpponentStats,
    getReplayOpponentVisual,
    getReplaySelfGarbage,
    getReplaySelfPoint,
    getReplayStats,
    getReplaySelfVisual,
    getSelectedRound,
    getSelfPlayerRound,
} from '../actions/replay';
import { canStartReplayAnalysis, getReplayAnalysis } from '../actions/replay_analysis';
import { analysisMoveCount } from '../lib/cold_clear/replay_analysis';
import { replayAnalysisPanel } from '../components/replay/replay_analysis_panel';
import { replaySide } from '../components/replay/replay_side';
import { replayTransport } from '../components/replay/replay_transport';
import { getReplayLayout, REPLAY_WIDE_MAX_WIDTH } from './replay_layout';
import { formatFrameTime, lastPointIndex, ReplayPoint, ReplayStats } from '../lib/ttrm/timeline';
import {
    GarbageEvent, IRField, LockPoint, PlayerRoundIR, ReplayIR, ReplayVisualState, RoundIR,
} from '../lib/ttrm/types';

const ACCENT = '#00796b';

// FR-14: 空ユーザ名や doesNotExist は Player N で代替する
// users を省略したリプレイでは、ラウンド内のプレイヤー情報で代替する
const displayName = (ir: ReplayIR, playerId: string): string => {
    let index = ir.meta.users.findIndex(user => user.id === playerId);
    let username = index >= 0 ? ir.meta.users[index].username : '';
    if (index < 0) {
        for (const round of ir.rounds) {
            const roundIndex = round.players.findIndex(player => player.id === playerId);
            if (roundIndex >= 0) {
                index = roundIndex;
                username = round.players[roundIndex].username;
                break;
            }
        }
    }
    if (username === '' || username === 'doesNotExist') {
        return i18n.Replay.DefaultPlayer(index + 1);
    }
    return username;
};

const framesToSeconds = (frames: number): string => (frames / 60).toFixed(1);

const clearLabel = (lock: LockPoint): string => {
    const { lines, spin, perfectClear } = lock.clear;
    if (perfectClear) {
        return 'PC';
    }
    if (lines === 0) {
        return spin !== 'none' ? 'Spin' : '';
    }
    if (lock.piece === Piece.T && spin !== 'none') {
        const suffix = ['S', 'D', 'T'][lines - 1] ?? '';
        return `${spin === 'mini' ? 'Mini ' : ''}TS${suffix}`;
    }
    return ['Single', 'Double', 'Triple', 'Quad'][lines - 1] ?? `${lines} Lines`;
};

const headerBar = (state: State, actions: Actions) => (
    <div
        key="replay-navbar"
        style={style({
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: ACCENT,
            color: '#fff',
            padding: '0 12px',
            height: px(40),
            fontWeight: 'bold',
        })}
    >
        <span>{i18n.Replay.Title()}{state.replay.fileName ? ` — ${state.replay.fileName}` : ''}</span>
        <a
            href="#"
            key="btn-replay-close"
            datatest="btn-replay-close"
            style={style({ color: '#fff', display: 'flex', alignItems: 'center' })}
            onclick={(e: MouseEvent) => {
                e.preventDefault();
                // 再生クロックを止めてから離れる（P2 §3-5 の明示停止経路）
                actions.closeReplayScreen();
            }}
        >
            <i className="material-icons">close</i>
        </a>
    </div>
);

const toolbarButtonStyle = style({
    color: '#555', fontSize: px(11), padding: '0 6px', textTransform: 'none', whiteSpace: 'nowrap',
});

const toolbarSelectStyle = style({
    border: '1px solid #ccc',
    borderRadius: px(4),
    display: 'block',
    fontSize: px(12),
    height: px(28),
    maxWidth: px(220),
    padding: '0 4px',
    width: 'auto',
});

const roundOptionLabel = (round: RoundIR, selfId: string | null): string => {
    if (round.status !== 'ok') {
        return `R${round.index + 1} ${i18n.Replay.Select.Unplayable()}`;
    }
    const result = selfId === null || round.result.winnerId === null ? '—'
        : round.result.winnerId === selfId ? i18n.Replay.Select.Win() : i18n.Replay.Select.Lose();
    const selfPlayer = round.players.find(player => player.id === selfId);
    const stats = selfPlayer !== undefined
        ? ` · ${i18n.Replay.Select.RoundStats(selfPlayer.locks.length, framesToSeconds(selfPlayer.terminal.frame))}`
        : '';
    return `R${round.index + 1} ${result}${stats}`;
};

// ファイル選択・ラウンド・自陣・表示切替を 1 行にまとめる。選択画面を挟まず、
// 読み込み前から同じ位置に置いておくことで、取り込み直後にそのまま再生できる。
const replayToolbar = (state: State, actions: Actions) => {
    const ir = state.replay.ir;
    const playing = state.replay.phase === 'playing' && ir !== undefined;
    const round = playing ? getSelectedRound(state) : undefined;
    const selfId = state.replay.selection.selfPlayerId;
    const opponent = playing ? getOpponentPlayerRound(state) : undefined;

    return (
        <div
            key="replay-toolbar"
            datatest="replay-toolbar"
            style={style({
                alignItems: 'center',
                display: 'flex',
                flexWrap: 'wrap',
                gap: px(6),
                justifyContent: 'center',
                margin: '0 auto',
                maxWidth: px(REPLAY_WIDE_MAX_WIDTH),
                padding: '8px 16px 0',
                width: '100%',
            })}
        >
            <label
                key="replay-file-label"
                className="btn-small"
                style={style({ backgroundColor: ACCENT, textTransform: 'none' })}
            >
                {i18n.Replay.Import.Button()}
                <input
                    key="replay-file-input"
                    datatest="replay-file-input"
                    type="file"
                    accept=".ttrm,application/json"
                    style={style({ display: 'none' })}
                    onchange={(e: Event) => {
                        const target = e.target as HTMLInputElement;
                        if (target.files !== null && target.files.length > 0) {
                            actions.importTtrmFile({ file: target.files[0] });
                        }
                        target.value = '';
                    }}
                />
            </label>

            {ir !== undefined && round !== undefined ? (
                <select
                    key="replay-round-select"
                    datatest="replay-round-select"
                    aria-label={i18n.Replay.Select.Rounds()}
                    value={String(round.index)}
                    style={toolbarSelectStyle}
                    onchange={(e: Event) => {
                        const target = e.target as HTMLSelectElement;
                        // フォーカスが残ると矢印キー・Space が手番送りではなく選択の変更になる
                        target.blur();
                        actions.selectReplayRound({ roundIndex: Number(target.value) });
                    }}
                >
                    {ir.rounds.map(item => (
                        <option
                            key={`replay-round-${item.index}`}
                            datatest={`replay-round-${item.index}`}
                            value={String(item.index)}
                            disabled={item.status !== 'ok'}
                        >
                            {roundOptionLabel(item, selfId)}
                        </option>
                    ))}
                </select>
            ) : undefined}

            {ir !== undefined && round !== undefined ? (
                <select
                    key="replay-self-select"
                    datatest="replay-self-select"
                    aria-label={i18n.Replay.Select.SelfPlayer()}
                    value={selfId ?? ''}
                    style={toolbarSelectStyle}
                    onchange={(e: Event) => {
                        const target = e.target as HTMLSelectElement;
                        target.blur();
                        actions.selectReplaySelfPlayer({ playerId: target.value });
                    }}
                >
                    {round.players.map(player => (
                        <option
                            key={`replay-self-player-${player.id}`}
                            datatest={`replay-self-player-${player.id}`}
                            value={player.id}
                        >
                            {i18n.Replay.Playing.Self()}: {displayName(ir, player.id)}
                        </option>
                    ))}
                </select>
            ) : undefined}

            {opponent !== undefined ? (
                <a
                    href="#"
                    key="btn-replay-swap-sides"
                    datatest="btn-replay-swap-sides"
                    className="btn-flat"
                    style={toolbarButtonStyle}
                    onclick={(e: MouseEvent) => {
                        e.preventDefault();
                        actions.swapReplaySides();
                    }}
                >
                    ⇄ {i18n.Replay.Playing.Swap()}
                </a>
            ) : undefined}
            <a
                href="#"
                key="btn-replay-toggle-opponent"
                datatest="btn-replay-toggle-opponent"
                className="btn-flat"
                style={toolbarButtonStyle}
                onclick={(e: MouseEvent) => {
                    e.preventDefault();
                    actions.toggleReplayOpponent();
                }}
            >
                {state.replay.view.showOpponent
                    ? i18n.Replay.Playing.HideOpponent()
                    : i18n.Replay.Playing.ShowOpponent()}
            </a>
            {ir !== undefined ? (
                <a
                    href="#"
                    key="btn-replay-reset"
                    datatest="btn-replay-reset"
                    className="btn-flat"
                    title={i18n.Replay.Select.ParseTime(ir.meta.parseMs)}
                    style={toolbarButtonStyle}
                    onclick={(e: MouseEvent) => {
                        e.preventDefault();
                        actions.resetReplayImport();
                    }}
                >
                    {i18n.Replay.Import.Clear()}
                </a>
            ) : undefined}
        </div>
    );
};

// 読み込み前・解析中・失敗時も盤面は出しておく。ファイルを渡せばこの場所が
// そのまま 1 ラウンド目の再生画面に置き換わる。
const EMPTY_FIELD: IRField = Array.from(
    { length: FieldConstants.Width * FieldConstants.Height }, () => Piece.Empty);

const EMPTY_POINT: ReplayPoint = {
    kind: 'initial',
    index: 0,
    frame: 0,
    field: EMPTY_FIELD,
    hold: null,
    current: null,
    next: [],
    clippedRowCount: 0,
};

const EMPTY_VISUAL: ReplayVisualState = {
    frame: 0,
    field: EMPTY_FIELD,
    sourceHeight: FieldConstants.Height,
    clippedRowCount: 0,
    hold: null,
    current: null,
    next: [],
};

const EMPTY_STATS: ReplayStats = {
    placed: 0,
    totalLocks: 0,
    frame: 0,
    seconds: 0,
    pps: 0,
    apm: 0,
    app: 0,
    vs: 0,
    area: 0,
    b2b: 0,
    ren: 0,
    attack: 0,
    garbageCleared: 0,
    gauge: 0,
    tanked: 0,
};

const emptyStatus = (state: State) => {
    if (state.replay.phase === 'parsing') {
        return (
            <div
                key="replay-parsing-phase"
                datatest="replay-parsing-phase"
                style={style({
                    alignItems: 'center', display: 'flex', gap: px(8), justifyContent: 'center', margin: '4px 0',
                })}
            >
                <div
                    key="spinner"
                    className="preloader-wrapper small active"
                    style={style({ height: px(20), width: px(20) })}
                >
                    <div className="spinner-layer spinner-teal-only">
                        <div className="circle-clipper left"><div className="circle" /></div>
                        <div className="gap-patch"><div className="circle" /></div>
                        <div className="circle-clipper right"><div className="circle" /></div>
                    </div>
                </div>
                <span key="parsing-text">{i18n.Replay.Parsing()}</span>
            </div>
        );
    }
    if (state.replay.phase === 'failed' && state.replay.error !== undefined) {
        return (
            <div
                key="replay-error"
                datatest="replay-error"
                style={style({
                    border: '1px solid #b3261e',
                    borderRadius: px(6),
                    color: '#b3261e',
                    margin: '0 auto 8px',
                    maxWidth: px(480),
                    padding: '6px 12px',
                    textAlign: 'left',
                })}
            >
                <div style={style({ fontWeight: 'bold' })}>{i18n.Replay.Error.Title()}</div>
                <div style={style({ fontSize: px(12), marginTop: px(2) })}>
                    [{state.replay.error.stage}] {state.replay.error.message}
                </div>
            </div>
        );
    }
    return (
        <div key="replay-import-hint" style={style({ color: '#777', fontSize: px(12), margin: '4px 0' })}>
            <div key="import-prompt">{i18n.Replay.Import.Prompt()}</div>
        </div>
    );
};

const emptyStage = (state: State) => {
    const layout = getReplayLayout(state, state.replay.view.showOpponent);
    const isWide = layout.mode === 'wide';
    const guideLineColor = state.fumen.guideLineColor;
    return (
        <div
            key="replay-import-phase"
            datatest="replay-import-phase"
            style={style({
                margin: '0 auto',
                maxWidth: px(layout.containerMaxWidth),
                padding: '8px 16px 12px',
                textAlign: 'center',
            })}
        >
            {emptyStatus(state)}
            <div
                key="board-row"
                style={style({
                    alignItems: 'flex-start',
                    display: 'flex',
                    gap: px(isWide ? 24 : 8),
                    justifyContent: 'center',
                })}
            >
                {replaySide({
                    guideLineColor,
                    variant: 'self',
                    size: 'full',
                    point: EMPTY_POINT,
                    visual: EMPTY_VISUAL,
                    blockSize: layout.blockSize,
                    label: i18n.Replay.Playing.Self(),
                    counterText: '—',
                    queueWidth: layout.queueWidth,
                    stats: EMPTY_STATS,
                })}
                {layout.showOpponent ? replaySide({
                    guideLineColor,
                    variant: 'opponent',
                    size: isWide ? 'full' : 'compact',
                    point: EMPTY_POINT,
                    visual: EMPTY_VISUAL,
                    blockSize: layout.opponentBlockSize,
                    label: i18n.Replay.Playing.Opponent(),
                    counterText: '—',
                    queueWidth: layout.queueWidth,
                    stats: EMPTY_STATS,
                }) : undefined}
            </div>
        </div>
    );
};

// ポイントの表示ラベル。「開始」→「手番 1..L」→「終了 (reason)」（§7-4）。
// 手番は「これから確定する手番」を指す。手番送りで止めた側は停止 index をそのまま、
// フリーカーソル側は確定済み + 1（＝いま落ちているミノ）を出すので、停止と再生で数字が連続する。
const pointCounterText = (
    player: PlayerRoundIR, point: ReplayPoint, parked: boolean, frame: number,
): string => {
    const total = player.locks.length;
    if (point.kind === 'terminal') {
        return `${i18n.Replay.Playing.Terminal()} (${player.terminal.reason})`;
    }
    // 開始地点そのもの（手番送りで止めた、または先頭へシークした）は「開始」のまま
    if (point.kind === 'initial' && (parked || total === 0 || frame <= 0)) {
        return i18n.Replay.Playing.Start();
    }
    const turn = point.kind === 'initial' ? 1
        : parked ? point.index
        : Math.min(total, point.index + 1);
    return `${turn} / ${total}`;
};

// FR-41 の直近イベント。受信は必ず被弾か相殺に解決されるが、直近 1 件の表示では
// 「いま何が起きたか」を示すため 3 種とも出す。
const recentGarbageText = (event: GarbageEvent): string => {
    if (event.kind === 'tank') {
        return i18n.Replay.Playing.GarbageTank(event.amount);
    }
    if (event.kind === 'cancel') {
        return i18n.Replay.Playing.GarbageCancel(event.amount);
    }
    return i18n.Replay.Playing.GarbageReceive(event.amount);
};

const playingPhase = (state: State, actions: Actions) => {
    const ir = state.replay.ir!;
    const player = getSelfPlayerRound(state)!;
    const round = getSelectedRound(state)!;
    const opponent = getOpponentPlayerRound(state);
    const selfPoint = getReplaySelfPoint(state)!;
    const opponentPoint = getReplayOpponentPoint(state);
    const selfVisual = getReplaySelfVisual(state)!;
    const opponentVisual = getReplayOpponentVisual(state);
    const stats = getReplayStats(state)!;
    const opponentStats = getReplayOpponentStats(state);
    const clipped = selfVisual.clippedRowCount;
    const lock = selfPoint.kind === 'lock' ? player.locks[selfPoint.index - 1] : undefined;
    const opponentLock = opponent !== undefined && opponentPoint !== undefined
        && opponentPoint.kind === 'lock'
        ? opponent.locks[opponentPoint.index - 1] : undefined;
    const guideLineColor = state.fumen.guideLineColor;

    // ガベージ情報は常時表示する。Replay→INPUT切り出しの内容とも独立している。
    const selfGarbage = getReplaySelfGarbage(state);
    const opponentGarbage = getReplayOpponentGarbage(state);
    const killer = getReplayKiller(state);
    // 終端で死因の攻撃が特定できないとき（topout など）は理由の文字列だけを出す（§7-4）
    const terminalReason = selfPoint.kind === 'terminal'
        && player.terminal.reason !== 'winner'
        ? player.terminal.reason : undefined;

    // レイアウトは state に持たず毎描画で導出する。幅が足りなければ相手は描かれない（§3-6）。
    const layout = getReplayLayout(
        state, state.replay.view.showOpponent && opponentPoint !== undefined);
    const showOpponent = layout.showOpponent && opponentPoint !== undefined;
    const isWide = layout.mode === 'wide';

    const basisPointIndex = state.replay.cursor.selfIndex;
    // 手番停止（接地直前）は常に自陣側だけに適用する。
    const selfParked = state.replay.cursor.turnStop;
    const opponentParked = false;

    return (
        <div
            key="replay-playing-phase"
            datatest="replay-playing-phase"
            style={style({
                margin: '0 auto',
                maxWidth: px(layout.containerMaxWidth),
                padding: '8px 16px 12px',
                textAlign: 'center',
            })}
        >
            <div
                key="board-row"
                style={style({
                    alignItems: 'flex-start',
                    display: 'flex',
                    gap: px(isWide ? 24 : 8),
                    justifyContent: 'center',
                })}
            >
                {replaySide({
                    guideLineColor,
                    stats,
                    variant: 'self',
                    size: 'full',
                    point: selfPoint,
                    visual: selfVisual,
                    blockSize: layout.blockSize,
                    label: i18n.Replay.Playing.Self(),
                    counterText: pointCounterText(player, selfPoint, selfParked, state.replay.cursor.frame),
                    // PC は 2 盤面が対等なので、どちらの側かはプレイヤー名で示す（§3-6-2）
                    heading: isWide ? displayName(ir, player.id) : undefined,
                    garbage: selfGarbage,
                    queueWidth: layout.queueWidth,
                    clearText: lock !== undefined && clearLabel(lock) !== ''
                        ? clearLabel(lock) : undefined,
                })}
                {showOpponent && opponentPoint !== undefined && opponentVisual !== undefined
                    && opponentStats !== undefined ? replaySide({
                        guideLineColor,
                        variant: 'opponent',
                        size: isWide ? 'full' : 'compact',
                        point: opponentPoint,
                        visual: opponentVisual,
                        blockSize: layout.opponentBlockSize,
                        label: i18n.Replay.Playing.Opponent(),
                        counterText: pointCounterText(
                            opponent!, opponentPoint, opponentParked, state.replay.cursor.frame),
                        heading: isWide ? displayName(ir, opponent!.id) : undefined,
                        garbage: opponentGarbage,
                        queueWidth: layout.queueWidth,
                        stats: opponentStats,
                        clearText: opponentLock !== undefined && clearLabel(opponentLock) !== ''
                            ? clearLabel(opponentLock) : undefined,
                    }) : undefined}
            </div>

            {clipped > 0 ? (
                <div
                    key="replay-clip-notice"
                    datatest="replay-clip-notice"
                    style={style({
                        border: '1px solid #ef6c00',
                        borderRadius: px(3),
                        color: '#e65100',
                        display: 'inline-block',
                        fontSize: px(11),
                        margin: '6px 0 0',
                        padding: '1px 8px',
                    })}
                >
                    {i18n.Replay.Playing.ClipNotice(clipped)}
                </div>
            ) : undefined}

            <div
                key="lock-info"
                style={style({ color: '#555', fontSize: px(13), margin: '6px 0' })}
            >
                <span key="replay-lock-counter" datatest="replay-lock-counter">
                    {i18n.Replay.Playing.LockLabel()}{' '}
                    {pointCounterText(player, selfPoint, selfParked, state.replay.cursor.frame)}
                </span>
                {/* ライン消去の内訳は HOLD の下へ移した。ここは手番と時刻だけ残す */}
                {lock !== undefined ? (
                    <span key="lock-details" style={style({ color: '#777', marginLeft: px(8) })}>
                        {framesToSeconds(lock.frame)}s
                    </span>
                ) : undefined}
                {selfGarbage !== undefined && selfGarbage.recent !== undefined ? (
                    <span
                        key="replay-garbage-recent"
                        datatest="replay-garbage-recent"
                        style={style({ color: '#b3261e', marginLeft: px(8) })}
                    >
                        {recentGarbageText(selfGarbage.recent)}
                    </span>
                ) : undefined}
            </div>

            {replayTransport({
                state, actions, stats,
                endFrame: getReplayEndFrame(state),
                canStepBack: 0 < basisPointIndex,
                canStepForward: basisPointIndex < lastPointIndex(player),
                garbagePlayer: player,
                markerWidth: layout.containerMaxWidth - 32,
            })}

            {/* 手評価グラフはタイムラインと同じ幅・同じフレーム軸で敷く */}
            {replayAnalysisPanel({
                state,
                actions,
                analysis: getReplayAnalysis(state),
                thinkMs: state.replay.analysis.thinkMs,
                totalMoves: analysisMoveCount(player),
                endFrame: getReplayEndFrame(state),
                width: layout.containerMaxWidth - 32,
                canStart: canStartReplayAnalysis(state),
            })}

            {/* FR-45。自陣の終端でだけ出す。相手側に出すと画面が死因だらけになる（§7-4） */}
            {terminalReason !== undefined ? (
                <div
                    key="replay-killer"
                    datatest="replay-killer"
                    style={style({
                        alignItems: 'center',
                        border: '1px solid #b3261e',
                        borderRadius: px(4),
                        color: '#b3261e',
                        display: 'flex',
                        fontSize: px(12),
                        gap: px(8),
                        justifyContent: 'center',
                        margin: '0 0 8px',
                        padding: '3px 8px',
                    })}
                >
                    <span key="replay-killer-text">
                        {i18n.Replay.Playing.Killer()}: {killer !== undefined
                            ? i18n.Replay.Playing.KillerGarbage(
                                formatFrameTime(killer.senderFrame ?? killer.frame),
                                killer.amount, killer.column + 1)
                            : terminalReason}
                    </span>
                    {killer !== undefined ? (
                        <a
                            href="#"
                            key="btn-replay-killer-seek"
                            datatest="btn-replay-killer-seek"
                            className="btn-flat"
                            style={style({
                                color: '#b3261e', fontSize: px(11), padding: '0 6px',
                                textTransform: 'none',
                            })}
                            onclick={(e: MouseEvent) => {
                                e.preventDefault();
                                // V-01 の共通フレーム軸により、相手の攻撃フレームへそのまま跳べる
                                actions.seekReplayFrame({
                                    frame: killer.senderFrame ?? killer.frame,
                                });
                            }}
                        >
                            ▸ {i18n.Replay.Playing.KillerSeek()}
                        </a>
                    ) : undefined}
                </div>
            ) : undefined}

            <a
                href="#"
                key="btn-replay-open-editor"
                datatest="btn-replay-open-editor"
                className="btn"
                style={style({ backgroundColor: '#1565c0', width: '100%' })}
                onclick={(e: MouseEvent) => {
                    e.preventDefault();
                    actions.openReplayInEditor();
                }}
            >
                {i18n.Replay.Playing.OpenInEditor()}
            </a>

        </div>
    );
};

export const view: View<State, Actions> = (state, actions) => {
    const body = state.replay.phase === 'playing' && getSelfPlayerRound(state) !== undefined
        ? playingPhase(state, actions)
        : emptyStage(state);

    return (
        <div
            key="replay-screen"
            datatest="replay-screen"
            style={style({
                display: 'flex',
                flexDirection: 'column',
                height: px(state.display.height),
                overflowY: 'auto',
            })}
        >
            {headerBar(state, actions)}
            {replayToolbar(state, actions)}
            {body}
        </div>
    );
};

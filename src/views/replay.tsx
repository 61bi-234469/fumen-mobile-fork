import { h, View } from 'hyperapp';
import { Actions } from '../actions';
import { State } from '../states';
import { i18n } from '../locales/keys';
import { FieldConstants, Piece } from '../lib/enums';
import { px, style } from '../lib/types';
import {
    getCurrentReplayClippedRowCount,
    getOpponentPlayerRound,
    getReplayEndFrame,
    getReplayOpponentPoint,
    getReplaySelfPoint,
    getReplayStats,
    getSelectedRound,
    getSelfPlayerRound,
} from '../actions/replay';
import { MINO_SLOT_WIDTH, replaySide } from '../components/replay/replay_side';
import { replayTransport } from '../components/replay/replay_transport';
import { lastPointIndex, ReplayPoint } from '../lib/ttrm/timeline';
import { LockPoint, PlayerRoundIR, ReplayIR, RoundIR } from '../lib/ttrm/types';

const ACCENT = '#00796b';

// FR-14: 空ユーザ名や doesNotExist は Player N で代替する
const displayName = (ir: ReplayIR, playerId: string): string => {
    const index = ir.meta.users.findIndex(user => user.id === playerId);
    const user = ir.meta.users[index];
    const username = user !== undefined ? user.username : '';
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

const importPhase = (state: State, actions: Actions) => {
    const onFiles = (files: FileList | null) => {
        if (files !== null && files.length > 0) {
            actions.importTtrmFile({ file: files[0] });
        }
    };
    return (
        <div
            key="replay-import-phase"
            datatest="replay-import-phase"
            style={style({ padding: '24px 16px', textAlign: 'center' })}
            ondragover={(e: DragEvent) => e.preventDefault()}
            ondrop={(e: DragEvent) => {
                e.preventDefault();
                onFiles(e.dataTransfer !== null ? e.dataTransfer.files : null);
            }}
        >
            {state.replay.phase === 'failed' && state.replay.error !== undefined ? (
                <div
                    key="replay-error"
                    datatest="replay-error"
                    style={style({
                        border: '1px solid #b3261e',
                        borderRadius: px(6),
                        color: '#b3261e',
                        margin: '0 auto 20px',
                        maxWidth: px(480),
                        padding: '10px 14px',
                        textAlign: 'left',
                    })}
                >
                    <div style={style({ fontWeight: 'bold' })}>{i18n.Replay.Error.Title()}</div>
                    <div style={style({ fontSize: px(12), marginTop: px(4) })}>
                        [{state.replay.error.stage}] {state.replay.error.message}
                    </div>
                </div>
            ) : undefined}

            <p key="import-prompt">{i18n.Replay.Import.Prompt()}</p>
            <label
                key="replay-file-label"
                className="btn"
                style={style({ backgroundColor: ACCENT, margin: '12px 0' })}
            >
                {state.replay.phase === 'failed' ? i18n.Replay.Error.Retry() : i18n.Replay.Import.Button()}
                <input
                    key="replay-file-input"
                    datatest="replay-file-input"
                    type="file"
                    accept=".ttrm,application/json"
                    style={style({ display: 'none' })}
                    onchange={(e: Event) => {
                        const target = e.target as HTMLInputElement;
                        onFiles(target.files);
                        target.value = '';
                    }}
                />
            </label>
            <p key="drop-hint" style={style({ color: '#777', fontSize: px(12) })}>
                {i18n.Replay.Import.DropHint()}
            </p>

            {/* FR-02: ファイルを選べない環境向けに、JSON テキストからも取り込めるようにする */}
            <div
                key="replay-import-text-block"
                style={style({ margin: '20px auto 0', maxWidth: px(480), textAlign: 'left' })}
            >
                <div key="paste-label" style={style({ color: '#777', fontSize: px(12) })}>
                    {i18n.Replay.Import.PasteLabel()}
                </div>
                <textarea
                    key="replay-import-text"
                    datatest="replay-import-text"
                    placeholder={i18n.Replay.Import.PastePlaceholder()}
                    style={style({
                        border: '1px solid #ccc',
                        borderRadius: px(4),
                        fontFamily: 'monospace',
                        fontSize: px(11),
                        height: px(80),
                        padding: px(6),
                        width: '100%',
                    })}
                />
                <a
                    href="#"
                    key="btn-replay-import-text"
                    datatest="btn-replay-import-text"
                    className="btn"
                    style={style({ backgroundColor: ACCENT, marginTop: px(8), width: '100%' })}
                    onclick={(e: MouseEvent) => {
                        e.preventDefault();
                        const area = document.querySelector(
                            '[datatest="replay-import-text"]') as HTMLTextAreaElement | null;
                        const text = area !== null ? area.value.trim() : '';
                        if (text !== '') {
                            actions.importTtrmText({ text });
                        }
                    }}
                >
                    {i18n.Replay.Import.PasteButton()}
                </a>
            </div>
        </div>
    );
};

const parsingPhase = () => (
    <div
        key="replay-parsing-phase"
        datatest="replay-parsing-phase"
        style={style({ padding: '40px 16px', textAlign: 'center' })}
    >
        <div key="spinner" className="preloader-wrapper small active">
            <div className="spinner-layer spinner-teal-only">
                <div className="circle-clipper left"><div className="circle" /></div>
                <div className="gap-patch"><div className="circle" /></div>
                <div className="circle-clipper right"><div className="circle" /></div>
            </div>
        </div>
        <p key="parsing-text">{i18n.Replay.Parsing()}</p>
    </div>
);

const roundRow = (
    state: State, actions: Actions, ir: ReplayIR, round: RoundIR, selfId: string | null,
) => {
    const selected = state.replay.selection.roundIndex === round.index;
    const playable = round.status === 'ok';
    const selfPlayer = selfId !== null
        ? round.players.find(player => player.id === selfId)
        : undefined;
    const resultLabel = !playable
        ? i18n.Replay.Select.Unplayable()
        : selfId === null || round.result.winnerId === null
            ? '—'
            : round.result.winnerId === selfId ? i18n.Replay.Select.Win() : i18n.Replay.Select.Lose();
    const resultColor = !playable || selfId === null || round.result.winnerId === null
        ? '#777'
        : round.result.winnerId === selfId ? '#1b7f4b' : '#b3261e';
    const stats = selfPlayer !== undefined
        ? i18n.Replay.Select.RoundStats(
            selfPlayer.locks.length, framesToSeconds(selfPlayer.terminal.frame))
        : round.failure !== undefined ? round.failure.message : '';

    return (
        <a
            href="#"
            key={`replay-round-${round.index}`}
            datatest={`replay-round-${round.index}`}
            className="collection-item"
            style={style({
                alignItems: 'center',
                backgroundColor: selected ? '#e0f2f1' : 'transparent',
                color: '#333',
                display: 'flex',
                justifyContent: 'space-between',
                opacity: playable ? 1 : 0.55,
                padding: '8px 12px',
            })}
            onclick={(e: MouseEvent) => {
                e.preventDefault();
                if (playable) {
                    actions.selectReplayRound({ roundIndex: round.index });
                }
            }}
        >
            <span style={style({ color: resultColor, fontWeight: selected ? 'bold' : 'normal' })}>
                R{round.index + 1} {resultLabel}
            </span>
            <span style={style({ color: '#777', fontSize: px(12) })}>{stats}</span>
        </a>
    );
};

const selectPhase = (state: State, actions: Actions) => {
    const ir = state.replay.ir!;
    const selfId = state.replay.selection.selfPlayerId;
    const round = getSelectedRound(state);
    const canStart = round !== undefined && round.status === 'ok' && getSelfPlayerRound(state) !== undefined;

    return (
        <div
            key="replay-select-phase"
            datatest="replay-select-phase"
            style={style({ margin: '0 auto', maxWidth: px(480), padding: '16px' })}
        >
            <div key="meta" style={style({ color: '#777', fontSize: px(12), marginBottom: px(12) })}>
                {ir.meta.gamemode.toUpperCase()} / {ir.meta.ts.slice(0, 10)} / {ir.rounds.length} rounds
                {/* NFR-02: 実機での解析所要時間を出す */}
                <span key="replay-parse-time" datatest="replay-parse-time" style={style({ marginLeft: px(8) })}>
                    {i18n.Replay.Select.ParseTime(ir.meta.parseMs)}
                </span>
            </div>

            <div key="self-player-label" style={style({ fontWeight: 'bold', marginBottom: px(4) })}>
                {i18n.Replay.Select.SelfPlayer()}
            </div>
            <div key="self-player-list" style={style({ display: 'flex', gap: px(8), marginBottom: px(16) })}>
                {ir.meta.users.map(user => (
                    <a
                        href="#"
                        key={`replay-self-player-${user.id}`}
                        datatest={`replay-self-player-${user.id}`}
                        className="btn-flat"
                        style={style({
                            border: selfId === user.id ? `2px solid ${ACCENT}` : '1px solid #ccc',
                            borderRadius: px(4),
                            color: selfId === user.id ? ACCENT : '#555',
                            fontWeight: selfId === user.id ? 'bold' : 'normal',
                            textTransform: 'none',
                        })}
                        onclick={(e: MouseEvent) => {
                            e.preventDefault();
                            actions.selectReplaySelfPlayer({ playerId: user.id });
                        }}
                    >
                        {displayName(ir, user.id)}
                    </a>
                ))}
            </div>

            <div key="rounds-label" style={style({ fontWeight: 'bold', marginBottom: px(4) })}>
                {i18n.Replay.Select.Rounds()}
            </div>
            <div key="round-list" className="collection" style={style({ margin: '0 0 16px' })}>
                {ir.rounds.map(round => roundRow(state, actions, ir, round, selfId))}
            </div>

            <a
                href="#"
                key="btn-replay-start"
                datatest="btn-replay-start"
                className={`btn ${canStart ? '' : 'disabled'}`}
                style={style({ backgroundColor: ACCENT, width: '100%' })}
                onclick={(e: MouseEvent) => {
                    e.preventDefault();
                    actions.startReplayPlayback();
                }}
            >
                {i18n.Replay.Select.Start()}
            </a>

            <a
                href="#"
                key="btn-replay-reset"
                datatest="btn-replay-reset"
                style={style({
                    color: '#777', display: 'block', fontSize: px(12), marginTop: px(12), textAlign: 'center',
                })}
                onclick={(e: MouseEvent) => {
                    e.preventDefault();
                    actions.resetReplayImport();
                }}
            >
                {i18n.Replay.Error.Retry()}
            </a>
        </div>
    );
};

// 相手盤面は自陣より小さく並置する（P2 §3-6。タブ切替にはしない）。
const OPPONENT_SCALE = 0.55;
const MIN_OPPONENT_BLOCK_SIZE = 4;

// ポイントの表示ラベル。「開始」→「手番 1..L」→「終了 (reason)」（§7-4）。
const pointCounterText = (player: PlayerRoundIR, point: ReplayPoint): string => {
    if (point.kind === 'initial') {
        return i18n.Replay.Playing.Start();
    }
    if (point.kind === 'terminal') {
        return `${i18n.Replay.Playing.Terminal()} (${player.terminal.reason})`;
    }
    return `${point.index} / ${player.locks.length}`;
};

// 自陣の blockSize は、相手盤面ぶんの幅を差し引いてから決める。
const decideBlockSizes = (state: State, showOpponent: boolean) => {
    const selfColumns = (MINO_SLOT_WIDTH + 10) * 2 + 32;
    const available = Math.min(state.display.width, 480) - selfColumns;
    // 相手は自陣ブロックの OPPONENT_SCALE 倍。自陣 1 ブロックあたりの所要幅から逆算する。
    const widthPerBlock = showOpponent ? 1 + OPPONENT_SCALE : 1;
    const blockSize = Math.max(6, Math.min(
        16,
        Math.floor((state.display.height - 330) / FieldConstants.Height),
        Math.floor(available / (FieldConstants.Width * widthPerBlock)),
    ));
    return {
        blockSize,
        opponentBlockSize: Math.floor(blockSize * OPPONENT_SCALE),
    };
};

const playingPhase = (state: State, actions: Actions) => {
    const ir = state.replay.ir!;
    const player = getSelfPlayerRound(state)!;
    const round = getSelectedRound(state)!;
    const opponent = getOpponentPlayerRound(state);
    const selfPoint = getReplaySelfPoint(state)!;
    const opponentPoint = getReplayOpponentPoint(state);
    const stats = getReplayStats(state)!;
    const clipped = getCurrentReplayClippedRowCount(state);
    const lock = selfPoint.kind === 'lock' ? player.locks[selfPoint.index - 1] : undefined;
    const guideLineColor = state.fumen.guideLineColor;

    const sizes = decideBlockSizes(state, state.replay.view.showOpponent);
    // 幅が足りず相手ブロックが潰れる場合は自陣だけにフォールバックする（§3-6）。
    const showOpponent = state.replay.view.showOpponent
        && opponentPoint !== undefined
        && MIN_OPPONENT_BLOCK_SIZE <= sizes.opponentBlockSize;
    const { blockSize } = showOpponent ? sizes : decideBlockSizes(state, false);

    const basisPlayer = state.replay.cursor.stepBasis === 'opponent' && opponent !== undefined
        ? opponent : player;
    const basisPointIndex = state.replay.cursor.stepBasis === 'opponent' && opponent !== undefined
        ? state.replay.cursor.opponentIndex : state.replay.cursor.selfIndex;

    return (
        <div
            key="replay-playing-phase"
            datatest="replay-playing-phase"
            style={style({ margin: '0 auto', maxWidth: px(480), padding: '12px 16px', textAlign: 'center' })}
        >
            <div
                key="playing-meta"
                style={style({
                    alignItems: 'center', color: '#777', display: 'flex', fontSize: px(12),
                    justifyContent: 'space-between', marginBottom: px(8),
                })}
            >
                <span key="playing-meta-text">
                    R{round.index + 1} — {displayName(ir, player.id)}
                    {opponent !== undefined ? ` vs ${displayName(ir, opponent.id)}` : ''}
                </span>
                <span key="playing-meta-buttons" style={style({ display: 'flex', gap: px(4) })}>
                    {opponent !== undefined ? (
                        <a
                            href="#"
                            key="btn-replay-toggle-opponent"
                            datatest="btn-replay-toggle-opponent"
                            className="btn-flat"
                            style={style({ color: '#555', fontSize: px(11), padding: '0 6px', textTransform: 'none' })}
                            onclick={(e: MouseEvent) => {
                                e.preventDefault();
                                actions.toggleReplayOpponent();
                            }}
                        >
                            {state.replay.view.showOpponent
                                ? i18n.Replay.Playing.HideOpponent()
                                : i18n.Replay.Playing.ShowOpponent()}
                        </a>
                    ) : undefined}
                    {opponent !== undefined ? (
                        <a
                            href="#"
                            key="btn-replay-swap-sides"
                            datatest="btn-replay-swap-sides"
                            className="btn-flat"
                            style={style({ color: '#555', fontSize: px(11), padding: '0 6px', textTransform: 'none' })}
                            onclick={(e: MouseEvent) => {
                                e.preventDefault();
                                actions.swapReplaySides();
                            }}
                        >
                            ⇄ {i18n.Replay.Playing.Swap()}
                        </a>
                    ) : undefined}
                </span>
            </div>

            <div
                key="board-row"
                style={style({
                    alignItems: 'flex-start', display: 'flex', gap: px(8), justifyContent: 'center',
                })}
            >
                {replaySide({
                    blockSize, guideLineColor,
                    variant: 'self',
                    point: selfPoint,
                    label: i18n.Replay.Playing.Self(),
                    counterText: pointCounterText(player, selfPoint),
                })}
                {showOpponent && opponentPoint !== undefined ? replaySide({
                    guideLineColor,
                    variant: 'opponent',
                    point: opponentPoint,
                    blockSize: sizes.opponentBlockSize,
                    label: i18n.Replay.Playing.Opponent(),
                    counterText: pointCounterText(opponent!, opponentPoint),
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
                    {i18n.Replay.Playing.LockLabel()} {pointCounterText(player, selfPoint)}
                </span>
                {lock !== undefined ? (
                    <span key="lock-details" style={style({ color: '#777', marginLeft: px(8) })}>
                        {framesToSeconds(lock.frame)}s
                        {clearLabel(lock) !== '' ? ` / ${clearLabel(lock)}` : ''}
                    </span>
                ) : undefined}
            </div>

            {replayTransport({
                state, actions, stats,
                endFrame: getReplayEndFrame(state),
                canStepBack: 0 < basisPointIndex,
                canStepForward: basisPointIndex < lastPointIndex(basisPlayer),
                hasOpponent: opponent !== undefined,
            })}

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

            <a
                href="#"
                key="btn-replay-back-select"
                datatest="btn-replay-back-select"
                style={style({
                    color: '#777', display: 'block', fontSize: px(12), marginTop: px(10),
                })}
                onclick={(e: MouseEvent) => {
                    e.preventDefault();
                    actions.backToReplaySelect();
                }}
            >
                {i18n.Replay.Playing.BackToSelect()}
            </a>
        </div>
    );
};

export const view: View<State, Actions> = (state, actions) => {
    const phase = state.replay.phase;
    const body = phase === 'parsing' ? parsingPhase()
        : phase === 'select' && state.replay.ir !== undefined ? selectPhase(state, actions)
        : phase === 'playing' && getSelfPlayerRound(state) !== undefined ? playingPhase(state, actions)
        : importPhase(state, actions);

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
            {body}
        </div>
    );
};

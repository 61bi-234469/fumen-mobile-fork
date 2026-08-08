import { h } from 'hyperapp';
import { Actions } from '../../actions';
import { AnimationState } from '../../lib/enums';
import { px, style } from '../../lib/types';
import { i18n } from '../../locales/keys';
import { ReplaySpeed, ReplayStepBasis, REPLAY_SPEEDS, State } from '../../states';
import { formatFrameTime, ReplayStats } from '../../lib/ttrm/timeline';
import { PlayerRoundIR } from '../../lib/ttrm/types';
import { MARKER_BAND_HEIGHT, renderReplayTimelineMarkers } from './replay_timeline_markers';

const ACCENT = '#00796b';

const transportButton = (
    keyName: string, icon: string, disabled: boolean, onclick: () => void,
) => (
    <a
        href="#"
        key={keyName}
        datatest={keyName}
        className={`btn-flat ${disabled ? 'disabled' : ''}`}
        style={style({ padding: '0 8px' })}
        onclick={(e: MouseEvent) => {
            e.preventDefault();
            if (!disabled) {
                onclick();
            }
        }}
    >
        <i className="material-icons">{icon}</i>
    </a>
);

const basisButton = (
    keyName: string, label: string, active: boolean, disabled: boolean, onclick: () => void,
) => (
    <a
        href="#"
        key={keyName}
        datatest={keyName}
        className={`btn-flat ${disabled ? 'disabled' : ''}`}
        style={style({
            border: active ? `2px solid ${ACCENT}` : '1px solid #ccc',
            borderRadius: px(4),
            color: active ? ACCENT : '#555',
            fontSize: px(12),
            fontWeight: active ? 'bold' : 'normal',
            lineHeight: px(24),
            padding: '0 10px',
            textTransform: 'none',
        })}
        onclick={(e: MouseEvent) => {
            e.preventDefault();
            if (!disabled) {
                onclick();
            }
        }}
    >
        {label}
    </a>
);

interface ReplayTransportProps {
    state: State;
    actions: Actions;
    stats: ReplayStats;
    endFrame: number;
    canStepBack: boolean;
    canStepForward: boolean;
    hasOpponent: boolean;
    // ガベージ表示がオンのときだけ渡す。☢ の統計とマーカー帯の両方がこれで決まる
    garbagePlayer?: PlayerRoundIR;
    // タイムラインの実幅は取れないので、レイアウトが決めた最大幅を使う
    markerWidth: number;
}

// タイムライン、再生／一時停止、速度、基準切り替え、手番送りをまとめて持つ（FR-22/23/25/26/27）。
export const replayTransport = (
    {
        state, actions, stats, endFrame, canStepBack, canStepForward, hasOpponent,
        garbagePlayer, markerWidth,
    }: ReplayTransportProps,
) => {
    const { cursor, playback } = state.replay;
    const playing = playback.status === AnimationState.Play;
    const basis: ReplayStepBasis = hasOpponent ? cursor.stepBasis : 'self';

    return (
        <div key="replay-transport" datatest="replay-transport">
            <div
                key="replay-stats"
                datatest="replay-stats"
                style={style({
                    color: '#555',
                    display: 'flex',
                    flexWrap: 'wrap',
                    fontSize: px(12),
                    gap: px(10),
                    justifyContent: 'center',
                    margin: '6px 0',
                })}
            >
                {/* pps / apm / B2B / REN は盤面の左（HOLD 列）へ移した */}
                <span key="stat-attack">↑ {stats.attack}</span>
                {/* ☢ は TETR.IO の集計ではなくエンジン基準であることを示す印（§3-8） */}
                {garbagePlayer !== undefined ? (
                    <span key="stat-gauge" datatest="replay-stat-gauge">☢ {stats.gauge}</span>
                ) : undefined}
                {garbagePlayer !== undefined ? (
                    <span key="stat-tanked" datatest="replay-stat-tanked">☢↓ {stats.tanked}</span>
                ) : undefined}
            </div>

            <input
                key="replay-timeline"
                datatest="replay-timeline"
                type="range"
                min="0"
                max={String(Math.max(1, endFrame))}
                step="1"
                value={String(Math.round(cursor.frame))}
                aria-label={i18n.Replay.Playing.Timeline()}
                style={style({ display: 'block', margin: '0', width: '100%' })}
                oninput={(e: Event) => {
                    actions.seekReplayFrame({ frame: Number((e.target as HTMLInputElement).value) });
                }}
            />

            {/* 被弾＝赤 / 相殺＝緑。受信は描かない（§7-4）。設置マーカーは 1.7px 間隔に
                なって帯にしか見えないため対象外（§2） */}
            {garbagePlayer !== undefined ? (
                <img
                    key="replay-garbage-markers"
                    datatest="replay-garbage-markers"
                    src={renderReplayTimelineMarkers(garbagePlayer, markerWidth, endFrame)}
                    alt=""
                    style={style({
                        display: 'block',
                        height: px(MARKER_BAND_HEIGHT),
                        width: '100%',
                    })}
                />
            ) : undefined}

            <div
                key="replay-time-label"
                datatest="replay-time-label"
                style={style({
                    color: '#777',
                    display: 'flex',
                    fontSize: px(12),
                    justifyContent: 'space-between',
                })}
            >
                <span key="time-current">{formatFrameTime(cursor.frame)}</span>
                <span key="time-total">{formatFrameTime(endFrame)}</span>
            </div>

            <div
                key="replay-controls"
                style={style({
                    alignItems: 'center', display: 'flex', justifyContent: 'center', marginBottom: px(4),
                })}
            >
                {transportButton('btn-replay-first', 'first_page', !canStepBack, actions.replayFirstLock)}
                {transportButton('btn-replay-prev-lock', 'chevron_left', !canStepBack,
                                 () => actions.stepReplayLock({ step: -1 }))}
                {transportButton('btn-replay-play-pause', playing ? 'pause' : 'play_arrow', false,
                                 actions.toggleReplayPlayback)}
                {transportButton('btn-replay-next-lock', 'chevron_right', !canStepForward,
                                 () => actions.stepReplayLock({ step: 1 }))}
                {transportButton('btn-replay-last', 'last_page', !canStepForward, actions.replayLastLock)}

                <select
                    key="replay-speed-select"
                    datatest="replay-speed-select"
                    aria-label={i18n.Replay.Playing.Speed()}
                    value={String(playback.speed)}
                    style={style({
                        border: '1px solid #ccc',
                        borderRadius: px(4),
                        display: 'block',
                        fontSize: px(12),
                        height: px(28),
                        marginLeft: px(6),
                        padding: '0 4px',
                        width: px(64),
                    })}
                    onchange={(e: Event) => {
                        const speed = Number((e.target as HTMLSelectElement).value) as ReplaySpeed;
                        actions.setReplaySpeed({ speed });
                    }}
                >
                    {REPLAY_SPEEDS.map(speed => (
                        <option key={`replay-speed-${speed}`} value={String(speed)}>x{speed}</option>
                    ))}
                </select>
            </div>

            {hasOpponent ? (
                <div
                    key="replay-basis"
                    style={style({
                        alignItems: 'center', display: 'flex', fontSize: px(12),
                        gap: px(6), justifyContent: 'center', marginBottom: px(8),
                    })}
                >
                    <span key="basis-label" style={style({ color: '#777' })}>
                        {i18n.Replay.Playing.Basis()}
                    </span>
                    {basisButton('btn-replay-basis-self', i18n.Replay.Playing.Self(),
                                 basis === 'self', false,
                                 () => actions.setReplayStepBasis({ basis: 'self' }))}
                    {basisButton('btn-replay-basis-opponent', i18n.Replay.Playing.Opponent(),
                                 basis === 'opponent', false,
                                 () => actions.setReplayStepBasis({ basis: 'opponent' }))}
                </div>
            ) : undefined}
        </div>
    );
};

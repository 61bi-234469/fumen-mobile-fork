import { h } from 'hyperapp';
import { FieldConstants } from '../../lib/enums';
import { px, style } from '../../lib/types';
import { i18n } from '../../locales/keys';
import { ReplayGarbageView } from '../../lib/ttrm/garbage';

// replay_side.tsx の ReplaySideVariant / ReplaySideSize と同じ意味。
// replay_side がこのファイルを取り込むため、逆向きの import は張らない。
export type ReplayGaugeVariant = 'self' | 'opponent';
export type ReplayGaugeSize = 'full' | 'compact';

// P3 §3-5。ガベージのゲージバー（縦）とせり上がり予告行。
// どちらも DOM のまま描く。要素数が 10 数個で、値が変わったときだけ属性が
// 書き換わるので canvas にする理由がない（§4-4）。
//
// 予告行は盤面 canvas には描かない。replay_board.ts のメモ化は盤面配列の参照を
// キーにしており、「同じ盤面・違う時刻」で予告が変わると嘘をつくため（§3-5 の警告）。

// replay_layout.ts が盤面幅を決めるときに差し引く予約幅。
export const GAUGE_COLUMN_WIDTH_FULL = 14;
export const GAUGE_COLUMN_WIDTH_COMPACT = 8;

const NORMAL_COLOR = '#e53935';
const OVER_CAP_COLOR = '#ef6c00';
const RISE_FILL_COLOR = '#b0bec5';
const RISE_HOLE_COLOR = '#fbfcfd';

export const gaugeColumnWidth = (size: ReplayGaugeSize): number =>
    size === 'full' ? GAUGE_COLUMN_WIDTH_FULL : GAUGE_COLUMN_WIDTH_COMPACT;

interface ReplayGaugeProps {
    variant: ReplayGaugeVariant;
    size: ReplayGaugeSize;
    garbage: ReplayGarbageView;
    // 盤面の高さ。バーは盤面に密着させるので同じ寸法にする。
    boardHeight: number;
}

// FR-40。満尺は max(garbagecap, その時点までの最大ゲージ)。固定 8 だと稀に振り切れ、
// 固定 18 だと普段が細すぎるため 2 段構えにする（§3-5）。
// ゲージ 0 でも枠は残す ―― 出たり消えたりすると盤面位置が横にずれる。
export const replayGauge = ({ variant, size, garbage, boardHeight }: ReplayGaugeProps) => {
    const columnWidth = gaugeColumnWidth(size);
    const barWidth = size === 'full' ? 7 : 5;
    const scale = Math.max(garbage.cap, garbage.maxGauge, 1);
    const filled = Math.min(garbage.gauge, scale);
    const normalRows = Math.min(filled, garbage.cap);
    const overRows = Math.max(0, filled - garbage.cap);
    const rowHeight = boardHeight / scale;

    return (
        <div
            key={`replay-gauge-${variant}`}
            datatest={`replay-gauge-${variant}`}
            data-gauge={String(garbage.gauge)}
            aria-label={i18n.Replay.Playing.Gauge()}
            style={style({
                alignItems: 'center',
                display: 'flex',
                flexDirection: 'column',
                width: px(columnWidth),
            })}
        >
            <div
                key={`replay-gauge-${variant}-bar`}
                style={style({
                    backgroundColor: '#eceff1',
                    border: '1px solid #b0bec5',
                    display: 'flex',
                    flexDirection: 'column',
                    height: px(boardHeight),
                    justifyContent: 'flex-end',
                    width: px(barWidth),
                })}
            >
                {0 < overRows ? (
                    <div
                        key={`replay-gauge-${variant}-over`}
                        style={style({
                            backgroundColor: OVER_CAP_COLOR,
                            height: px(overRows * rowHeight),
                            width: '100%',
                        })}
                    />
                ) : undefined}
                {0 < normalRows ? (
                    <div
                        key={`replay-gauge-${variant}-fill`}
                        style={style({
                            backgroundColor: NORMAL_COLOR,
                            height: px(normalRows * rowHeight),
                            width: '100%',
                        })}
                    />
                ) : undefined}
            </div>
            <div
                key={`replay-gauge-${variant}-value`}
                style={style({
                    color: 0 < garbage.gauge ? NORMAL_COLOR : '#9e9e9e',
                    fontSize: px(size === 'full' ? 11 : 9),
                    lineHeight: px(13),
                })}
            >
                {garbage.gauge}
            </div>
        </div>
    );
};

interface ReplayRisePreviewProps {
    variant: ReplayGaugeVariant;
    size: ReplayGaugeSize;
    garbage: ReplayGarbageView;
    boardWidth: number;
}

// FR-42 / 43。1 行ぶんだけ描き、残数は数値で添える。複数行の穴位置を全部並べる案は
// モバイル幅で読めないため採らない（§7-4）。
export const replayRisePreview = (
    { variant, size, garbage, boardWidth }: ReplayRisePreviewProps,
) => {
    const rise = garbage.rise;
    if (rise === undefined) {
        return undefined;
    }
    const isSelf = variant === 'self';
    const previewKey = isSelf ? 'replay-rise-preview' : 'replay-rise-preview-opponent';
    const holeKey = isSelf ? 'replay-rise-hole' : 'replay-rise-hole-opponent';
    // 段数はバーの中に重ねて書く。行の高さは文字が収まる分だけ確保する。
    const fontSize = size === 'full' ? 10 : 8;
    const cellHeight = size === 'full' ? 14 : 10;
    // 白い穴セルがせり上がり対象なので、その先頭セルに段数を表示する。
    const labelColumn = rise.column;

    // 幅は盤面画像と同じ規則で決まるよう flex で等分する。個別に px を振ると
    // 盤面側の枠線ぶんとずれる。
    const cells = [];
    for (let x = 0; x < FieldConstants.Width; x += 1) {
        const isHole = rise.column <= x && x < rise.column + rise.size;
        cells.push(
            <div
                key={`${previewKey}-cell-${x}`}
                datatest={isHole ? holeKey : undefined}
                data-column={isHole ? String(x) : undefined}
                style={style({
                    alignItems: 'center',
                    backgroundColor: isHole ? RISE_HOLE_COLOR : RISE_FILL_COLOR,
                    borderRight: x < FieldConstants.Width - 1 ? '1px solid #90a4ae' : 'none',
                    color: '#37474f',
                    display: 'flex',
                    flex: '1 1 0',
                    fontSize: px(fontSize),
                    height: px(cellHeight),
                    justifyContent: 'center',
                    lineHeight: px(cellHeight),
                    whiteSpace: 'nowrap',
                })}
            >
                {x === labelColumn ? (
                    <span
                        key={`${previewKey}-label`}
                        datatest={`${previewKey}-label`}
                        data-column={String(labelColumn)}
                    >
                        {`+${garbage.moreRows}`}
                    </span>
                ) : undefined}
            </div>,
        );
    }

    return (
        <div
            key={previewKey}
            datatest={previewKey}
            data-hole-column={String(rise.column)}
            style={style({
                alignItems: 'flex-start',
                display: 'flex',
                flexDirection: 'column',
                marginTop: px(2),
                width: px(boardWidth),
            })}
        >
            <div
                key={`${previewKey}-row`}
                style={style({
                    border: '1px solid #90a4ae',
                    display: 'flex',
                    width: px(boardWidth),
                })}
            >
                {cells}
            </div>
        </div>
    );
};

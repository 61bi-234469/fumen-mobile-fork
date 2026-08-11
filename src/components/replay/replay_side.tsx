import { h, VNode } from 'hyperapp';
import { FieldConstants, parsePieceName, Piece } from '../../lib/enums';
import { decidePieceColor } from '../../lib/colors';
import { paletteMinoImageSrc } from '../../lib/editor_interaction';
import { px, style } from '../../lib/types';
import { i18n } from '../../locales/keys';
import { HighlightType } from '../../state_types';
import { GRID_GAP, renderReplayBoard } from './replay_board';
import { gaugeColumnWidth, replayGauge, replayRisePreview } from './replay_gauge';
import { ReplayPoint, ReplayStats } from '../../lib/ttrm/timeline';
import { ReplayGarbageView } from '../../lib/ttrm/garbage';
import { ReplayActiveFrame, ReplayVisualState } from '../../lib/ttrm/types';

// HOLD / NEXT はエディタのパレットと同じミノ SVG（約2:1の横長）で表示する。
// 列幅は Editor の INPUT レイアウトと同じ「盤面 3.4 マス」基準（responsive_layout.ts の
// PIECE_QUEUE_COLUMN_UNITS）で決める。固定 34px だと盤面に対して小さすぎた。
export const REPLAY_QUEUE_COLUMN_UNITS = 3.4;
export const MIN_REPLAY_QUEUE_WIDTH = 34;
export const MAX_REPLAY_QUEUE_WIDTH = 96;
// 盤面と HOLD / NEXT 列の間隔
export const REPLAY_QUEUE_GAP = 10;

export const replayQueueColumnWidth = (blockSize: number): number => Math.min(
    MAX_REPLAY_QUEUE_WIDTH,
    Math.max(MIN_REPLAY_QUEUE_WIDTH, Math.round(blockSize * REPLAY_QUEUE_COLUMN_UNITS)),
);

// variant は「どちらのプレイヤーか」（datatest 接頭辞と FR-31 の制限）、
// size は「どう描くか」（P2 §4-1）。
// full: 縦列 HOLD 1 ＋ NEXT 5。自陣は常にこちら。PC では相手も同じ。
// compact: 盤面の上に横並びで HOLD 1 ＋ NEXT 3。モバイルの相手側だけ。
export type ReplaySideVariant = 'self' | 'opponent';
export type ReplaySideSize = 'full' | 'compact';

const FULL_NEXT_COUNT = 5;
const COMPACT_NEXT_COUNT = 3;

const pieceSlot = (
    piece: Piece | null, keyName: string, guideLineColor: boolean, slotWidth: number,
) => (
    <div
        key={keyName}
        datatest={keyName}
        data-piece={piece !== null ? parsePieceName(piece) : 'none'}
        style={style({
            alignItems: 'center',
            display: 'flex',
            height: px(slotWidth / 2),
            justifyContent: 'center',
            width: px(slotWidth),
        })}
    >
        {piece !== null ? (
            <img
                key={`${keyName}-img`}
                src={paletteMinoImageSrc(piece, guideLineColor)}
                alt={parsePieceName(piece) ?? ''}
                style={style({
                    display: 'block',
                    maxHeight: '100%',
                    maxWidth: '100%',
                    objectFit: 'contain',
                })}
            />
        ) : undefined}
    </div>
);

const queueColumn = (
    keyName: string, label: string, pieces: (Piece | null)[], guideLineColor: boolean,
    slotWidth: number, footer?: (VNode<{}> | undefined)[],
) => (
    <div
        key={keyName}
        style={style({
            display: 'flex', flexDirection: 'column', textAlign: 'left', width: px(slotWidth),
        })}
    >
        <div key={`${keyName}-label`} style={style({ color: '#777', fontSize: px(10) })}>{label}</div>
        {pieces.map((piece, index) => (
            <div key={`${keyName}-slot-${index}`} style={style({ marginBottom: px(3) })}>
                {pieceSlot(piece, `${keyName}-${index}`, guideLineColor, slotWidth)}
            </div>
        ))}
        {footer}
    </div>
);

// HOLD 列に添える行。B2B / Combo / ライン消去と pps / apm を同じ幅で縦に積む。
const infoLine = (keyName: string, text: string, color: string, fontSize: number) => (
    <div
        key={keyName}
        style={style({
            color, fontSize: px(fontSize), lineHeight: px(fontSize + 4), whiteSpace: 'nowrap',
        })}
    >
        {text}
    </div>
);

const clearLines = (
    keyPrefix: string, stats: ReplayStats, clearText: string | undefined, font: number,
) => [
    infoLine(`${keyPrefix}-b2b`, `B2B ${stats.b2b}`, 0 < stats.b2b ? '#00796b' : '#9e9e9e', font),
    infoLine(`${keyPrefix}-combo`, `Combo ${stats.ren}`, 0 < stats.ren ? '#00796b' : '#9e9e9e', font),
    infoLine(`${keyPrefix}-clear`, clearText !== undefined ? clearText : '', '#e65100', font),
];

const statsLines = (keyPrefix: string, stats: ReplayStats, font: number) => [
    infoLine(`${keyPrefix}-pps`, `${stats.pps.toFixed(1)} pps`, '#555', font),
    infoLine(`${keyPrefix}-apm`, `${Math.round(stats.apm)} apm`, '#555', font),
];

// 相手側の HOLD / NEXT。盤面幅に収めるため 1 行に並べる。
const queueRow = (
    keyName: string, pieces: (Piece | null)[], guideLineColor: boolean, slotWidth: number,
) => (
    <div
        key={keyName}
        style={style({ display: 'flex', gap: px(2), justifyContent: 'flex-start' })}
    >
        {pieces.map((piece, index) => pieceSlot(
            piece, `${keyName}-${index}`, guideLineColor, slotWidth))}
    </div>
);

interface ReplaySideProps {
    variant: ReplaySideVariant;
    size: ReplaySideSize;
    point: ReplayPoint;
    visual: ReplayVisualState;
    blockSize: number;
    guideLineColor: boolean;
    label: string;
    counterText: string;
    // PC レイアウトでのみ盤面の上に出すプレイヤー名（§3-6-2）
    heading?: string;
    // P3。ガベージ表示がオフのときは undefined（枠ごと出さない）
    garbage?: ReplayGarbageView;
    // HOLD / NEXT の列幅（盤面 3.4 マス基準）。レイアウトが盤面と一緒に決める
    queueWidth: number;
    // HOLD の下に出す B2B / Combo / pps / apm。自陣と相手で同じ並びにする
    stats: ReplayStats;
    // 直近の設置で消えたライン（Quad / TSD など）。消していないときは undefined
    clearText?: string;
}

export const visibleReplayActiveCells = (
    active: ReplayActiveFrame | undefined,
): [number, number][] => active === undefined ? [] : active.cells.filter(
    ([x, y]) => 0 <= x && x < FieldConstants.Width && 0 <= y && y < FieldConstants.Height,
);

const replayActiveOverlay = (
    variant: ReplaySideVariant,
    active: ReplayActiveFrame | undefined,
    blockSize: number,
    guideLineColor: boolean,
) => {
    if (active === undefined) {
        return undefined;
    }
    const cells = visibleReplayActiveCells(active);
    return (
        <div
            key={`replay-active-${variant}`}
            datatest={`replay-active-${variant}`}
            data-active-piece={parsePieceName(active.piece)}
            data-active-cells={JSON.stringify(active.cells)}
            style={style({
                height: px(blockSize * FieldConstants.Height),
                left: px(0),
                pointerEvents: 'none',
                position: 'absolute',
                top: px(0),
                width: px(blockSize * FieldConstants.Width),
                zIndex: 1,
            })}
        >
            {cells.map(([x, y], index) => (
                <span
                    key={`replay-active-${variant}-${index}`}
                    datatest={`replay-active-${variant}-cell`}
                    data-cell={`${x},${y}`}
                    style={style({
                        // 操作中ミノは Editor / サムネイル / GIF と同じ Highlight2。
                        // 寸法は盤面 canvas と同じ GRID_GAP で描いて格子に乗せる
                        // ―― 枠や大きさで差を付けると、盤面から浮いて見える。
                        backgroundColor: decidePieceColor(
                            active.piece, HighlightType.Highlight2, guideLineColor),
                        height: px(blockSize - GRID_GAP),
                        left: px(x * blockSize),
                        position: 'absolute',
                        top: px((FieldConstants.Height - 1 - y) * blockSize),
                        width: px(blockSize - GRID_GAP),
                    })}
                />
            ))}
        </div>
    );
};

// 1 プレイヤーぶんの「盤面＋HOLD/NEXT＋手番ラベル」。
// 相手側には切り捨てチップも Editor ボタンも出さない（FR-31）。切り捨ては行数だけ添える。
export const replaySide = (
    {
        variant, size, point, visual, blockSize, guideLineColor, label, counterText, heading, garbage,
        queueWidth, stats, clearText,
    }: ReplaySideProps,
) => {
    const isSelf = variant === 'self';
    const boardImage = renderReplayBoard(visual.field, blockSize, guideLineColor);
    // visual timelineではactiveが操作中ミノなのでNEXTへ重ねない。visualを持たない
    // 既存IRではactiveが無く、従来どおりcurrentをNEXT先頭として表示する。
    const nextPieces: (Piece | null)[] = [
        ...(visual.active === undefined && visual.current !== null ? [visual.current] : []),
        ...visual.next,
    ]
        .slice(0, size === 'full' ? FULL_NEXT_COUNT : COMPACT_NEXT_COUNT);
    // datatest は variant だけで決まる。size を変えても名前は変わらない。
    const holdKey = isSelf ? 'replay-hold' : 'replay-opponent-hold';
    const nextKey = isSelf ? 'replay-next' : 'replay-opponent-next';
    const boardWidth = blockSize * FieldConstants.Width;
    const boardHeight = blockSize * FieldConstants.Height;
    const board = (
        <div
            key={`replay-board-layer-${variant}`}
            style={style({ position: 'relative', width: px(boardWidth) })}
        >
            <img
                key={`replay-board-${variant}`}
                datatest={`replay-board-${variant}`}
                src={boardImage}
                alt="board"
                data-point-index={String(point.index)}
                data-visual-frame={String(visual.frame)}
                style={style({
                    // 枠は outline で描く。border だと materialize の box-sizing: border-box が
                    // canvas を 2px 縮めて描画し、絶対配置の操作中ミノと格子がずれる。
                    outline: '1px solid #90a4ae',
                    display: 'block',
                    // canvas は 2 倍解像度で描くので、表示サイズは明示して等倍に戻す
                    height: px(boardHeight),
                    width: px(boardWidth),
                })}
            />
            {replayActiveOverlay(variant, visual.active, blockSize, guideLineColor)}
        </div>
    );

    // ゲージバーは盤面の左端に密着（TETR.IO と同じ位置）、せり上がり予告はそのすぐ下。
    // 予告行は盤面 canvas ではなく DOM の別要素として置く（§3-5 の警告）。
    const boardBlock = (
        <div
            key={`replay-board-block-${variant}`}
            style={style({
                alignItems: 'flex-start', display: 'flex', gap: px(2), justifyContent: 'flex-start',
            })}
        >
            {garbage !== undefined
                ? replayGauge({ variant, size, garbage, boardHeight, rowHeight: blockSize })
                : undefined}
            <div
                key={`replay-board-stack-${variant}`}
                style={style({ display: 'flex', flexDirection: 'column', width: px(boardWidth) })}
            >
                {board}
                {garbage !== undefined
                    ? replayRisePreview({ variant, size, garbage, boardWidth })
                    : undefined}
            </div>
        </div>
    );
    const gaugeWidth = garbage !== undefined ? gaugeColumnWidth(size) + 2 : 0;

    const headingLine = heading !== undefined ? (
        <div
            key={`replay-side-${variant}-heading`}
            style={style({ color: '#777', fontSize: px(12) })}
        >
            {heading}
        </div>
    ) : undefined;

    // 相手の手番カウンタ。full / compact のどちらでも盤面の下に 1 つだけ置く。
    const opponentFooter = !isSelf ? [
        <div
            key="replay-opponent-counter"
            datatest="replay-opponent-counter"
            style={style({ color: '#777', fontSize: px(11) })}
        >
            {label} {counterText}
        </div>,
        visual.clippedRowCount > 0 ? (
            <div
                key="replay-opponent-clip"
                datatest="replay-opponent-clip"
                style={style({ color: '#e65100', fontSize: px(10) })}
            >
                {i18n.Replay.Playing.ClipNotice(visual.clippedRowCount)}
            </div>
        ) : undefined,
    ] : undefined;

    // ライン消去と pps / apm は盤面の左（HOLD 列）に置く。HOLD の直下がライン消去、
    // 列の一番下が pps / apm。Editor の INPUT レイアウトと同じ並びにする。
    const infoKey = isSelf ? 'replay-info' : 'replay-opponent-info';
    const statsKey = isSelf ? 'replay-side-stats' : 'replay-opponent-side-stats';

    if (size === 'full') {
        const holdFooter = [
            <div
                key={`${infoKey}-clear`}
                datatest={infoKey}
                style={style({ marginTop: px(2) })}
            >
                {clearLines(infoKey, stats, clearText, 11)}
            </div>,
            <div
                key={`${statsKey}-block`}
                datatest={statsKey}
                style={style({ marginTop: 'auto', paddingBottom: px(2) })}
            >
                {statsLines(statsKey, stats, 12)}
            </div>,
        ];

        return (
            <div
                key={`replay-side-${variant}`}
                datatest={`replay-side-${variant}`}
                style={style({
                    alignItems: 'center', display: 'flex', flexDirection: 'column', gap: px(3),
                })}
            >
                {headingLine}
                <div
                    key={`replay-side-${variant}-body`}
                    style={style({
                        alignItems: 'stretch', display: 'flex', gap: px(REPLAY_QUEUE_GAP),
                        justifyContent: 'center',
                    })}
                >
                    {queueColumn(holdKey, i18n.Replay.Playing.Hold(), [visual.hold], guideLineColor,
                                 queueWidth, holdFooter)}
                    {boardBlock}
                    {queueColumn(nextKey, i18n.Replay.Playing.Next(), nextPieces, guideLineColor,
                                 queueWidth)}
                </div>
                {opponentFooter}
            </div>
        );
    }

    const slotWidth = Math.max(14, Math.floor(boardWidth / 5));
    return (
        <div
            key={`replay-side-${variant}`}
            datatest={`replay-side-${variant}`}
            style={style({
                display: 'flex', flexDirection: 'column', gap: px(3),
                textAlign: 'left', width: px(boardWidth + gaugeWidth),
            })}
        >
            {headingLine}
            <div
                key="replay-opponent-queues"
                style={style({ display: 'flex', gap: px(6), justifyContent: 'space-between' })}
            >
                {queueRow(holdKey, [visual.hold], guideLineColor, slotWidth)}
                {queueRow(nextKey, nextPieces, guideLineColor, slotWidth)}
            </div>
            {boardBlock}
            {/* compact には縦列が無いので、同じ内容を盤面の下に 1 行で置く */}
            <div
                key={`${infoKey}-row`}
                datatest={infoKey}
                style={style({
                    display: 'flex', flexWrap: 'wrap', gap: px(6), justifyContent: 'flex-start',
                })}
            >
                {clearLines(infoKey, stats, clearText, 10)}
            </div>
            <div
                key={`${statsKey}-row`}
                datatest={statsKey}
                style={style({
                    display: 'flex', flexWrap: 'wrap', gap: px(6), justifyContent: 'flex-start',
                })}
            >
                {statsLines(statsKey, stats, 10)}
            </div>
            {opponentFooter}
        </div>
    );
};

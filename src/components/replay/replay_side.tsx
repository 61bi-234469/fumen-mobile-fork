import { h } from 'hyperapp';
import { FieldConstants, parsePieceName, Piece } from '../../lib/enums';
import { paletteMinoImageSrc } from '../../lib/editor_interaction';
import { px, style } from '../../lib/types';
import { i18n } from '../../locales/keys';
import { renderReplayBoard } from './replay_board';
import { gaugeColumnWidth, replayGauge, replayRisePreview } from './replay_gauge';
import { ReplayPoint } from '../../lib/ttrm/timeline';
import { ReplayGarbageView } from '../../lib/ttrm/garbage';

// HOLD / NEXT はエディタのパレットと同じミノ SVG（約2:1の横長）で表示する。
export const MINO_SLOT_WIDTH = 34;

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
) => (
    <div key={keyName} style={style({ width: px(MINO_SLOT_WIDTH) })}>
        <div key={`${keyName}-label`} style={style({ color: '#777', fontSize: px(10) })}>{label}</div>
        {pieces.map((piece, index) => (
            <div key={`${keyName}-slot-${index}`} style={style({ marginBottom: px(3) })}>
                {pieceSlot(piece, `${keyName}-${index}`, guideLineColor, MINO_SLOT_WIDTH)}
            </div>
        ))}
    </div>
);

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
    blockSize: number;
    guideLineColor: boolean;
    label: string;
    counterText: string;
    // PC レイアウトでのみ盤面の上に出すプレイヤー名（§3-6-2）
    heading?: string;
    // P3。ガベージ表示がオフのときは undefined（枠ごと出さない）
    garbage?: ReplayGarbageView;
}

// 1 プレイヤーぶんの「盤面＋HOLD/NEXT＋手番ラベル」。
// 相手側には切り捨てチップも Editor ボタンも出さない（FR-31）。切り捨ては行数だけ添える。
export const replaySide = (
    {
        variant, size, point, blockSize, guideLineColor, label, counterText, heading, garbage,
    }: ReplaySideProps,
) => {
    const isSelf = variant === 'self';
    const boardImage = renderReplayBoard(point.field, blockSize, guideLineColor);
    // 設置直後に操作対象となっているミノは NEXT の先頭に並べる。
    // Editor へ引き渡す quiz でもこのミノがカレントになる。
    const nextPieces: (Piece | null)[] = [point.current, ...point.next]
        .slice(0, size === 'full' ? FULL_NEXT_COUNT : COMPACT_NEXT_COUNT);
    // datatest は variant だけで決まる。size を変えても名前は変わらない。
    const holdKey = isSelf ? 'replay-hold' : 'replay-opponent-hold';
    const nextKey = isSelf ? 'replay-next' : 'replay-opponent-next';
    const boardWidth = blockSize * FieldConstants.Width;
    const boardHeight = blockSize * FieldConstants.Height;
    const board = (
        <img
            key={`replay-board-${variant}`}
            datatest={`replay-board-${variant}`}
            src={boardImage}
            alt="board"
            data-point-index={String(point.index)}
            style={style({
                border: '1px solid #90a4ae',
                display: 'block',
                // canvas は 2 倍解像度で描くので、表示サイズは明示して等倍に戻す
                height: px(boardHeight),
                width: px(boardWidth),
            })}
        />
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
                ? replayGauge({ variant, size, garbage, boardHeight })
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
        point.clippedRowCount > 0 ? (
            <div
                key="replay-opponent-clip"
                datatest="replay-opponent-clip"
                style={style({ color: '#e65100', fontSize: px(10) })}
            >
                {i18n.Replay.Playing.ClipNotice(point.clippedRowCount)}
            </div>
        ) : undefined,
    ] : undefined;

    if (size === 'full') {
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
                        alignItems: 'flex-start', display: 'flex', gap: px(10), justifyContent: 'center',
                    })}
                >
                    {queueColumn(holdKey, i18n.Replay.Playing.Hold(), [point.hold], guideLineColor)}
                    {boardBlock}
                    {queueColumn(nextKey, i18n.Replay.Playing.Next(), nextPieces, guideLineColor)}
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
                {queueRow(holdKey, [point.hold], guideLineColor, slotWidth)}
                {queueRow(nextKey, nextPieces, guideLineColor, slotWidth)}
            </div>
            {boardBlock}
            {opponentFooter}
        </div>
    );
};

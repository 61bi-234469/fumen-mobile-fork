import { h } from 'hyperapp';
import { FieldConstants, parsePieceName, Piece } from '../../lib/enums';
import { paletteMinoImageSrc } from '../../lib/editor_interaction';
import { px, style } from '../../lib/types';
import { i18n } from '../../locales/keys';
import { renderReplayBoard } from './replay_board';
import { ReplayPoint } from '../../lib/ttrm/timeline';

// HOLD / NEXT はエディタのパレットと同じミノ SVG（約2:1の横長）で表示する。
export const MINO_SLOT_WIDTH = 34;

// 自陣は縦列 5 件、相手は幅を食わないよう盤面の上に横並びの小アイコンで出す（P2 §3-6）。
export type ReplaySideVariant = 'self' | 'opponent';

const SELF_NEXT_COUNT = 5;
const OPPONENT_NEXT_COUNT = 3;

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
    point: ReplayPoint;
    blockSize: number;
    guideLineColor: boolean;
    label: string;
    counterText: string;
}

// 1 プレイヤーぶんの「盤面＋HOLD/NEXT＋手番ラベル」。
// 相手側には切り捨てチップも Editor ボタンも出さない（FR-31）。切り捨ては行数だけ添える。
export const replaySide = (
    { variant, point, blockSize, guideLineColor, label, counterText }: ReplaySideProps,
) => {
    const isSelf = variant === 'self';
    const boardImage = renderReplayBoard(point.field, blockSize, guideLineColor);
    // 設置直後に操作対象となっているミノは NEXT の先頭に並べる。
    // Editor へ引き渡す quiz でもこのミノがカレントになる。
    const nextPieces: (Piece | null)[] = [point.current, ...point.next]
        .slice(0, isSelf ? SELF_NEXT_COUNT : OPPONENT_NEXT_COUNT);
    const boardWidth = blockSize * FieldConstants.Width;
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
                height: px(blockSize * FieldConstants.Height),
                width: px(boardWidth),
            })}
        />
    );

    if (isSelf) {
        return (
            <div
                key="replay-side-self"
                datatest="replay-side-self"
                style={style({
                    alignItems: 'flex-start', display: 'flex', gap: px(10), justifyContent: 'center',
                })}
            >
                {queueColumn('replay-hold', i18n.Replay.Playing.Hold(), [point.hold], guideLineColor)}
                {board}
                {queueColumn('replay-next', i18n.Replay.Playing.Next(), nextPieces, guideLineColor)}
            </div>
        );
    }

    const slotWidth = Math.max(14, Math.floor(boardWidth / 5));
    return (
        <div
            key="replay-side-opponent"
            datatest="replay-side-opponent"
            style={style({
                display: 'flex', flexDirection: 'column', gap: px(3), width: px(boardWidth),
            })}
        >
            <div
                key="replay-opponent-queues"
                style={style({ display: 'flex', gap: px(6), justifyContent: 'space-between' })}
            >
                {queueRow('replay-opponent-hold', [point.hold], guideLineColor, slotWidth)}
                {queueRow('replay-opponent-next', nextPieces, guideLineColor, slotWidth)}
            </div>
            {board}
            <div
                key="replay-opponent-counter"
                datatest="replay-opponent-counter"
                style={style({ color: '#777', fontSize: px(11), textAlign: 'left' })}
            >
                {label} {counterText}
            </div>
            {point.clippedRowCount > 0 ? (
                <div
                    key="replay-opponent-clip"
                    datatest="replay-opponent-clip"
                    style={style({ color: '#e65100', fontSize: px(10), textAlign: 'left' })}
                >
                    {i18n.Replay.Playing.ClipNotice(point.clippedRowCount)}
                </div>
            ) : undefined}
        </div>
    );
};

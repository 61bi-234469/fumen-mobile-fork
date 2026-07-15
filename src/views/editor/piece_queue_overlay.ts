import { button, div, span } from '@hyperapp/html';
import { VNode } from 'hyperapp';
import { ColdClearMenuQueueState } from '../../actions/cold_clear';
import { decidePieceColor } from '../../lib/colors';
import { Piece } from '../../lib/enums';
import { getPieces } from '../../lib/piece';
import { pieceQueuePieceToChar } from '../../lib/piece_queue';
import { px, style } from '../../lib/types';
import { i18n } from '../../locales/keys';
import { HighlightType } from '../../state_types';

const NEXT_COUNT = 5;

const mino = (piece: Piece | undefined, width: number, key: string, guideLineColor: boolean) => {
    const height = Math.max(24, Math.min(38, width * .72));
    if (piece === undefined) {
        return div({
            key,
            style: style({
                alignItems: 'center',
                color: '#bdbdbd',
                display: 'flex',
                fontSize: px(13),
                height: px(height),
                justifyContent: 'center',
            }),
        }, '—');
    }

    const positions = getPieces(piece);
    const xs = positions.map(([x]) => x);
    const ys = positions.map(([, y]) => y);
    const minX = Math.min(...xs);
    const maxY = Math.max(...ys);
    const pieceWidth = Math.max(...xs) - minX + 1;
    const pieceHeight = maxY - Math.min(...ys) + 1;
    const blockSize = Math.max(4, Math.min(10,
        Math.floor((width - 10) / Math.max(4, pieceWidth)),
        Math.floor((height - 6) / pieceHeight)));
    const shapeWidth = pieceWidth * blockSize;
    const shapeHeight = pieceHeight * blockSize;
    const color = decidePieceColor(piece, HighlightType.Highlight1, guideLineColor);

    return div({
        key,
        style: style({
            height: px(height),
            position: 'relative',
        }),
    }, positions.map(([x, y], index) => div({
        key: `${key}-block-${index}`,
        style: style({
            background: color,
            border: '1px solid rgba(0, 0, 0, .22)',
            boxSizing: 'border-box',
            height: px(blockSize),
            left: px((width - shapeWidth) / 2 + (x - minX) * blockSize),
            position: 'absolute',
            top: px((height - shapeHeight) / 2 + (maxY - y) * blockSize),
            width: px(blockSize),
        }),
    })));
};

const queueButton = ({
    key,
    datatest,
    label,
    width,
    children,
    onclick,
    piece,
}: {
    key: string;
    datatest: string;
    label: string;
    width: number;
    children: VNode<{}>[];
    onclick: () => void;
    piece?: Piece;
}) => button({
    key,
    datatest,
    type: 'button',
    className: 'editor-control waves-effect',
    'aria-label': label,
    'data-piece': piece === undefined ? '' : pieceQueuePieceToChar(piece),
    onclick: (event: MouseEvent) => {
        onclick();
        event.preventDefault();
        event.stopPropagation();
    },
    style: style({
        background: '#fafafa',
        border: '1px solid #333',
        borderRadius: '0',
        boxShadow: '0 2px 5px rgba(0, 0, 0, .16)',
        boxSizing: 'border-box',
        color: '#333',
        cursor: 'pointer',
        display: 'block',
        flexShrink: 0,
        fontFamily: 'inherit',
        margin: '0',
        minWidth: '0',
        padding: '0',
        textAlign: 'center',
        width: px(width),
    }),
}, children);

const heading = (key: string, label: string) => div({
    key,
    style: style({
        alignItems: 'center',
        background: '#333',
        color: '#fff',
        display: 'flex',
        fontSize: px(9),
        fontWeight: '700',
        height: px(20),
        justifyContent: 'center',
        letterSpacing: '.06em',
    }),
}, label);

export const pieceQueueOverlays = ({
    queueState,
    width,
    gap,
    fieldHeight,
    guideLineColor,
    openSettings,
}: {
    queueState: ColdClearMenuQueueState | null;
    width: number;
    gap: number;
    fieldHeight: number;
    guideLineColor: boolean;
    openSettings: () => void;
}) => {
    const hold = queueState?.hold ?? undefined;
    const nexts = queueState?.queue.slice(0, NEXT_COUNT) ?? [];
    const openLabel = i18n.PieceQueue.OpenSettings();

    const holdPanel = div({
        key: 'piece-queue-hold-column',
        style: style({
            alignItems: 'flex-start',
            display: 'flex',
            flex: `0 0 ${px(width)}`,
            height: px(fieldHeight),
            marginRight: px(gap),
        }),
    }, [queueButton({
        width,
        key: 'piece-queue-hold',
        datatest: 'piece-queue-hold',
        label: openLabel,
        onclick: openSettings,
        piece: hold,
        children: [
            heading('piece-queue-hold-heading', i18n.PieceQueue.HoldLabel()),
            mino(hold, width, 'piece-queue-hold-piece', guideLineColor),
        ],
    })]);

    const nextRows = Array.from({ length: NEXT_COUNT }).map((_, index) => div({
        key: `piece-queue-next-row-${index}`,
        datatest: `piece-queue-next-${index}`,
        'data-piece': nexts[index] === undefined ? '' : pieceQueuePieceToChar(nexts[index]),
        style: style({
            borderTop: index === 0 ? '0' : '1px solid #e0e0e0',
        }),
    }, [
        mino(nexts[index], width, `piece-queue-next-piece-${index}`, guideLineColor),
        span({
            key: `piece-queue-next-order-${index}`,
            'aria-hidden': 'true',
            style: style({ display: 'none' }),
        }, String(index + 1)),
    ]));

    const nextPanel = div({
        key: 'piece-queue-next-column',
        style: style({
            alignItems: 'flex-start',
            display: 'flex',
            flex: `0 0 ${px(width)}`,
            height: px(fieldHeight),
            marginLeft: px(gap),
        }),
    }, [queueButton({
        width,
        key: 'piece-queue-next',
        datatest: 'piece-queue-next',
        label: openLabel,
        onclick: openSettings,
        children: [
            heading('piece-queue-next-heading', i18n.PieceQueue.NextLabel()),
            ...nextRows,
        ],
    })]);

    return { holdPanel, nextPanel };
};

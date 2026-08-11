import { FieldConstants, Piece } from '../../lib/enums';
import { decideBackgroundColor, decidePieceColor } from '../../lib/colors';
import { HighlightType } from '../../state_types';
import { IRField } from '../../lib/ttrm/types';

const RENDER_SCALE = 2;

// ブロック間の区切り。0.5 だと canvas 上では 1 ドットしか空かず、表示サイズへ
// 縮小される段階で隣のブロック色と混ざる（黒線ではなく「半分の明るさの同色」になる）。
// ディスプレイ倍率が整数でない環境ではどの境界が残るかも変わるため、必ず 1 CSS px 空ける。
// 操作中ミノのオーバーレイ（replay_side.tsx）も同じ値で描く。
export const GRID_GAP = 1;

// P2 §4-5: 自動再生のクロックは 20Hz で state を更新するため、素直に書くと
// 1 秒あたり 40 回（2 盤面）の PNG 生成になる。IR のフィールド配列は取り込み以降
// 参照が不変なので、WeakMap をキーにして「ポイントが変わった瞬間だけ」描き直す。
// IR ごと捨てれば自動的に解放される。
interface BoardMemo {
    blockSize: number;
    guideLineColor: boolean;
    url: string;
}

const boardMemo = new WeakMap<object, BoardMemo>();

// IRField（y=0が最下段）をサムネイルと同じ流儀でcanvasに描き、data URLで返す。
// Replay画面は読み取り専用なのでkonvaステージは使わない。
export const renderReplayBoard = (
    field: IRField,
    blockSize: number,
    guideLineColor: boolean,
): string => {
    const memo = boardMemo.get(field);
    if (memo !== undefined && memo.blockSize === blockSize && memo.guideLineColor === guideLineColor) {
        return memo.url;
    }

    const url = drawReplayBoard(field, blockSize, guideLineColor);
    if (url !== '') {
        boardMemo.set(field, { blockSize, guideLineColor, url });
    }
    return url;
};

const drawReplayBoard = (
    field: IRField,
    blockSize: number,
    guideLineColor: boolean,
): string => {
    const width = FieldConstants.Width * blockSize;
    const height = FieldConstants.Height * blockSize;
    const canvas = document.createElement('canvas');
    canvas.width = width * RENDER_SCALE;
    canvas.height = height * RENDER_SCALE;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        return '';
    }
    ctx.scale(RENDER_SCALE, RENDER_SCALE);

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);
    // Editorと同じく、フィールド上部3行は格子のない1枚の灰色帯として描く。
    ctx.fillStyle = decideBackgroundColor(20);
    ctx.fillRect(0, 0, width, blockSize * 3);

    for (let y = 0; y < FieldConstants.Height; y += 1) {
        for (let x = 0; x < FieldConstants.Width; x += 1) {
            const piece = field[x + y * FieldConstants.Width];
            if (piece === Piece.Empty && y >= 20) {
                continue;
            }
            ctx.fillStyle = piece === Piece.Empty
                ? decideBackgroundColor(y)
                : decidePieceColor(piece, HighlightType.Normal, guideLineColor);
            ctx.fillRect(
                x * blockSize,
                (FieldConstants.Height - 1 - y) * blockSize,
                blockSize - GRID_GAP,
                blockSize - GRID_GAP,
            );
        }
    }

    return canvas.toDataURL('image/png');
};

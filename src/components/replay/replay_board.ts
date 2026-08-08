import { FieldConstants, Piece } from '../../lib/enums';
import { decideBackgroundColor, decidePieceColor } from '../../lib/colors';
import { HighlightType } from '../../state_types';
import { IRField } from '../../lib/ttrm/types';

const RENDER_SCALE = 2;

// IRField（y=0が最下段）をサムネイルと同じ流儀でcanvasに描き、data URLで返す。
// Replay画面は読み取り専用なのでkonvaステージは使わない。
export const renderReplayBoard = (
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
                blockSize - 0.5,
                blockSize - 0.5,
            );
        }
    }

    return canvas.toDataURL('image/png');
};

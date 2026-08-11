import { h } from 'hyperapp';
import konva from 'konva';
import { Move } from '../lib/fumen/types';
import { getBlockPositions } from '../lib/piece';
import { decidePieceColor } from '../lib/colors';
import { HighlightType } from '../state_types';
import { Component } from '../lib/types';
import { pieceQueuePieceToChar } from '../lib/piece_queue';

interface Props {
    rects: konva.Rect[];
    move: Move | null;
    visible: boolean;
    topLeft: { x: number; y: number };
    blockSize: number;
    guideLineColor: boolean;
}

export const inputAiGuideBlockGeometry = (
    x: number,
    y: number,
    topLeft: { x: number; y: number },
    blockSize: number,
) => {
    const yField = 22 - y;
    return {
        position: {
            x: topLeft.x + x * (blockSize + 1) + 1,
            y: topLeft.y + Math.max(0, yField - .5) * blockSize + yField + 1,
        },
        size: {
            width: blockSize,
            height: yField === 0 ? blockSize / 2 : blockSize,
        },
    };
};

export const InputAiGuideOverlay: Component<Props> = ({
    rects, move, visible, topLeft, blockSize, guideLineColor,
}) => {
    const cells = move === null ? [] : getBlockPositions(
        move.type, move.rotation, move.coordinate.x, move.coordinate.y,
    );
    const valid = visible && move !== null && cells.length === 4
        && cells.every(([x, y]) => 0 <= x && x < 10 && 0 <= y && y < 23);
    const fill = move === null
        ? '#ffffff'
        : decidePieceColor(move.type, HighlightType.Highlight1, guideLineColor);
    const piece = move === null ? '' : pieceQueuePieceToChar(move.type);

    return <div>{...rects.map((rect, index) => {
        const cell = valid ? cells[index] : undefined;
        const geometry = cell === undefined
            ? { position: { x: 0, y: 0 }, size: { width: 0, height: 0 } }
            : inputAiGuideBlockGeometry(cell[0], cell[1], topLeft, blockSize);
        const update = () => {
            rect.position(geometry.position);
            rect.size(geometry.size);
            rect.fill(fill);
            if (cell === undefined) {
                rect.hide();
            } else {
                rect.show();
            }
        };
        return <param
            key={`input-ai-guide-block-${index}`}
            name="konva"
            value={`input-ai-guide-block-${index}`}
            datatest={`input-ai-guide-block-${index}`}
            data-piece={piece}
            visible={cell !== undefined}
            position={geometry.position}
            size={geometry.size}
            fill={fill}
            oncreate={update}
            onupdate={update}
            ondestroy={() => rect.hide()}
        />;
    })}</div>;
};

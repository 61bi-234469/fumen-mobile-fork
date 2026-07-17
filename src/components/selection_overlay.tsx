import { h } from 'hyperapp';
import konva from 'konva';
import { Component } from '../lib/types';
import { floatingRect } from '../lib/rect_selection';
import { RectSelectState } from '../states';

interface Props {
    rect: konva.Rect;
    selection: RectSelectState;
    topLeft: { x: number; y: number };
    blockSize: number;
}

export const SelectionOverlay: Component<Props> = ({ rect, selection, topLeft, blockSize }) => {
    const selectedRect = selection.status === 'floating' && selection.floating !== null
        ? floatingRect(selection.floating)
        : selection.rect;
    const visible = selection.status !== 'none' && selectedRect !== null;
    const position = selectedRect === null ? { x: 0, y: 0 } : {
        x: topLeft.x + selectedRect.minX * (blockSize + 1) + 1,
        y: topLeft.y + Math.max(0, 22 - selectedRect.maxY - .5) * blockSize
            + (22 - selectedRect.maxY) + 1,
    };
    const size = selectedRect === null ? { width: 0, height: 0 } : {
        width: (selectedRect.maxX - selectedRect.minX + 1) * (blockSize + 1) - 1,
        height: (selectedRect.maxY - selectedRect.minY + 1) * (blockSize + 1) - 1,
    };
    const update = () => {
        rect.position(position);
        rect.size(size);
        if (visible) {
            rect.show();
        } else {
            rect.hide();
        }
    };
    return <param
        key="selection-overlay"
        name="konva"
        value="selection-overlay"
        visible={visible}
        position={position}
        size={size}
        oncreate={update}
        onupdate={update}
        ondestroy={() => rect.hide()}
    />;
};

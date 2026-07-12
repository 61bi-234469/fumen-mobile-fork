import { Component } from '../lib/types';
import { h } from 'hyperapp';
import { Rect } from '../lib/parts';
import konva from 'konva';

export const SelectionFrame: Component<{
    rect: Rect | null;
    floating: boolean;
    topLeft: { x: number, y: number };
    blockSize: number;
    frame: konva.Rect;
}> = ({ rect, floating, topLeft, blockSize, frame }) => {
    const visible = rect !== null;
    const position = rect ? {
        x: topLeft.x + Math.max(0, rect.minX) * (blockSize + 1) + 1,
        y: topLeft.y + (22 - Math.min(22, rect.maxY)) * (blockSize + 1) + 1,
    } : { x: 0, y: 0 };
    const size = rect ? {
        width: (Math.min(9, rect.maxX) - Math.max(0, rect.minX) + 1) * (blockSize + 1) - 1,
        height: (Math.min(22, rect.maxY) - Math.max(0, rect.minY) + 1) * (blockSize + 1) - 1,
    } : { width: 0, height: 0 };

    const sync = () => {
        frame.setAbsolutePosition(position);
        frame.setSize(size);
        frame.dash(floating ? [] : [6, 4]);
        frame.opacity(floating ? 0.85 : 1);
        if (visible && 0 < size.width && 0 < size.height) frame.show(); else frame.hide();
        frame.getLayer()?.batchDraw();
    };
    return <param name="konva" value="selection-frame" key="selection-frame"
                  oncreate={sync} onupdate={sync} ondestroy={() => frame.hide()}
                  rect={rect} floating={floating} position={position} size={size}/>;
};

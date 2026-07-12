import { h } from 'hyperapp';
import { Component, px, style } from '../../lib/types';

interface Props {
    undoEnabled: boolean;
    redoEnabled: boolean;
    compact?: boolean;
    floating: { type: 'fixed' | 'absolute'; left: number; bottom: number };
    undoDatatest?: string;
    redoDatatest?: string;
    onUndo: () => void;
    onRedo: () => void;
}

export const UndoRedoPill: Component<Props> = ({
    undoEnabled,
    redoEnabled,
    compact = false,
    floating,
    undoDatatest = 'btn-undo',
    redoDatatest = 'btn-redo',
    onUndo,
    onRedo,
}) => {
    const buttonSize = compact ? 32 : 44;
    const iconSize = compact ? 20 : 24;
    const padding = compact ? 4 : 5;

    const iconButtonStyle = (enabled: boolean) => style({
        width: px(buttonSize),
        height: px(buttonSize),
        border: 'none',
        borderRadius: '50%',
        backgroundColor: 'transparent',
        color: enabled ? '#334155' : '#CBD5E1',
        cursor: enabled ? 'pointer' : 'default',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
    });

    const dividerStyle = style({
        width: px(1),
        height: px(compact ? 18 : 22),
        backgroundColor: 'rgba(148,163,184,0.4)',
        flex: 'none',
    });

    return h('div', {
        key: 'undo-redo-pill',
        className: 'corner-glass',
        style: style({
            position: floating.type,
            left: px(floating.left),
            bottom: px(floating.bottom),
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: px(4),
            padding: px(padding),
            borderRadius: px(compact ? 20 : 28),
            zIndex: 100,
        }),
    }, [
        h('button', {
            key: 'btn-undo',
            datatest: undoDatatest,
            className: 'corner-btn',
            style: iconButtonStyle(undoEnabled),
            onclick: () => {
                if (undoEnabled) {
                    onUndo();
                }
            },
            disabled: !undoEnabled,
        }, [
            h('i', { className: 'material-icons', style: style({ fontSize: px(iconSize) }) }, 'undo'),
        ]),
        h('div', { key: 'undo-redo-divider', style: dividerStyle }),
        h('button', {
            key: 'btn-redo',
            datatest: redoDatatest,
            className: 'corner-btn',
            style: iconButtonStyle(redoEnabled),
            onclick: () => {
                if (redoEnabled) {
                    onRedo();
                }
            },
            disabled: !redoEnabled,
        }, [
            h('i', { className: 'material-icons', style: style({ fontSize: px(iconSize) }) }, 'redo'),
        ]),
    ]);
};

import { button, div, span } from '@hyperapp/html';
import { VNode } from 'hyperapp';
import { Actions } from '../../actions';
import { ModeTypes, Piece, Rotation } from '../../lib/enums';
import { px, style } from '../../lib/types';
import { EditorPart, State } from '../../states';
import { BlockIcon } from '../../components/atomics/icons';
import { i18n } from '../../locales/keys';
import { rectHeight, rectWidth } from '../../lib/rect_selection';
import { decidePieceColor } from '../../lib/colors';
import { HighlightType } from '../../state_types';

export const CONTEXT_TRAY_HEIGHT = 40;

const trayButton = ({
    key, datatest, label, iconName, active = false, disabled = false, onclick,
}: {
    key: string;
    datatest: string;
    label: string;
    iconName: string;
    active?: boolean;
    disabled?: boolean;
    onclick: () => void;
}) => button({
    key,
    datatest,
    disabled,
    type: 'button',
    'aria-label': label,
    'aria-pressed': active ? 'true' : 'false',
    onclick: (event: MouseEvent) => {
        if (!disabled) {
            onclick();
        }
        event.preventDefault();
        event.stopPropagation();
    },
    style: style({
        alignItems: 'center',
        background: active ? '#f44336' : '#fff',
        border: '0',
        borderLeft: '1px solid #ddd',
        boxShadow: active ? 'inset 0 0 0 2px #fff, inset 0 0 0 3px #d32f2f' : 'none',
        color: active ? '#fff' : disabled ? '#aaa' : '#333',
        cursor: disabled ? 'default' : 'pointer',
        display: 'flex',
        flex: '1 0 56px',
        fontFamily: 'inherit',
        fontSize: px(10),
        gap: px(3),
        height: '100%',
        justifyContent: 'center',
        minWidth: px(56),
        outlineOffset: '-3px',
        padding: '0 4px',
        transition: 'background-color 100ms ease, color 100ms ease, box-shadow 100ms ease',
    }),
}, [
    BlockIcon({ key: `${key}-icon`, iconSize: 18 }, iconName),
    span({
        key: `${key}-label`,
        style: style({ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }),
    }, label),
]);

const partThumbnail = (part: EditorPart, guideLineColor: boolean) => div({
    style: style({
        display: 'grid',
        gap: '1px',
        gridTemplateColumns: `repeat(${part.width}, 4px)`,
        gridTemplateRows: `repeat(${part.height}, 4px)`,
    }),
}, part.cells.map((piece, index) => div({
    key: `${part.id}-cell-${index}`,
    style: style({
        background: piece === Piece.Empty ? '#111' : decidePieceColor(piece, HighlightType.Normal, guideLineColor),
        height: px(4),
        width: px(4),
    }),
})));

const partTrayButton = (part: EditorPart, active: boolean, actions: Actions, guideLineColor: boolean) => button({
    key: `tray-part-${part.id}`,
    datatest: `tray-part-${part.id}`,
    type: 'button',
    'aria-label': `${i18n.EditorUi.Parts()} ${part.width}×${part.height}`,
    'aria-pressed': active ? 'true' : 'false',
    onclick: () => actions.selectPart({ id: part.id }),
    style: style({
        alignItems: 'center',
        background: active ? '#ffebee' : '#fff',
        border: '0',
        borderLeft: '1px solid #ddd',
        boxShadow: active ? 'inset 0 0 0 2px #f44336' : 'none',
        display: 'flex',
        flex: '0 0 56px',
        flexDirection: 'column',
        fontSize: px(8),
        gap: px(2),
        justifyContent: 'center',
        minWidth: px(56),
        padding: '2px',
    }),
}, [
    partThumbnail(part, guideLineColor),
    span({ key: 'size' }, `${part.width}×${part.height}${part.pinned ? ' •' : ''}`),
]);

const selectionSummary = (state: State): VNode<{}>[] => {
    const rect = state.rectSelect.rect;
    if (rect === null) {
        return [];
    }
    let blockCount = 0;
    for (let y = rect.minY; y <= rect.maxY; y += 1) {
        for (let x = rect.minX; x <= rect.maxX; x += 1) {
            if (state.field[x + y * 10]?.piece !== Piece.Empty) {
                blockCount += 1;
            }
        }
    }
    return [div({
        key: 'tray-selection-summary',
        datatest: 'tray-selection-summary',
        style: style({
            alignItems: 'center',
            background: '#333',
            color: '#fff',
            display: 'flex',
            flex: '0 0 64px',
            flexDirection: 'column',
            fontSize: px(9),
            justifyContent: 'center',
            lineHeight: '1.15',
            minWidth: px(64),
        }),
    }, [
        span({ key: 'size' }, `${rectWidth(rect)}×${rectHeight(rect)}`),
        span({ key: 'count' }, i18n.EditorUi.Blocks(blockCount)),
    ])];
};

const paintTray = (state: State, actions: Actions): VNode<{}>[] => [
    trayButton({
        key: 'tray-paint-pen', datatest: 'tray-paint-pen', label: i18n.EditorUi.Pen(), iconName: 'edit',
        active: state.editorUi.paintTool === 'pen'
            && state.editorUi.paletteSelection !== Piece.Empty,
        onclick: () => actions.changePaintTool({ tool: 'pen' }),
    }),
    trayButton({
        key: 'tray-paint-erase', datatest: 'tray-paint-erase', label: i18n.EditorUi.Erase(), iconName: 'backspace',
        active: state.editorUi.paintTool === 'pen' && state.editorUi.paletteSelection === Piece.Empty,
        onclick: () => {
            actions.selectEditorPalette({ selection: Piece.Empty });
            actions.changePaintTool({ tool: 'pen' });
        },
    }),
    trayButton({
        key: 'tray-paint-fill', datatest: 'tray-paint-fill', label: i18n.EditorUi.Fill(), iconName: 'format_color_fill',
        active: state.editorUi.paintTool === 'fill', onclick: () => actions.changePaintTool({ tool: 'fill' }),
    }),
    trayButton({
        key: 'tray-paint-fill-row', datatest: 'tray-paint-fill-row',
        label: i18n.EditorUi.FillRow(), iconName: 'power_input',
        active: state.editorUi.paintTool === 'fillRow', onclick: () => actions.changePaintTool({ tool: 'fillRow' }),
    }),
];

const pieceTray = (state: State, actions: Actions): VNode<{}>[] => {
    const page = state.fumen.pages[state.fumen.currentIndex];
    const canOperate = page?.piece !== undefined;
    const rotationName = page?.piece === undefined ? 'empty' : {
        [Rotation.Spawn]: 'spawn',
        [Rotation.Right]: 'right',
        [Rotation.Reverse]: 'reverse',
        [Rotation.Left]: 'left',
    }[page.piece.rotation];
    return [
        div({
            key: `img-rotation-${rotationName}`,
            datatest: `img-rotation-${rotationName}`,
            'aria-label': `${i18n.EditorUi.Rotate()}: ${rotationName}`,
            style: style({
                alignItems: 'center',
                background: '#333',
                color: '#fff',
                display: 'flex',
                flex: '0 0 24px',
                fontSize: px(9),
                justifyContent: 'center',
                minWidth: px(24),
                textTransform: 'uppercase',
            }),
        }, rotationName === 'empty' ? '–' : rotationName!.slice(0, 1)),
        trayButton({
            key: 'tray-piece-spawn', datatest: 'tray-piece-spawn', label: i18n.EditorUi.Spawn(), iconName: 'add',
            active: state.editorUi.pieceAction === 'spawn',
            onclick: () => actions.changePieceAction({ pieceAction: 'spawn' }),
        }),
        trayButton({
            key: 'tray-piece-drag', datatest: 'tray-piece-drag', label: i18n.EditorUi.Drag(), iconName: 'pan_tool',
            active: state.editorUi.pieceAction === 'drag', disabled: !canOperate,
            onclick: () => actions.changePieceAction({ pieceAction: 'drag' }),
        }),
        trayButton({
            key: 'tray-piece-rotate-left',
            datatest: 'tray-piece-rotate-left',
            label: i18n.EditorUi.RotateLeft(),
            iconName: 'rotate_left',
            disabled: !canOperate, onclick: actions.rotateToLeft,
        }),
        trayButton({
            key: 'tray-piece-rotate-right', datatest: 'tray-piece-rotate-right',
            label: i18n.EditorUi.RotateRight(), iconName: 'rotate_right',
            disabled: !canOperate, onclick: actions.rotateToRight,
        }),
        trayButton({
            key: 'tray-piece-drop', datatest: 'tray-piece-drop',
            label: i18n.EditorUi.Drop(), iconName: 'vertical_align_bottom',
            disabled: !canOperate, onclick: actions.harddrop,
        }),
    ];
};

const selectTray = (state: State, actions: Actions): VNode<{}>[] => {
    const selected = state.rectSelect.status === 'selected' && state.rectSelect.rect !== null;
    if (state.parts.selectedId !== null) {
        const part = state.parts.items.find(item => item.id === state.parts.selectedId);
        return [
            trayButton({
                key: 'tray-select-stamp-once', datatest: 'tray-select-stamp-once',
                label: i18n.EditorUi.Once(), iconName: 'filter_1',
                active: !state.parts.continuous, onclick: actions.useSingleStamp,
            }),
            trayButton({
                key: 'tray-select-stamp-continuous', datatest: 'tray-select-stamp-continuous',
                label: i18n.EditorUi.Continuous(), iconName: 'all_inclusive', active: state.parts.continuous,
                onclick: actions.toggleContinuousStamp,
            }),
            trayButton({
                key: 'tray-select-stamp-rotate', datatest: 'tray-select-stamp-rotate', label: i18n.EditorUi.Rotate(),
                iconName: 'rotate_right', onclick: actions.rotateSelectedPart,
            }),
            trayButton({
                key: 'tray-select-stamp-mirror', datatest: 'tray-select-stamp-mirror', label: i18n.EditorUi.Mirror(),
                iconName: 'flip', onclick: actions.mirrorSelectedPart,
            }),
            trayButton({
                key: 'tray-select-stamp-end', datatest: 'tray-select-stamp-end', label: i18n.EditorUi.End(),
                iconName: 'close', onclick: actions.deactivateStamp,
            }),
            trayButton({
                key: 'tray-select-black-transparent', datatest: 'tray-select-black-transparent',
                label: i18n.EditorUi.BlackTransparent(), iconName: 'layers_clear',
                active: state.parts.blackTransparent, onclick: actions.toggleBlackTransparentPaste,
            }),
            trayButton({
                key: 'tray-select-part-pin', datatest: 'tray-select-part-pin',
                label: part?.pinned ? i18n.EditorUi.Unpin() : i18n.EditorUi.Pin(),
                iconName: 'push_pin', onclick: actions.toggleSelectedPartPin,
            }),
            trayButton({
                key: 'tray-select-part-delete', datatest: 'tray-select-part-delete',
                label: i18n.EditorUi.Delete(), iconName: 'delete', onclick: actions.removeSelectedPart,
            }),
        ];
    }
    const operations = [
        trayButton({
            key: 'tray-select-move', datatest: 'tray-select-move', label: i18n.EditorUi.Move(), iconName: 'open_with',
            disabled: !selected, onclick: actions.beginMoveRectSelection,
        }),
        trayButton({
            key: 'tray-select-copy', datatest: 'tray-select-copy',
            label: i18n.EditorUi.Copy(), iconName: 'content_copy',
            disabled: !selected, onclick: actions.copyRectSelection,
        }),
        trayButton({
            key: 'tray-select-cut', datatest: 'tray-select-cut', label: i18n.EditorUi.Cut(), iconName: 'content_cut',
            disabled: !selected, onclick: actions.cutRectSelection,
        }),
        trayButton({
            key: 'tray-select-stamp', datatest: 'tray-select-stamp', label: i18n.EditorUi.Stamp(), iconName: 'texture',
            disabled: state.parts.items.length === 0, onclick: actions.activateStamp,
        }),
        trayButton({
            key: 'tray-select-deselect', datatest: 'tray-select-deselect',
            label: i18n.EditorUi.Deselect(), iconName: 'deselect',
            disabled: !selected, onclick: actions.clearRectSelection,
        }),
    ];
    return selectionSummary(state).concat(operations).concat(state.parts.items.map(part => (
        partTrayButton(part, false, actions, state.fumen.guideLineColor)
    )));
};

const slideTray = (actions: Actions): VNode<{}>[] => [
    trayButton({
        key: 'btn-slide-to-up-with-gray', datatest: 'btn-slide-to-up-with-gray', label: i18n.EditorUi.UpGray(),
        iconName: 'vertical_align_top', onclick: actions.shiftToUpWithGray,
    }),
    trayButton({
        key: 'btn-slide-to-up', datatest: 'btn-slide-to-up', label: i18n.EditorUi.Up(), iconName: 'keyboard_arrow_up',
        onclick: actions.shiftToUp,
    }),
    trayButton({
        key: 'btn-slide-to-left', datatest: 'btn-slide-to-left',
        label: i18n.EditorUi.Left(), iconName: 'keyboard_arrow_left',
        onclick: actions.shiftToLeft,
    }),
    trayButton({
        key: 'btn-slide-to-right', datatest: 'btn-slide-to-right',
        label: i18n.EditorUi.Right(), iconName: 'keyboard_arrow_right',
        onclick: actions.shiftToRight,
    }),
    trayButton({
        key: 'btn-slide-to-down', datatest: 'btn-slide-to-down',
        label: i18n.EditorUi.Down(), iconName: 'keyboard_arrow_down',
        onclick: actions.shiftToBottom,
    }),
    trayButton({
        key: 'tray-slide-done', datatest: 'tray-slide-done', label: i18n.EditorUi.Done(), iconName: 'done',
        onclick: () => actions.changePaintTool({ tool: 'pen' }),
    }),
];

const commentTray = (state: State, actions: Actions): VNode<{}>[] => [
    trayButton({
        key: 'btn-comment-blank', datatest: 'btn-comment-blank',
        label: i18n.EditorUi.Blank(), iconName: 'format_strikethrough',
        onclick: () => actions.setCommentText({ text: '', pageIndex: state.fumen.currentIndex }),
    }),
    trayButton({
        key: 'btn-comment-inherit', datatest: 'btn-comment-inherit',
        label: i18n.EditorUi.Inherit(), iconName: 'forward',
        disabled: state.fumen.currentIndex === 0,
        onclick: () => actions.resetCommentText({ pageIndex: state.fumen.currentIndex }),
    }),
    trayButton({
        key: 'tray-comment-done', datatest: 'tray-comment-done', label: i18n.EditorUi.Done(), iconName: 'done',
        onclick: () => actions.changePaintTool({ tool: 'pen' }),
    }),
];

export const contextTray = (state: State, actions: Actions, height: number = CONTEXT_TRAY_HEIGHT) => {
    let contents: VNode<{}>[];
    if (state.mode.type === ModeTypes.Slide) {
        contents = slideTray(actions);
    } else if (state.mode.type === ModeTypes.Comment) {
        contents = commentTray(state, actions);
    } else {
        switch (state.editorUi.primaryTool) {
        case 'piece':
            contents = pieceTray(state, actions);
            break;
        case 'select':
            contents = selectTray(state, actions);
            break;
        default:
            contents = paintTray(state, actions);
            break;
        }
    }
    return div({
        key: 'tray-context',
        datatest: 'tray-context',
        role: 'toolbar',
        'aria-label': i18n.EditorUi.ContextTools(),
        style: style({
            background: '#fff',
            borderBottom: '1px solid #333',
            borderTop: '1px solid #333',
            boxSizing: 'border-box',
            display: 'flex',
            height: px(height),
            minHeight: px(height),
            overflowX: 'auto',
            overflowY: 'hidden',
            width: '100%',
        }),
    }, contents);
};

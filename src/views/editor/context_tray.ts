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
import { canSwapCurrentPieceWithHoldQueue } from '../../actions/cold_clear';

export const CONTEXT_TRAY_HEIGHT = 40;

const trayButton = ({
    key, datatest, label, iconName, active = false, disabled = false, onclick, iconOnly = false,
}: {
    key: string;
    datatest: string;
    label: string;
    iconName: string;
    active?: boolean;
    disabled?: boolean;
    onclick: () => void;
    iconOnly?: boolean;
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
        flex: iconOnly ? '1 1 0' : '1 0 56px',
        fontFamily: 'inherit',
        fontSize: px(10),
        gap: px(3),
        height: '100%',
        justifyContent: 'center',
        minWidth: iconOnly ? '0' : px(56),
        outlineOffset: '-3px',
        padding: iconOnly ? '0' : '0 4px',
        transition: 'background-color 100ms ease, color 100ms ease, box-shadow 100ms ease',
    }),
}, [
    BlockIcon({ key: `${key}-icon`, iconSize: 18 }, iconName),
    span({
        key: `${key}-label`,
        style: style({
            display: iconOnly ? 'none' : 'block',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }),
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
        onclick: () => actions.changePaintTool({ tool: 'pen', restorePalette: true }),
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

const rotationDirection = (rotationName: string): string => ({
    spawn: 'N',
    right: 'E',
    reverse: 'S',
    left: 'W',
}[rotationName] ?? '-');

const pieceTray = (state: State, actions: Actions): VNode<{}>[] => {
    const page = state.fumen.pages[state.fumen.currentIndex];
    const canOperate = page?.piece !== undefined;
    const canHold = canOperate && canSwapCurrentPieceWithHoldQueue(state);
    const rotationName = page?.piece === undefined ? 'empty' : {
        [Rotation.Spawn]: 'spawn',
        [Rotation.Right]: 'right',
        [Rotation.Reverse]: 'reverse',
        [Rotation.Left]: 'left',
    }[page.piece.rotation];
    const placeholder = (key: string) => div({
        key,
        'aria-hidden': 'true',
        style: style({ background: '#fff', borderLeft: '1px solid #ddd', minWidth: '0' }),
    });
    const pieceButton = ({
        key, label, iconName, disabled = false, onclick,
    }: { key: string; label: string; iconName: string; disabled?: boolean; onclick: () => void }) => trayButton({
        key,
        label,
        iconName,
        disabled,
        onclick,
        datatest: key,
        iconOnly: true,
    });
    return [div({
        key: 'tray-piece-grid',
        datatest: 'tray-piece-grid',
        style: style({
            display: 'grid',
            flex: '1 1 auto',
            gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
            gridTemplateRows: 'repeat(2, minmax(0, 1fr))',
            minHeight: '0',
            minWidth: '100%',
            position: 'relative',
        }),
    }, [
        placeholder('tray-piece-empty-top'),
        state.mode.rotationSystem === 'srsPlus'
            ? pieceButton({
                key: 'tray-piece-rotate-180', label: i18n.EditorUi.Rotate180(), iconName: 'refresh',
                disabled: !canOperate, onclick: actions.rotateTo180,
            })
            : placeholder('tray-piece-empty-180'),
        pieceButton({
            key: 'tray-piece-hold', label: i18n.EditorUi.Hold(), iconName: 'swap_horiz',
            disabled: !canHold, onclick: actions.swapCurrentPieceWithHoldQueue,
        }),
        pieceButton({
            key: 'tray-piece-harddrop', label: i18n.EditorUi.HardDrop(), iconName: 'vertical_align_bottom',
            disabled: !canOperate, onclick: actions.harddrop,
        }),
        placeholder('tray-piece-empty-top-end'),
        pieceButton({
            key: 'tray-piece-move-left', label: i18n.EditorUi.Left(), iconName: 'keyboard_arrow_left',
            disabled: !canOperate, onclick: actions.moveToLeft,
        }),
        pieceButton({
            key: 'tray-piece-move-right', label: i18n.EditorUi.Right(), iconName: 'keyboard_arrow_right',
            disabled: !canOperate, onclick: actions.moveToRight,
        }),
        pieceButton({
            key: 'tray-piece-softdrop', label: i18n.EditorUi.SoftDrop(), iconName: 'keyboard_arrow_down',
            disabled: !canOperate, onclick: actions.softdrop,
        }),
        pieceButton({
            key: 'tray-piece-rotate-left', label: i18n.EditorUi.RotateLeft(), iconName: 'rotate_left',
            disabled: !canOperate, onclick: actions.rotateToLeft,
        }),
        pieceButton({
            key: 'tray-piece-rotate-right', label: i18n.EditorUi.RotateRight(), iconName: 'rotate_right',
            disabled: !canOperate, onclick: actions.rotateToRight,
        }),
        div({
            key: `img-rotation-${rotationName}`,
            datatest: `img-rotation-${rotationName}`,
            'aria-label': `${i18n.EditorUi.Rotate()}: ${rotationName}`,
            style: style({
                alignItems: 'center',
                background: '#333',
                color: '#fff',
                display: 'flex',
                fontSize: px(9),
                height: px(20),
                justifyContent: 'center',
                left: '0',
                pointerEvents: 'none',
                position: 'absolute',
                textTransform: 'uppercase',
                top: '0',
                width: px(24),
            }),
        }, rotationDirection(rotationName)),
    ])];
};

const selectTray = (state: State, actions: Actions): VNode<{}>[] => {
    const canOperate = (state.rectSelect.status === 'floating' && state.rectSelect.floating !== null)
        || (state.rectSelect.status === 'selected' && state.rectSelect.rect !== null);
    const operations = [
        trayButton({
            key: 'tray-select-copy', datatest: 'tray-select-copy',
            label: i18n.EditorUi.Copy(), iconName: 'content_copy',
            disabled: !canOperate, onclick: actions.copyRectSelection,
        }),
        trayButton({
            key: 'tray-select-cut', datatest: 'tray-select-cut', label: i18n.EditorUi.Cut(), iconName: 'content_cut',
            disabled: !canOperate, onclick: actions.cutRectSelection,
        }),
        trayButton({
            key: 'tray-select-rotate-left', datatest: 'tray-select-rotate-left',
            label: i18n.EditorUi.RotateLeft(), iconName: 'rotate_left',
            disabled: !canOperate, onclick: actions.rotateSelectedPartLeft,
        }),
        trayButton({
            key: 'tray-select-rotate-right', datatest: 'tray-select-rotate-right',
            label: i18n.EditorUi.RotateRight(), iconName: 'rotate_right',
            disabled: !canOperate, onclick: actions.rotateSelectedPartRight,
        }),
        trayButton({
            key: 'tray-select-mirror', datatest: 'tray-select-mirror', label: i18n.EditorUi.Mirror(),
            iconName: 'flip', disabled: !canOperate, onclick: actions.mirrorSelectedPart,
        }),
    ];
    return selectionSummary(state).concat(operations);
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

const handleTrayWheel = (event: WheelEvent) => {
    const tray = event.currentTarget as HTMLElement;
    if (tray.scrollWidth <= tray.clientWidth) {
        return;
    }
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (delta === 0) {
        return;
    }
    tray.scrollLeft += delta;
    event.preventDefault();
};

export const contextTray = (
    state: State,
    actions: Actions,
    height: number = CONTEXT_TRAY_HEIGHT,
) => {
    const trayHeight = height;
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
        className: `editor-context-tray${trayHeight < 24 ? ' editor-context-tray--compact' : ''}`,
        role: 'toolbar',
        'aria-label': i18n.EditorUi.ContextTools(),
        onwheel: handleTrayWheel,
        style: style({
            background: '#fff',
            borderBottom: '1px solid #333',
            borderTop: '1px solid #333',
            boxSizing: 'border-box',
            display: 'flex',
            height: px(trayHeight),
            minHeight: px(trayHeight),
            overflowX: 'auto',
            overflowY: 'hidden',
            width: '100%',
        }),
    }, contents);
};

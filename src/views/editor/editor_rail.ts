import { button, div, img, span } from '@hyperapp/html';
import { VNode } from 'hyperapp';
import { Actions } from '../../actions';
import { decidePieceColor } from '../../lib/colors';
import { isMinoPaletteSelection } from '../../lib/editor_interaction';
import { parsePieceName, Piece } from '../../lib/enums';
import { displayShortcut } from '../../lib/shortcuts';
import { px, style } from '../../lib/types';
import { HighlightType } from '../../state_types';
import { PaletteSelection, State } from '../../states';
import { BlockIcon } from '../../components/atomics/icons';
import { executePieceShortcut } from '../../lib/piece_shortcut';
import { i18n } from '../../locales/keys';
import { EditorLayout } from './editor';
import { getResponsiveRailCellHeight } from './responsive_layout';
import { editorControlStateStyle, EditorControlState } from './editor_control_style';

const LONG_PRESS_DURATION = 500;

const pressState: {
    key: string | null;
    timer: ReturnType<typeof setTimeout> | null;
    triggered: boolean;
} = { key: null, timer: null, triggered: false };

const clearPress = () => {
    if (pressState.timer !== null) {
        clearTimeout(pressState.timer);
        pressState.timer = null;
    }
};

interface CellOptions {
    key: string;
    datatest: string;
    label: string;
    height: number;
    selected?: boolean;
    selectionKind?: 'active' | 'palette';
    status?: boolean;
    disabled?: boolean;
    title?: string;
    onpress: () => void;
    onlongpress?: () => void;
    children: VNode<{}> | VNode<{}>[] | string;
}

const toolCell = ({
    key,
    datatest,
    label,
    height,
    selected = false,
    selectionKind = 'active',
    status = false,
    disabled = false,
    title,
    onpress,
    onlongpress,
    children,
}: CellOptions) => {
    const controlState: EditorControlState = status ? 'status' : selected ? selectionKind : 'idle';
    const stateStyle = editorControlStateStyle(controlState);
    const handlePointerDown = () => {
        if (disabled || onlongpress === undefined) {
            return;
        }
        clearPress();
        pressState.key = key;
        pressState.triggered = false;
        pressState.timer = setTimeout(() => {
            pressState.triggered = true;
            pressState.timer = null;
            onlongpress();
        }, LONG_PRESS_DURATION);
    };
    const cancelPointer = () => {
        if (pressState.key !== key) {
            return;
        }
        clearPress();
        pressState.key = null;
        pressState.triggered = false;
    };
    const handlePointerUp = (event: PointerEvent) => {
        if (disabled || onlongpress === undefined || pressState.key !== key) {
            return;
        }
        clearPress();
        if (!pressState.triggered) {
            onpress();
        }
        pressState.key = null;
        pressState.triggered = false;
        event.preventDefault();
        event.stopPropagation();
    };

    const pointerHandlers = onlongpress === undefined ? {
        onclick: (event: MouseEvent) => {
            onpress();
            event.preventDefault();
            event.stopPropagation();
        },
    } : {
        onpointerdown: handlePointerDown,
        onpointerup: handlePointerUp,
        onpointercancel: cancelPointer,
        onpointerleave: cancelPointer,
        oncontextmenu: (event: Event) => event.preventDefault(),
    };

    return button({
        key,
        datatest,
        disabled,
        type: 'button',
        title: title ?? label,
        className: 'editor-control waves-effect',
        'data-active': selected || status ? 'true' : 'false',
        'aria-label': label,
        'aria-pressed': selected ? 'true' : 'false',
        'aria-busy': status ? 'true' : 'false',
        style: style({
            alignItems: 'center',
            background: stateStyle.background,
            border: '0',
            borderRadius: '0',
            boxShadow: stateStyle.boxShadow,
            boxSizing: 'border-box',
            color: disabled ? '#9e9e9e' : stateStyle.color,
            cursor: disabled ? 'default' : 'pointer',
            display: 'flex',
            fontFamily: 'inherit',
            fontSize: px(Math.max(9, Math.min(11, height * 0.4))),
            fontWeight: selected ? '600' : '500',
            height: px(height),
            justifyContent: 'center',
            lineHeight: '1',
            minHeight: px(height),
            minWidth: '0',
            outlineOffset: '-3px',
            overflow: 'hidden',
            padding: '0 2px',
            position: 'relative',
            touchAction: 'none',
            transition: 'background-color 100ms ease, color 100ms ease, box-shadow 100ms ease',
            userSelect: 'none',
            width: '100%',
        }),
        ...pointerHandlers,
    }, Array.isArray(children) ? children : [children]);
};

const toolGroup = (key: string, rows: VNode<{}>[]) => div({
    key,
    style: style({
        background: '#333',
        border: '1px solid #333',
        borderRadius: '0',
        boxSizing: 'border-box',
        display: 'grid',
        gap: '1px',
        overflow: 'hidden',
        width: '100%',
    }),
}, rows);

const row = (key: string, columns: VNode<{}>[]) => div({
    key,
    style: style({
        display: 'grid',
        gap: '1px',
        gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))`,
    }),
}, columns);

const icon = (name: string, size: number) => BlockIcon({ key: `icon-${name}`, iconSize: size }, name);

const minoPaletteSwatch = (selection: Piece, height: number, guideLineColor: boolean) => {
    const size = Math.max(18, Math.min(24, height - 4));
    const background = decidePieceColor(selection, HighlightType.Highlight1, guideLineColor);
    return div({
        'data-palette-swatch': 'mino',
        style: style({
            background,
            alignItems: 'center',
            borderRadius: '0',
            color: '#fff',
            display: 'flex',
            fontSize: px(Math.max(10, Math.min(13, size * .58))),
            fontWeight: '700',
            height: px(size),
            justifyContent: 'center',
            textShadow: 'none',
            width: px(size),
        }),
    }, parsePieceName(selection) ?? '');
};

const paletteContent = (selection: PaletteSelection, state: State, height: number) => {
    if (state.editorUi.primaryTool === 'piece' && isMinoPaletteSelection(selection)) {
        const pieceName = parsePieceName(selection);
        const src = state.fumen.guideLineColor ? `img/${pieceName}.svg` : `img/${pieceName}_classic.svg`;
        return img({
            src,
            alt: pieceName,
            style: style({ display: 'block', height: px(Math.max(12, height - 6)), margin: 'auto' }),
        });
    }
    const neutralSize = Math.max(12, Math.min(18, height - 10));
    if (selection === Piece.Empty || selection === Piece.Gray) {
        return div({
            'aria-hidden': 'true',
            'data-palette-swatch': selection === Piece.Empty ? 'empty' : 'gray',
            style: style({
                background: decidePieceColor(selection, HighlightType.Normal, state.fumen.guideLineColor),
                height: px(neutralSize),
                width: px(neutralSize),
            }),
        });
    }
    if (selection === 'comp') {
        const compact = height < 24;
        return div({
            'data-palette-swatch': 'comp',
            style: style({
                alignItems: 'center',
                color: '#333',
                display: 'flex',
                fontSize: px(compact ? 8 : 9),
                gap: px(compact ? 1 : 2),
                justifyContent: 'center',
                lineHeight: '1',
                whiteSpace: 'nowrap',
            }),
        }, [
            BlockIcon({ key: 'comp-icon', iconSize: compact ? 12 : 15 }, 'image_aspect_ratio'),
            span({ key: 'comp-label' }, 'COMP'),
        ]);
    }
    return minoPaletteSwatch(selection, height, state.fumen.guideLineColor);
};

const getPaletteShortcut = (state: State, selection: PaletteSelection): string | undefined => {
    if (!state.mode.shortcutLabelVisible) {
        return undefined;
    }
    const key = selection === 'comp' ? 'Comp'
        : selection === Piece.Empty ? 'Empty'
            : selection === Piece.Gray ? 'Gray' : Piece[selection] as keyof State['mode']['paletteShortcuts'];
    const code = state.mode.paletteShortcuts[key];
    return code ? displayShortcut(code) : undefined;
};

export const getRailCellHeight = (layout: EditorLayout): number =>
    getResponsiveRailCellHeight(layout.field.size.height, layout.buttons.columns);

export const editorRail = (state: State, actions: Actions, layout: EditorLayout) => {
    const cellHeight = getRailCellHeight(layout);
    const twoColumns = layout.buttons.columns === 2;
    const compact = twoColumns || layout.canvas.size.height < 560 || layout.buttons.size.width < 72;
    const text = (label: string) => compact ? '' : label;
    const iconSize = Math.max(14, Math.min(20, cellHeight - 7));
    const editShortcut = (key: keyof State['mode']['editShortcuts']) => {
        if (compact || !state.mode.shortcutLabelVisible) {
            return undefined;
        }
        const code = state.mode.editShortcuts[key];
        return code ? displayShortcut(code) : undefined;
    };
    const withShortcut = (content: VNode<{}> | VNode<{}>[] | string, shortcut?: string) => [
        content as VNode<{}>,
        ...(shortcut ? [span({
            key: 'shortcut',
            style: style({ bottom: '1px', fontSize: px(8), opacity: .72, position: 'absolute', right: '2px' }),
        }, shortcut)] : []),
    ];

    const pageCell = (
        key: string,
        label: string,
        iconName: string,
        shortcut: keyof State['mode']['editShortcuts'],
        onpress: () => void,
        onlongpress?: () => void,
    ) => toolCell({
        key,
        label,
        onpress,
        onlongpress,
        height: cellHeight,
        datatest: key,
        children: withShortcut([
            icon(iconName, iconSize),
            ...(compact ? [] : [span({ key: 'label', style: style({ marginLeft: '3px' }) }, label)]),
        ], editShortcut(shortcut)),
    });

    const systemGroup = toolGroup('rail-system', [row('rail-system-row', [
        toolCell({
            key: 'btn-editor-share', datatest: 'btn-editor-share',
            label: i18n.EditorUi.ImportExport(), height: cellHeight,
            onpress: () => actions.openListViewMenuModal(), children: icon('import_export', iconSize),
        }),
        toolCell({
            key: 'btn-editor-user-settings',
            datatest: 'btn-editor-user-settings',
            label: i18n.EditorUi.Settings(),
            height: cellHeight,
            onpress: () => actions.openUserSettingsModal({ initialTab: 'field' }), children: icon('settings', iconSize),
        }),
    ])]);

    const pageCells = [
        pageCell('btn-insert-new-page', i18n.EditorUi.Add() || 'ADD', 'note_add', 'Add',
            () => actions.insertNewPage({ index: state.fumen.currentIndex + 1 })),
        pageCell('btn-insert-from-clipboard', i18n.EditorUi.Insert() || 'INSERT', 'content_paste', 'Insert',
            actions.insertPageFromClipboard, actions.replaceAllFromClipboard),
        pageCell('btn-copy-to-clipboard', i18n.EditorUi.Copy() || 'COPY', 'content_copy', 'Copy',
            actions.copyCurrentPageToClipboard, actions.copyAllPagesToClipboard),
        pageCell('btn-cut-page', i18n.EditorUi.Cut() || 'CUT', 'content_cut', 'Cut',
            actions.cutCurrentPage, actions.cutAllPages),
    ];
    const pageGroup = toolGroup('rail-pages', twoColumns ? [
        row('rail-pages-row-1', pageCells.slice(0, 2)),
        row('rail-pages-row-2', pageCells.slice(2, 4)),
    ] : pageCells);

    const auxiliaryGroup = toolGroup('rail-auxiliary', [
        row('rail-inspector-row', [
            toolCell({
                key: 'btn-utils-mode', datatest: 'btn-utils-mode', label: i18n.EditorUi.Utilities(), height: cellHeight,
                selected: state.editorUi.inspector === 'utils',
                onpress: () => actions.openEditorInspector({ inspector: 'utils' }),
                children: compact ? icon('widgets', iconSize) : [icon('widgets', iconSize), span({ key: 'u' }, 'U')],
            }),
            toolCell({
                key: 'btn-flags-mode', datatest: 'btn-flags-mode', label: i18n.EditorUi.Flags(), height: cellHeight,
                selected: state.editorUi.inspector === 'flags',
                onpress: () => actions.openEditorInspector({ inspector: 'flags' }),
                children: compact ? icon('flag', iconSize) : [icon('flag', iconSize), span({ key: 'f' }, 'F')],
            }),
        ]),
        toolCell({
            key: 'btn-cold-clear', datatest: 'btn-cold-clear', label: i18n.ColdClear.MenuButtonLabel(),
            height: cellHeight, status: state.coldClear.isRunning,
            onpress: actions.openColdClearMenuModal,
            children: [
                icon(state.coldClear.isRunning ? 'hourglass_top' : 'auto_fix_high', iconSize),
                ...(compact ? [] : [span({ key: 'ai', style: style({ marginLeft: '3px' }) }, 'AI')]),
                ...(state.coldClear.progress ? [span({
                    key: 'progress-badge',
                    style: style({
                        background: '#333', borderRadius: '8px', color: '#fff', fontSize: px(7),
                        lineHeight: '11px', minWidth: '18px', padding: '0 2px', position: 'absolute',
                        right: '2px', top: '2px',
                    }),
                }, `${state.coldClear.progress.current}/${state.coldClear.progress.total}`)] : []),
                span({
                    key: 'progress-live', 'aria-live': 'polite',
                    style: style({ clip: 'rect(0 0 0 0)', clipPath: 'inset(50%)', height: '1px', overflow: 'hidden',
                        position: 'absolute', whiteSpace: 'nowrap', width: '1px' }),
                }, state.coldClear.progress
                    ? i18n.ColdClear.Progress(state.coldClear.progress.current, state.coldClear.progress.total) : ''),
            ],
        }),
    ]);

    const modeGroup = toolGroup('rail-modes', [
        row('rail-mode-row', [
            toolCell({
                key: 'btn-piece-mode', datatest: 'btn-piece-mode', label: 'PIECE', height: cellHeight,
                selected: state.editorUi.primaryTool === 'piece',
                onpress: () => actions.changePrimaryTool({ tool: 'piece' }),
                onlongpress: () => executePieceShortcut('Reset', actions),
                children: [icon('extension', iconSize), ...(compact ? [] : [span({ key: 'piece' }, text('PIECE'))])],
            }),
            toolCell({
                key: 'btn-select-mode', datatest: 'btn-select-mode', label: 'SELECT', height: cellHeight,
                selected: state.editorUi.primaryTool === 'select',
                onpress: () => actions.changePrimaryTool({ tool: 'select' }),
                children: [icon('select_all', iconSize), ...(compact ? [] : [span({ key: 'select' }, text('SELECT'))])],
            }),
        ]),
        toolCell({
            key: 'btn-paint-mode', datatest: 'btn-paint-mode', label: 'PAINT', height: cellHeight,
            selected: state.editorUi.primaryTool === 'paint',
            onpress: () => actions.changePrimaryTool({ tool: 'paint' }),
            children: [icon('brush', iconSize), ...(compact ? [] : [span({
                key: 'paint', style: style({ marginLeft: '3px' }),
            }, 'PAINT')])],
        }),
    ]);

    const selections: PaletteSelection[] = [
        Piece.I, Piece.L, Piece.O, Piece.Z, Piece.T, Piece.J, Piece.S, Piece.Empty, Piece.Gray, 'comp',
    ];
    const paletteCells = selections.map((selection) => {
        const name = selection === 'comp' ? 'inference' : (parsePieceName(selection) ?? '').toLowerCase();
        const label = selection === 'comp' ? 'COMP' : parsePieceName(selection) ?? '';
        return toolCell({
            label,
            height: cellHeight,
            key: `btn-piece-${name}`,
            datatest: `btn-piece-${name}`,
            selected: state.editorUi.paletteSelection === selection,
            selectionKind: 'palette',
            onpress: () => actions.selectEditorPalette({ selection }),
            onlongpress: () => actions.executeEditorPaletteShortcut({ selection }),
            children: withShortcut(paletteContent(selection, state, cellHeight),
                compact ? undefined : getPaletteShortcut(state, selection)),
        });
    });
    const paletteGroup = toolGroup('rail-palette', twoColumns
        ? [0, 1, 2, 3, 4].map(index => row(`rail-palette-row-${index + 1}`,
            paletteCells.slice(index * 2, index * 2 + 2)))
        : paletteCells);

    return div({
        key: 'editor-rail',
        datatest: 'editor-rail',
        'data-columns': String(layout.buttons.columns),
        style: style({
            alignSelf: 'center',
            display: 'flex',
            flexDirection: 'column',
            height: px(layout.field.size.height),
            justifyContent: 'space-between',
            marginLeft: '8px',
            minWidth: px(layout.buttons.size.width),
            overflow: 'hidden',
            width: px(layout.buttons.size.width),
        }),
    }, [systemGroup, pageGroup, auxiliaryGroup, modeGroup, paletteGroup]);
};

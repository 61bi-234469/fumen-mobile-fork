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
import { getPieceRailMetrics, getResponsiveRailCellHeight, shouldUseCompactEditorRail } from './responsive_layout';
import { editorControlStateStyle, EditorControlState } from './editor_control_style';

const LONG_PRESS_DURATION = 500;

const pressState: {
    key: string | null;
    timer: ReturnType<typeof setTimeout> | null;
    triggered: boolean;
    suppressNextClick: boolean;
    suppressClickTimer: ReturnType<typeof setTimeout> | null;
} = { key: null, timer: null, triggered: false, suppressNextClick: false, suppressClickTimer: null };

const clearPress = () => {
    if (pressState.timer !== null) {
        clearTimeout(pressState.timer);
        pressState.timer = null;
    }
};

const clearSuppressedClick = () => {
    if (pressState.suppressClickTimer !== null) {
        clearTimeout(pressState.suppressClickTimer);
        pressState.suppressClickTimer = null;
    }
    pressState.suppressNextClick = false;
};

const suppressNextClick = () => {
    clearSuppressedClick();
    pressState.suppressNextClick = true;
    pressState.suppressClickTimer = setTimeout(() => {
        pressState.suppressNextClick = false;
        pressState.suppressClickTimer = null;
    }, 500);
};

const consumeSuppressedClick = (event: MouseEvent) => {
    if (!pressState.suppressNextClick) {
        return false;
    }
    clearSuppressedClick();
    event.preventDefault();
    event.stopPropagation();
    return true;
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
        // A real follow-up pointerdown means the previous press did not
        // produce a synthetic click. Do not let the guard suppress this click.
        clearSuppressedClick();
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
        const triggered = pressState.triggered;
        clearPress();
        pressState.key = null;
        pressState.triggered = false;
        // The short-press action changes the rail layout immediately. Suppress
        // the synthetic click that may otherwise land on the settings button
        // after that layout shift on mobile browsers.
        suppressNextClick();
        if (!triggered) {
            onpress();
        }
        event.preventDefault();
        event.stopPropagation();
    };

    const pointerHandlers = onlongpress === undefined ? {
        onclick: (event: MouseEvent) => {
            if (consumeSuppressedClick(event)) {
                return;
            }
            onpress();
            event.preventDefault();
            event.stopPropagation();
        },
        onpointerdown: handlePointerDown,
    } : {
        onclick: (event: MouseEvent) => {
            if (consumeSuppressedClick(event)) {
                return;
            }
            onpress();
            event.preventDefault();
            event.stopPropagation();
        },
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
            whiteSpace: 'nowrap',
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

const partPaletteSwatch = (
    part: State['parts']['items'][number],
    state: State,
    actions: Actions,
    height: number,
    width: number,
) => {
    const cellSize = Math.max(1, Math.min(6,
        Math.floor((width - 4) / part.width), Math.floor(height / part.height)));
    const cells: VNode<{}>[] = [];
    for (let displayRow = 0; displayRow < part.height; displayRow += 1) {
        const sourceRow = part.height - displayRow - 1;
        for (let x = 0; x < part.width; x += 1) {
            const sourceIndex = x + sourceRow * part.width;
            const piece = part.cells[sourceIndex];
            cells.push(div({
                key: `part-cell-${sourceIndex}`,
                style: style({
                    background: piece === Piece.Empty ? '#111'
                        : decidePieceColor(piece, HighlightType.Normal, state.fumen.guideLineColor),
                    height: px(cellSize), width: px(cellSize),
                }),
            }));
        }
    }

    return div({
        style: style({
            alignItems: 'center', display: 'flex', justifyContent: 'center',
            height: '100%', position: 'relative', width: '100%',
        }),
    }, [
        div({
            key: 'part-grid',
            style: style({
                display: 'grid', gap: '0',
                gridTemplateColumns: `repeat(${part.width}, ${cellSize}px)`,
                gridTemplateRows: `repeat(${part.height}, ${cellSize}px)`,
            }),
        }, cells),
        span({
            key: 'part-pin',
            datatest: `btn-piece-${(parsePieceName(part.slot) ?? '').toLowerCase()}-pin`,
            role: 'button',
            'aria-label': part.pinned ? i18n.EditorUi.Unpin() : i18n.EditorUi.Pin(),
            onclick: (event: MouseEvent) => {
                event.preventDefault();
                event.stopPropagation();
                actions.togglePartPin({ slot: part.slot });
            },
            onpointerdown: (event: PointerEvent) => {
                event.preventDefault();
                event.stopPropagation();
            },
            onpointerup: (event: PointerEvent) => {
                event.preventDefault();
                event.stopPropagation();
            },
            onpointercancel: (event: PointerEvent) => {
                event.preventDefault();
                event.stopPropagation();
            },
            style: style({
                alignItems: 'center',
                background: part.pinned ? '#e3f2fd' : 'transparent',
                border: part.pinned ? '1px solid #90caf9' : '0',
                color: part.pinned ? '#1565c0' : '#757575',
                display: 'flex',
                height: px(20),
                justifyContent: 'center',
                opacity: part.pinned ? 1 : .45,
                position: 'absolute',
                right: '0',
                top: '50%',
                transform: 'translateY(-50%)',
                transition: 'background-color 100ms ease, border-color 100ms ease, opacity 100ms ease',
                width: px(18),
            }),
        }, [BlockIcon({ key: 'part-pin-icon', iconSize: 12 }, 'push_pin')]),
    ]);
};

const paletteContent = (
    selection: PaletteSelection, state: State, height: number, actions: Actions, width: number,
) => {
    const part = selection === 'comp' ? undefined : state.parts.items.find(item => item.slot === selection);
    if (state.editorUi.primaryTool === 'select' && part !== undefined) {
        return partPaletteSwatch(part, state, actions, height, width);
    }
    if (state.editorUi.primaryTool === 'select' && selection !== 'comp') {
        return div({
            'aria-hidden': 'true',
            'data-empty-part-slot': String(selection),
            style: style({ height: '100%', width: '100%' }),
        });
    }
    if (state.editorUi.primaryTool === 'piece' && selection === Piece.Empty) {
        return BlockIcon({ key: 'delete-piece-icon', iconSize: Math.max(14, height - 7) }, 'delete');
    }
    if (state.editorUi.primaryTool === 'piece' && selection === Piece.Gray) {
        if (width < 50) {
            return BlockIcon({ key: 'respawn-piece-icon', iconSize: Math.max(14, height - 7) }, 'refresh');
        }
        return span({
            key: 'reset-piece-label',
            style: style({ fontSize: px(Math.max(10, height * 0.3)), fontWeight: '600' }),
        }, i18n.EditorUi.ResetPiece());
    }
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
        if (state.editorUi.primaryTool === 'select') {
            const enabled = state.parts.blackTransparent;
            return div({
                'aria-hidden': 'true',
                style: style({
                    alignItems: 'center', display: 'flex', gap: px(3), height: '100%', justifyContent: 'center',
                    width: '100%',
                }),
            }, [
                BlockIcon({ key: 'empty-transparent-icon', iconSize: 13 }, enabled ? 'layers_clear' : 'layers'),
                div({
                    key: 'empty-transparent-switch',
                    style: style({
                        background: enabled ? '#1976d2' : '#9e9e9e',
                        borderRadius: px(8), height: px(14), padding: px(2), width: px(26),
                    }),
                }, [div({
                    key: 'empty-transparent-switch-knob',
                    style: style({
                        background: '#fff', borderRadius: '50%', height: px(10),
                        marginLeft: enabled ? px(12) : '0', transition: 'margin-left 100ms ease', width: px(10),
                    }),
                })]),
            ]);
        }
        if (state.editorUi.primaryTool === 'piece') {
            return span({
                key: 'infinite-bag-label',
                style: style({ fontSize: px(Math.max(16, height * 0.7)), fontWeight: '700' }),
            }, '∞');
        }
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

const paletteCellLabel = (state: State, selection: PaletteSelection): string => {
    if (state.editorUi.primaryTool === 'piece') {
        if (selection === Piece.Empty) return i18n.EditorUi.Delete();
        if (selection === Piece.Gray) return i18n.EditorUi.ResetPiece();
        if (selection === 'comp') return i18n.EditorUi.InfiniteBag();
    }
    if (selection === 'comp') return 'COMP';
    return parsePieceName(selection) ?? '';
};

const isPaletteCellSelected = (
    state: State, selection: PaletteSelection, part: State['parts']['items'][number] | undefined,
): boolean => {
    const tool = state.editorUi.primaryTool;
    if (selection === 'comp') {
        return tool === 'piece' && state.editorUi.infinitePieceQueue
            || tool === 'select' && state.parts.blackTransparent
            || tool === 'paint' && state.editorUi.paletteSelection === selection;
    }
    if (tool === 'select' && part !== undefined) {
        return state.parts.selectedId === part.id;
    }
    if (tool === 'piece' && (selection === Piece.Empty || selection === Piece.Gray)) {
        return false;
    }
    return state.editorUi.paletteSelection === selection;
};

export const getRailCellHeight = (layout: EditorLayout, pieceModeVisible = layout.pieceQueue.visible): number => (
    pieceModeVisible
        ? layout.pieceQueue.railCellHeight
            || getPieceRailMetrics(layout.field.size.height, layout.pieceQueue.width).railCellHeight
        : getResponsiveRailCellHeight(layout.field.size.height, layout.buttons.columns)
);

export const editorRail = (state: State, actions: Actions, layout: EditorLayout) => {
    const pieceModeVisible = state.editorUi.primaryTool === 'piece';
    const cellHeight = getRailCellHeight(layout, pieceModeVisible);
    const twoColumns = layout.buttons.columns === 2;
    const compact = shouldUseCompactEditorRail(layout.canvas.size.height, layout.buttons.columns);
    const text = (label: string) => compact ? '' : label;
    const iconSize = Math.max(14, Math.min(21, cellHeight - 7));
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

    const systemCells = [
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
    ];
    const systemGroup = toolGroup(pieceModeVisible ? 'rail-system-piece' : 'rail-system', pieceModeVisible
        ? systemCells
        : [row('rail-system-row', systemCells)]);

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
    ]);

    const pieceModeCell = toolCell({
        key: 'btn-piece-mode', datatest: 'btn-piece-mode', label: 'PIECE', height: cellHeight,
        selected: state.editorUi.primaryTool === 'piece',
        onpress: actions.togglePieceMode,
        onlongpress: () => executePieceShortcut('Reset', actions),
        children: [icon('extension', iconSize), ...(compact ? [] : [span({ key: 'piece' }, text('P'))])],
    });

    const coldClearCell = toolCell({
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
            }, state.coldClear.progress ? i18n.ColdClear.Progress(
                state.coldClear.progress.current,
                state.coldClear.progress.total,
            ) : ''),
        ],
    });
    const aiAndPieceCells = [pieceModeCell, coldClearCell];
    const aiAndPieceGroup = toolGroup(pieceModeVisible ? 'rail-ai-piece-piece' : 'rail-ai-piece', [
        row(pieceModeVisible ? 'rail-ai-piece-row-piece' : 'rail-ai-piece-row', aiAndPieceCells),
    ]);
    const auxiliaryAndAiGroup = div({
        key: 'rail-auxiliary-ai',
        style: style({
            display: 'flex',
            flexDirection: 'column',
            gap: px(4),
            width: '100%',
        }),
    }, [auxiliaryGroup, aiAndPieceGroup]);

    const modeCells = [
        toolCell({
            key: 'btn-select-mode', datatest: 'btn-select-mode', label: 'SELECT', height: cellHeight,
            selected: state.editorUi.primaryTool === 'select',
            onpress: () => actions.changePrimaryTool({ tool: 'select' }),
            children: [icon('select_all', iconSize), ...(compact ? [] : [span({
                key: 'select', style: style({ marginLeft: '3px' }),
            }, 'SELECT')])],
        }),
        toolCell({
            key: 'btn-paint-mode', datatest: 'btn-paint-mode', label: 'PAINT', height: cellHeight,
            selected: state.editorUi.primaryTool === 'paint',
            onpress: () => actions.changePrimaryTool({ tool: 'paint' }),
            children: [icon('brush', iconSize), ...(compact ? [] : [span({
                key: 'paint', style: style({ marginLeft: '3px' }),
            }, 'PAINT')])],
        }),
    ];
    const modeGroup = toolGroup('rail-modes', pieceModeVisible
        ? [row('rail-modes-row-piece', modeCells)]
        : modeCells);

    const selections: PaletteSelection[] = [
        Piece.I, Piece.L, Piece.O, Piece.Z, Piece.T, Piece.J, Piece.S, Piece.Empty, Piece.Gray, 'comp',
    ];
    const visibleSelections = state.editorUi.primaryTool === 'piece'
        ? selections.filter(selection => selection !== 'comp')
        : selections;
    const paletteCells: VNode<{}>[] = visibleSelections.map((selection) => {
        const name = selection === 'comp' ? 'inference' : (parsePieceName(selection) ?? '').toLowerCase();
        const part = selection === 'comp' ? undefined : state.parts.items.find(item => item.slot === selection);
        const label = paletteCellLabel(state, selection);
        const onlongpress = state.editorUi.primaryTool === 'select'
            ? part === undefined ? undefined : () => actions.togglePartPin({ slot: part.slot })
            : () => actions.executeEditorPaletteShortcut({ selection });
        return toolCell({
            onlongpress,
            label,
            height: cellHeight,
            key: `btn-piece-${name}`,
            datatest: `btn-piece-${name}`,
            selected: isPaletteCellSelected(state, selection, part),
            selectionKind: 'palette',
            onpress: () => {
                if (state.editorUi.primaryTool === 'piece' && selection === 'comp') {
                    actions.commitCommentText();
                    actions.toggleInfinitePieceQueue();
                    return;
                }
                if (state.editorUi.primaryTool === 'select' && selection === 'comp') {
                    actions.toggleBlackTransparentPaste();
                    return;
                }
                actions.selectEditorPalette({ selection });
            },
            children: withShortcut(paletteContent(selection, state, cellHeight, actions,
                layout.buttons.size.width / (twoColumns ? 2 : 1)),
                compact ? undefined : getPaletteShortcut(state, selection)),
        });
    });
    if (pieceModeVisible) {
        paletteCells.push(toolCell({
            key: 'btn-piece-reset',
            datatest: 'btn-piece-reset',
            label: i18n.EditorUi.ResetField(),
            height: cellHeight,
            onpress: () => actions.resetFieldAndPiece(),
            children: compact ? icon('layers_clear', iconSize) : [span({
                key: 'reset-field-label',
                style: style({ fontSize: px(Math.max(10, cellHeight * 0.3)), fontWeight: '600' }),
            }, i18n.EditorUi.ResetField())],
        }));
    }
    const paletteGroup = toolGroup('rail-palette', twoColumns
        ? [0, 1, 2, 3, 4].map(index => row(`rail-palette-row-${index + 1}`,
            paletteCells.slice(index * 2, index * 2 + 2)))
        : paletteCells);

    // PIECE時はキューと操作セルを広げるため、共有・設定・ページ・インスペクタ操作を描画しない
    const railGroups = pieceModeVisible
        ? [aiAndPieceGroup, modeGroup, paletteGroup]
        : [systemGroup, pageGroup, auxiliaryAndAiGroup, modeGroup, paletteGroup];
    const railBottomPadding = Math.max(0, layout.field.size.height
        - (layout.comment.topLeft.y - layout.field.topLeft.y));

    // PIECE時はNEXT枠の下（同じ右列）へ詰めて並べ、余りは最下部の空白として残す
    const railStyle = pieceModeVisible ? style({
        boxSizing: 'border-box',
        display: 'flex',
        flex: '1 1 auto',
        flexDirection: 'column',
        gap: px(6),
        marginTop: px(4),
        minHeight: '0',
        overflow: 'hidden',
        width: '100%',
    }) : style({
        alignSelf: 'center',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        height: px(layout.field.size.height),
        justifyContent: 'space-between',
        marginLeft: '8px',
        minWidth: px(layout.buttons.size.width),
        overflow: 'hidden',
        // Keep the last palette cell flush with the comment/tray boundary.
        // The palette group clips overflowing cells, so extra padding here
        // would cut off COMP even though its own rectangle still fits.
        paddingBottom: px(railBottomPadding),
        width: px(layout.buttons.size.width),
    });

    return div({
        // PIECE切替時は子構造（縦積み／通常レスポンシブ）が変わるため、
        // Hyperappに同じDOMを再利用させずレール全体を置き換える。
        key: pieceModeVisible ? 'editor-rail-piece' : 'editor-rail',
        datatest: 'editor-rail',
        'data-columns': String(layout.buttons.columns),
        style: railStyle,
    }, railGroups);
};

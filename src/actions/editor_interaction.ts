import { action, actions } from '../actions';
import {
    EditorInspector,
    PaintTool,
    PaletteSelection,
    PieceAction,
    PieceLayoutMode,
    PrimaryTool,
    State,
} from '../states';
import { ModeTypes, Piece, TouchTypes } from '../lib/enums';
import { NextState, sequence } from './commons';
import { inspectorAfterToolChange, isMinoPaletteSelection, legacyModeForPaintTool } from '../lib/editor_interaction';
import { floatingPartSpawn, initialRectSelectState } from '../lib/rect_selection';
import { persistViewSettings } from './view_settings';

export interface EditorInteractionActions {
    changePrimaryTool(data: { tool: PrimaryTool }): action;
    togglePieceMode(): action;
    selectPieceLayout(data: { layout: PieceLayoutMode }): action;
    changePieceLayout(data: { layout: PieceLayoutMode; persist?: boolean }): action;
    togglePieceLayout(): action;
    changePaintTool(data: { tool: PaintTool; restorePalette?: boolean }): action;
    changePieceAction(data: { pieceAction: PieceAction }): action;
    openEditorInspector(data: { inspector: Exclude<EditorInspector, 'none'> }): action;
    closeEditorInspector(): action;
    selectEditorPalette(data: { selection: PaletteSelection }): action;
    executeEditorPaletteShortcut(data: { selection: PaletteSelection }): action;
    showContextTray(): action;
    showSentLine(): action;
}

const focusInspectorTrigger = (inspector: EditorInspector) => {
    if (inspector === 'none') {
        return;
    }
    setTimeout(() => {
        const element = document.querySelector(`[datatest="btn-${inspector}-mode"]`) as HTMLElement | null;
        element?.focus();
    }, 0);
};

const clearUnsettledAndSet = (update: (state: State) => NextState) => (state: State): NextState => (
    sequence(state, [actions.removeUnsettledItems(), update])
);

const clearUnsettledAndSetUnlessRepeatedPart = (
    selection: PaletteSelection,
    update: (state: State) => NextState,
) => (state: State): NextState => {
    // The transparency switch changes the current floating preview in place.
    if (selection === 'comp'
        && state.editorUi.primaryTool === 'select'
        && state.rectSelect.status === 'floating') {
        return update(state);
    }
    const part = state.parts.items.find(item => item.slot === selection);
    if (state.editorUi.primaryTool === 'select'
        && part !== undefined
        && state.parts.selectedId === part.id
        && state.rectSelect.status === 'floating'
        && state.rectSelect.floating?.sourceRect === null) {
        return undefined;
    }
    return clearUnsettledAndSet(update)(state);
};

const cancelSelectionPreviewAndSet = (update: (state: State) => NextState) => (state: State): NextState => (
    sequence(state, [actions.cancelRectSelectionPreview(), actions.cancelSpawnMinoPick(), update])
);

const previousPrimaryTool = (state: State): Exclude<PrimaryTool, 'piece'> | undefined => (
    state.editorUi.primaryTool === 'piece'
        ? state.editorUi.previousPrimaryTool
        : state.editorUi.primaryTool
);

export const editorInteractionActions: Readonly<EditorInteractionActions> = {
    changePrimaryTool: ({ tool }) => cancelSelectionPreviewAndSet((state) => {
        // 同じボタンをもう一度押したときはトレイを閉じるトグル動作にする。
        // ただし PAINT は Slide/Comment モード中も primaryTool:'paint' のままのため、
        // それらのモードから戻る操作をトグルの「閉じる」と誤認しないよう除外する。
        const alreadyShowingThisTray = state.editorUi.primaryTool === tool
            && !(tool === 'paint' && (state.mode.type === ModeTypes.Slide || state.mode.type === ModeTypes.Comment));
        const bottomSlot = alreadyShowingThisTray && state.editorUi.bottomSlot === 'tray' ? 'sentLine' : 'tray';
        if (tool === 'paint') {
            const legacy = legacyModeForPaintTool(state.editorUi.paintTool);
            return {
                mode: { ...state.mode, ...legacy },
                editorUi: {
                    ...state.editorUi,
                    bottomSlot,
                    previousPrimaryTool: previousPrimaryTool(state),
                    primaryTool: tool,
                    inspector: inspectorAfterToolChange(state),
                },
                parts: { ...state.parts, selectedId: null },
                rectSelect: initialRectSelectState,
            };
        }
        if (tool === 'piece') {
            const page = state.fumen.pages[state.fumen.currentIndex];
            const pieceAction: PieceAction = page?.piece !== undefined ? 'drag' : 'spawn';
            const editorUi: State['editorUi'] = {
                ...state.editorUi,
                bottomSlot,
                previousPrimaryTool: previousPrimaryTool(state),
                primaryTool: tool,
                inspector: inspectorAfterToolChange(state),
            };
            editorUi.pieceAction = pieceAction;
            return {
                editorUi,
                mode: {
                    ...state.mode,
                    type: ModeTypes.Piece,
                    touch: pieceAction === 'drag' ? TouchTypes.MovePiece : TouchTypes.Piece,
                },
                parts: { ...state.parts, selectedId: null },
                rectSelect: initialRectSelectState,
            };
        }
        return {
            mode: { ...state.mode, type: ModeTypes.Select, touch: TouchTypes.Select },
            editorUi: {
                ...state.editorUi,
                bottomSlot,
                primaryTool: tool,
                inspector: inspectorAfterToolChange(state),
            },
        };
    }),
    // PIECEとPlayは対等な画面入口。押された行先を常に直接選び、PIECE状態をトグルしない。
    selectPieceLayout: ({ layout }) => cancelSelectionPreviewAndSet((state) => {
        if (state.editorUi.pieceLayout !== layout) {
            persistViewSettings(state, { pieceLayout: layout });
        }
        const page = state.fumen.pages[state.fumen.currentIndex];
        const pieceAction: PieceAction = page?.piece !== undefined ? 'drag' : 'spawn';
        return {
            editorUi: {
                ...state.editorUi,
                pieceAction,
                bottomSlot: 'tray',
                previousPrimaryTool: previousPrimaryTool(state),
                primaryTool: 'piece',
                inspector: inspectorAfterToolChange(state),
                pieceLayout: layout,
            },
            mode: {
                ...state.mode,
                type: ModeTypes.Piece,
                touch: pieceAction === 'drag' ? TouchTypes.MovePiece : TouchTypes.Piece,
            },
            parts: { ...state.parts, selectedId: null },
            rectSelect: initialRectSelectState,
        };
    }),
    // 既存のショートカット／呼び出し元との互換性を保つ。
    // 直接入口ではないため、復元済みのレイアウト設定をそのまま使う。
    togglePieceMode: () => (state): NextState => (
        editorInteractionActions.changePrimaryTool({ tool: 'piece' })(state)
    ),
    // PIECE状態の表示切替のみ。ページ内容・#Q=・primaryTool には触れない。
    changePieceLayout: ({ layout, persist = true }) => (state): NextState => {
        if (state.editorUi.pieceLayout === layout) {
            return undefined;
        }

        if (persist) {
            persistViewSettings(state, { pieceLayout: layout });
        }
        return {
            editorUi: {
                ...state.editorUi,
                pieceLayout: layout,
            },
        };
    },
    togglePieceLayout: () => (state): NextState => (
        editorInteractionActions.changePieceLayout({
            layout: state.editorUi.pieceLayout === 'play' ? 'select' : 'play',
        })(state)
    ),
    changePaintTool: ({ tool, restorePalette = false }) => cancelSelectionPreviewAndSet((state) => {
        const legacy = legacyModeForPaintTool(tool);
        const paletteSelection = restorePalette && state.editorUi.paletteSelection === Piece.Empty
            ? state.editorUi.previousPaletteSelection ?? 'comp'
            : state.editorUi.paletteSelection;
        return {
            mode: {
                ...state.mode,
                ...legacy,
                piece: paletteSelection === 'comp' ? undefined : paletteSelection,
            },
            editorUi: {
                ...state.editorUi,
                paletteSelection,
                primaryTool: 'paint',
                paintTool: tool,
                inspector: inspectorAfterToolChange(state),
                bottomSlot: 'tray',
            },
            parts: { ...state.parts, selectedId: null },
            rectSelect: initialRectSelectState,
        };
    }),
    changePieceAction: ({ pieceAction }) => cancelSelectionPreviewAndSet((state) => {
        const editorUi: State['editorUi'] = {
            ...state.editorUi,
            previousPrimaryTool: previousPrimaryTool(state),
            primaryTool: 'piece',
            inspector: inspectorAfterToolChange(state),
            bottomSlot: 'tray',
        };
        editorUi.pieceAction = pieceAction;
        return {
            editorUi,
            mode: {
                ...state.mode,
                type: ModeTypes.Piece,
                touch: pieceAction === 'drag' ? TouchTypes.MovePiece : TouchTypes.Piece,
            },
            parts: { ...state.parts, selectedId: null },
            rectSelect: initialRectSelectState,
        };
    }),
    openEditorInspector: ({ inspector }) => (state): NextState => ({
        editorUi: {
            ...state.editorUi,
            inspector,
        },
    }),
    closeEditorInspector: () => (state): NextState => {
        const inspector = state.editorUi.inspector;
        if (inspector === 'none') {
            return undefined;
        }
        focusInspectorTrigger(inspector);
        return {
            editorUi: {
                ...state.editorUi,
                inspector: 'none',
            },
        };
    },
    selectEditorPalette: ({ selection }) => clearUnsettledAndSetUnlessRepeatedPart(selection, (state) => {
        if (state.editorUi.primaryTool === 'select') {
            if (selection === 'comp') {
                return sequence(state, [
                    actions.toggleBlackTransparentPaste(),
                    nextState => ({
                        editorUi: { ...nextState.editorUi, paletteSelection: selection },
                    }),
                ]);
            }
            const part = state.parts.items.find(item => item.slot === selection);
            const selectedId = part?.id ?? null;
            const samePartIsFloating = part !== undefined
                && state.parts.selectedId === part.id
                && state.rectSelect.status === 'floating'
                && state.rectSelect.floating?.sourceRect === null;
            if (samePartIsFloating) {
                return undefined;
            }
            return {
                mode: { ...state.mode, type: ModeTypes.Select, touch: TouchTypes.Select },
                editorUi: {
                    ...state.editorUi,
                    paletteSelection: selection,
                    primaryTool: 'select',
                    inspector: inspectorAfterToolChange(state),
                },
                parts: { ...state.parts, selectedId },
                rectSelect: part !== undefined && selectedId !== null
                    ? {
                        status: 'floating',
                        rect: null,
                        anchorIndex: null,
                        floating: floatingPartSpawn(part.cells, part.width, part.height, state.field),
                        reselectOnNextTouch: false,
                    }
                    : initialRectSelectState,
            };
        }
        if (state.editorUi.primaryTool === 'piece') {
            const keepPieceMode = (
                nextState: State,
                lastMino = nextState.editorUi.lastMino,
            ): Partial<State> => {
                const hasPiece = nextState.fumen.pages[nextState.fumen.currentIndex]?.piece !== undefined;
                return {
                    editorUi: {
                        ...nextState.editorUi,
                        lastMino,
                        primaryTool: 'piece',
                        paletteSelection: selection,
                        pieceAction: hasPiece ? 'drag' : 'spawn',
                        inspector: inspectorAfterToolChange(nextState),
                        bottomSlot: 'tray',
                    },
                    mode: {
                        ...nextState.mode,
                        type: ModeTypes.Piece,
                        touch: hasPiece ? TouchTypes.MovePiece : TouchTypes.Piece,
                    },
                };
            };

            if (isMinoPaletteSelection(selection)) {
                return sequence(state, [
                    actions.spawnPiece({
                        piece: selection,
                        srs: state.mode.rotationSystem !== 'classic',
                    }),
                    nextState => keepPieceMode(nextState, selection),
                ]);
            }
            if (selection === 'comp') {
                return sequence(state, [
                    actions.commitCommentText(),
                    actions.toggleInfinitePieceQueue(),
                ]);
            }
            if (selection === Piece.Empty) {
                return sequence(state, [
                    actions.clearPiece(),
                    keepPieceMode,
                ]);
            }
            if (selection === Piece.Gray) {
                return sequence(state, [
                    actions.resetPiece(),
                    keepPieceMode,
                ]);
            }
            return keepPieceMode(state);
        }
        const legacy = legacyModeForPaintTool(state.editorUi.paintTool);
        return {
            mode: {
                ...state.mode,
                ...legacy,
                piece: selection === 'comp' ? undefined : selection,
            },
            editorUi: {
                ...state.editorUi,
                primaryTool: 'paint',
                inspector: inspectorAfterToolChange(state),
                paletteSelection: selection,
                previousPaletteSelection: selection === Piece.Empty
                    ? state.editorUi.previousPaletteSelection
                    : selection,
                bottomSlot: state.editorUi.bottomSlot,
            },
            ...(state.mode.type === ModeTypes.Slide ? {
                rectSelect: initialRectSelectState,
            } : {}),
        };
    }),
    executeEditorPaletteShortcut: ({ selection }) => (state): NextState => {
        if (state.editorUi.primaryTool === 'piece') {
            return sequence(state, [
                editorInteractionActions.selectEditorPalette({ selection }),
                ...(isMinoPaletteSelection(selection)
                    ? [editorInteractionActions.changePieceLayout({ layout: 'select' })]
                    : []),
            ]);
        }
        if (selection === 'comp') {
            return actions.convertToBlack()(state);
        }
        if (selection === Piece.Empty) {
            return actions.clearFieldAndPiece()(state);
        }
        if (selection === Piece.Gray) {
            return actions.convertToGray()(state);
        }
        if (!isMinoPaletteSelection(selection)) {
            return undefined;
        }
        return sequence(state, [
            actions.spawnPiece({ piece: selection, srs: state.mode.rotationSystem !== 'classic' }),
            editorInteractionActions.changePieceLayout({ layout: 'select' }),
            nextState => ({
                mode: {
                    ...nextState.mode,
                    type: ModeTypes.Piece,
                    touch: TouchTypes.MovePiece,
                },
                editorUi: {
                    ...nextState.editorUi,
                    previousPrimaryTool: previousPrimaryTool(state),
                    primaryTool: 'piece',
                    pieceAction: 'drag',
                    inspector: inspectorAfterToolChange(nextState),
                    lastMino: selection,
                    bottomSlot: 'tray',
                },
            }),
        ]);
    },
    showContextTray: () => (state): NextState => ({
        editorUi: { ...state.editorUi, bottomSlot: 'tray' },
    }),
    showSentLine: () => (state): NextState => ({
        editorUi: { ...state.editorUi, bottomSlot: 'sentLine' },
    }),
};

import { action, actions } from '../actions';
import {
    EditorInspector,
    PaintTool,
    PaletteSelection,
    PieceAction,
    PrimaryTool,
    State,
} from '../states';
import { ModeTypes, Piece, TouchTypes } from '../lib/enums';
import { NextState, sequence } from './commons';
import { isMinoPaletteSelection, legacyModeForPaintTool } from '../lib/editor_interaction';
import { floatingPartAtTop } from '../lib/rect_selection';

export interface EditorInteractionActions {
    changePrimaryTool(data: { tool: PrimaryTool }): action;
    togglePieceMode(): action;
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
    sequence(state, [actions.cancelRectSelectionPreview(), update])
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
                    inspector: 'none',
                },
                parts: { ...state.parts, selectedId: null },
                rectSelect: { status: 'none', rect: null, anchorIndex: null, floating: null },
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
                inspector: 'none',
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
                rectSelect: { status: 'none', rect: null, anchorIndex: null, floating: null },
            };
        }
        return {
            mode: { ...state.mode, type: ModeTypes.Select, touch: TouchTypes.Select },
            editorUi: {
                ...state.editorUi,
                bottomSlot,
                primaryTool: tool,
                inspector: 'none',
            },
        };
    }),
    togglePieceMode: () => (state): NextState => (
        editorInteractionActions.changePrimaryTool({
            tool: state.editorUi.primaryTool === 'piece'
                ? state.editorUi.previousPrimaryTool ?? 'paint'
                : 'piece',
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
                inspector: 'none',
                bottomSlot: 'tray',
            },
            parts: { ...state.parts, selectedId: null },
            rectSelect: { status: 'none', rect: null, anchorIndex: null, floating: null },
        };
    }),
    changePieceAction: ({ pieceAction }) => cancelSelectionPreviewAndSet((state) => {
        const editorUi: State['editorUi'] = {
            ...state.editorUi,
            previousPrimaryTool: previousPrimaryTool(state),
            primaryTool: 'piece',
            inspector: 'none',
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
            rectSelect: { status: 'none', rect: null, anchorIndex: null, floating: null },
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
                    inspector: 'none',
                },
                parts: { ...state.parts, selectedId },
                rectSelect: part !== undefined && selectedId !== null
                    ? {
                        status: 'floating',
                        rect: null,
                        anchorIndex: null,
                        floating: floatingPartAtTop(part.cells, part.width, part.height),
                        reselectOnNextTouch: false,
                    }
                    : { status: 'none', rect: null, anchorIndex: null, floating: null },
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
                        inspector: 'none',
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
                inspector: 'none',
                paletteSelection: selection,
                previousPaletteSelection: selection === Piece.Empty
                    ? state.editorUi.previousPaletteSelection
                    : selection,
                bottomSlot: state.editorUi.bottomSlot,
            },
            ...(state.mode.type === ModeTypes.Slide ? {
                rectSelect: { status: 'none', rect: null, anchorIndex: null, floating: null },
            } : {}),
        };
    }),
    executeEditorPaletteShortcut: ({ selection }) => (state): NextState => {
        if (state.editorUi.primaryTool === 'piece') {
            return editorInteractionActions.selectEditorPalette({ selection })(state);
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
                    inspector: 'none',
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

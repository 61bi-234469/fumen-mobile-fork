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

export interface EditorInteractionActions {
    changePrimaryTool(data: { tool: PrimaryTool }): action;
    changePaintTool(data: { tool: PaintTool }): action;
    changePieceAction(data: { pieceAction: PieceAction }): action;
    openEditorInspector(data: { inspector: Exclude<EditorInspector, 'none'> }): action;
    closeEditorInspector(): action;
    selectEditorPalette(data: { selection: PaletteSelection }): action;
    executeEditorPaletteShortcut(data: { selection: PaletteSelection }): action;
    showContextTray(): action;
    showSentLine(): action;
    toggleBottomSlot(): action;
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

const cancelSelectionPreviewAndSet = (update: (state: State) => NextState) => (state: State): NextState => (
    sequence(state, [actions.cancelRectSelectionPreview(), update])
);

export const editorInteractionActions: Readonly<EditorInteractionActions> = {
    changePrimaryTool: ({ tool }) => cancelSelectionPreviewAndSet((state) => {
        if (tool === 'paint') {
            const legacy = legacyModeForPaintTool(state.editorUi.paintTool);
            return {
                mode: { ...state.mode, ...legacy },
                editorUi: {
                    ...state.editorUi,
                    primaryTool: tool,
                    inspector: 'none',
                    bottomSlot: 'tray',
                },
            };
        }
        if (tool === 'piece') {
            const page = state.fumen.pages[state.fumen.currentIndex];
            const pieceAction: PieceAction = page?.piece !== undefined ? 'drag' : 'spawn';
            const editorUi: State['editorUi'] = {
                ...state.editorUi,
                primaryTool: tool,
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
            };
        }
        return {
            mode: { ...state.mode, type: ModeTypes.Select, touch: TouchTypes.Select },
            editorUi: {
                ...state.editorUi,
                primaryTool: tool,
                inspector: 'none',
                bottomSlot: 'tray',
            },
        };
    }),
    changePaintTool: ({ tool }) => cancelSelectionPreviewAndSet((state) => {
        const legacy = legacyModeForPaintTool(tool);
        return {
            mode: { ...state.mode, ...legacy },
            editorUi: {
                ...state.editorUi,
                primaryTool: 'paint',
                paintTool: tool,
                inspector: 'none',
                bottomSlot: 'tray',
            },
        };
    }),
    changePieceAction: ({ pieceAction }) => cancelSelectionPreviewAndSet((state) => {
        const editorUi: State['editorUi'] = {
            ...state.editorUi,
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
    selectEditorPalette: ({ selection }) => clearUnsettledAndSet((state) => {
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
                bottomSlot: 'tray',
            },
        };
    }),
    executeEditorPaletteShortcut: ({ selection }) => (state): NextState => {
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
    toggleBottomSlot: () => (state): NextState => ({
        editorUi: { ...state.editorUi, bottomSlot: state.editorUi.bottomSlot === 'tray' ? 'sentLine' : 'tray' },
    }),
};

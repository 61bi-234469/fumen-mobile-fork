/* tslint:disable:object-shorthand-properties-first */
import { action, actions } from '../actions';
import { FieldConstants, Piece } from '../lib/enums';
import { PageFieldOperation, Pages, parseToCommands } from '../lib/pages';
import {
    clampFloatingTarget,
    extractRectPieces,
    floatingRect,
    isIndexInRect,
    mirrorPartCells,
    rectFromIndices,
    rectHeight,
    rectWidth,
    rotatePartCells,
} from '../lib/rect_selection';
import { limitParts, saveBlackTransparentPaste, saveParts } from '../lib/parts';
import { generateKey } from '../lib/random';
import { toPrimitivePage, toSinglePageTask } from '../history_task';
import { EditorPart, FloatingSelection, SelectionRect, State } from '../states';
import { NextState, sequence } from './commons';

export interface RectSelectActions {
    startRectSelection(data: { index: number }): action;
    moveRectSelection(data: { index: number }): action;
    endRectSelection(): action;
    cancelRectSelectionPreview(): action;
    clearRectSelection(): action;
    deleteRectSelection(): action;
    mirrorRectSelection(): action;
    beginMoveRectSelection(): action;
    copyRectSelection(): action;
    cutRectSelection(): action;
    activateStamp(): action;
    deactivateStamp(): action;
    useSingleStamp(): action;
    selectPart(data: { id: string }): action;
    rotateSelectedPart(): action;
    mirrorSelectedPart(): action;
    removeSelectedPart(): action;
    toggleSelectedPartPin(): action;
    toggleContinuousStamp(): action;
    toggleBlackTransparentPaste(): action;
}

const extractCurrentPieces = (state: State, rect: SelectionRect): Piece[] => {
    const field = new Pages(state.fumen.pages).getField(state.fumen.currentIndex, PageFieldOperation.Command);
    return extractRectPieces(field.toPlayFieldPieces().map(piece => ({ piece })), rect);
};

const createPart = (state: State, rect: SelectionRect): EditorPart => ({
    id: generateKey(),
    width: rectWidth(rect),
    height: rectHeight(rect),
    cells: extractCurrentPieces(state, rect),
    pinned: false,
    createdAt: Date.now(),
});

const addPart = (part: EditorPart) => (state: State): NextState => {
    const items = limitParts([part].concat(state.parts.items));
    saveParts(items);
    return {
        parts: {
            ...state.parts,
            items,
        },
    };
};

const updateSelectedPart = (
    update: (part: EditorPart) => EditorPart,
) => (state: State): NextState => {
    if (state.parts.selectedId === null) {
        return undefined;
    }
    let changed = false;
    const items = state.parts.items.map((part) => {
        if (part.id !== state.parts.selectedId) {
            return part;
        }
        changed = true;
        return update(part);
    });
    if (!changed) {
        return undefined;
    }
    saveParts(items);
    return {
        parts: {
            ...state.parts,
            items,
        },
    };
};

const commitFloating = (floating: FloatingSelection) => (state: State): NextState => {
    if (floating.kind === 'move' && floating.sourceRect !== null
        && floating.targetX === floating.sourceRect.minX && floating.targetY === floating.sourceRect.minY) {
        return {
            rectSelect: {
                status: 'selected', rect: floating.sourceRect, anchorIndex: null, floating: null,
            },
        };
    }
    const currentIndex = state.fumen.currentIndex;
    const pages = state.fumen.pages.map((page, index) => index === currentIndex ? { ...page } : page);
    const page = pages[currentIndex];
    if (page === undefined) {
        return undefined;
    }
    const pagesObj = new Pages(pages);
    const primitivePage = toPrimitivePage(page);
    const goalField = pagesObj.getField(currentIndex, PageFieldOperation.Command);
    if (floating.sourceRect !== null) {
        for (let y = floating.sourceRect.minY; y <= floating.sourceRect.maxY; y += 1) {
            for (let x = floating.sourceRect.minX; x <= floating.sourceRect.maxX; x += 1) {
                goalField.setToPlayField(x + y * FieldConstants.Width, Piece.Empty);
            }
        }
    }
    for (let y = 0; y < floating.height; y += 1) {
        for (let x = 0; x < floating.width; x += 1) {
            const piece = floating.cells[x + y * floating.width];
            if (floating.kind === 'stamp' && state.parts.blackTransparent && piece === Piece.Empty) {
                continue;
            }
            const index = floating.targetX + x + (floating.targetY + y) * FieldConstants.Width;
            goalField.setToPlayField(index, piece);
        }
    }
    const prevField = pagesObj.getField(currentIndex, PageFieldOperation.None);
    page.commands = parseToCommands(prevField, goalField);
    const rect = floatingRect(floating);
    const selectedId = floating.kind === 'stamp' && !state.parts.continuous ? null : state.parts.selectedId;

    return sequence(state, [
        actions.registerHistoryTask({ task: toSinglePageTask(currentIndex, primitivePage, page) }),
        newState => ({
            fumen: {
                ...newState.fumen,
                pages,
            },
            rectSelect: {
                status: 'selected',
                rect,
                anchorIndex: null,
                floating: null,
            },
            parts: {
                ...newState.parts,
                selectedId,
            },
        }),
        actions.reopenCurrentPage(),
    ]);
};

const floatingFromSelection = (state: State, rect: SelectionRect): FloatingSelection => ({
    cells: extractCurrentPieces(state, rect),
    width: rectWidth(rect),
    height: rectHeight(rect),
    sourceRect: rect,
    targetX: rect.minX,
    targetY: rect.minY,
    pointerOffsetX: 0,
    pointerOffsetY: 0,
    kind: 'move',
});

const selectedPart = (state: State): EditorPart | undefined => (
    state.parts.items.find(part => part.id === state.parts.selectedId)
);

export const rectSelectActions: Readonly<RectSelectActions> = {
    startRectSelection: ({ index }) => (state): NextState => {
        const part = selectedPart(state);
        if (part !== undefined) {
            const floating: FloatingSelection = {
                cells: part.cells,
                width: part.width,
                height: part.height,
                sourceRect: null,
                targetX: 0,
                targetY: 0,
                pointerOffsetX: 0,
                pointerOffsetY: 0,
                kind: 'stamp',
            };
            const target = clampFloatingTarget(floating, index);
            floating.targetX = target.x;
            floating.targetY = target.y;
            return {
                rectSelect: {
                    ...state.rectSelect,
                    status: 'floating',
                    anchorIndex: index,
                    floating,
                },
            };
        }
        if (state.rectSelect.status === 'floating' && state.rectSelect.floating !== null) {
            const floating = { ...state.rectSelect.floating };
            const pointerX = index % FieldConstants.Width;
            const pointerY = Math.floor(index / FieldConstants.Width);
            floating.pointerOffsetX = pointerX - floating.targetX;
            floating.pointerOffsetY = pointerY - floating.targetY;
            return {
                rectSelect: { ...state.rectSelect, anchorIndex: index, floating },
            };
        }
        const rect = state.rectSelect.rect;
        if (state.rectSelect.status === 'selected' && rect !== null && isIndexInRect(index, rect)) {
            const floating = floatingFromSelection(state, rect);
            const pointerX = index % FieldConstants.Width;
            const pointerY = Math.floor(index / FieldConstants.Width);
            floating.pointerOffsetX = pointerX - rect.minX;
            floating.pointerOffsetY = pointerY - rect.minY;
            return {
                rectSelect: { status: 'floating', rect, anchorIndex: index, floating },
            };
        }
        return {
            rectSelect: {
                status: 'selecting',
                rect: rectFromIndices(index, index),
                anchorIndex: index,
                floating: null,
            },
        };
    },
    moveRectSelection: ({ index }) => (state): NextState => {
        if (state.rectSelect.status === 'selecting' && state.rectSelect.anchorIndex !== null) {
            return {
                rectSelect: {
                    ...state.rectSelect,
                    rect: rectFromIndices(state.rectSelect.anchorIndex, index),
                },
            };
        }
        if (state.rectSelect.status === 'floating' && state.rectSelect.floating !== null) {
            const floating = { ...state.rectSelect.floating };
            const target = clampFloatingTarget(floating, index);
            floating.targetX = target.x;
            floating.targetY = target.y;
            return { rectSelect: { ...state.rectSelect, floating } };
        }
        return undefined;
    },
    endRectSelection: () => (state): NextState => {
        if (state.rectSelect.status === 'selecting') {
            return {
                rectSelect: { ...state.rectSelect, status: 'selected', anchorIndex: null },
            };
        }
        if (state.rectSelect.status === 'floating' && state.rectSelect.floating !== null) {
            return commitFloating(state.rectSelect.floating)(state);
        }
        return undefined;
    },
    cancelRectSelectionPreview: () => (state): NextState => {
        if (state.rectSelect.status === 'selecting') {
            return { rectSelect: { status: 'none', rect: null, anchorIndex: null, floating: null } };
        }
        if (state.rectSelect.status === 'floating') {
            const rect = state.rectSelect.floating?.sourceRect ?? state.rectSelect.rect;
            return {
                rectSelect: {
                    status: rect === null ? 'none' : 'selected',
                    rect,
                    anchorIndex: null,
                    floating: null,
                },
            };
        }
        return undefined;
    },
    clearRectSelection: () => (state): NextState => {
        if (state.rectSelect.status === 'none') {
            return undefined;
        }
        return { rectSelect: { status: 'none', rect: null, anchorIndex: null, floating: null } };
    },
    deleteRectSelection: () => (state): NextState => {
        if (state.rectSelect.status === 'floating' && state.rectSelect.floating !== null) {
            if (state.rectSelect.floating.sourceRect === null) {
                return rectSelectActions.cancelRectSelectionPreview()(state);
            }
            const floating = { ...state.rectSelect.floating };
            floating.cells = floating.cells.map(() => Piece.Empty);
            return commitFloating(floating)(state);
        }
        const rect = state.rectSelect.rect;
        if (state.rectSelect.status !== 'selected' || rect === null) {
            return undefined;
        }
        const floating = floatingFromSelection(state, rect);
        floating.cells = floating.cells.map(() => Piece.Empty);
        return commitFloating(floating)(state);
    },
    mirrorRectSelection: () => (state): NextState => {
        const rect = state.rectSelect.rect;
        if (state.rectSelect.status !== 'selected' || rect === null) {
            return undefined;
        }
        return {
            rectSelect: {
                ...state.rectSelect,
                rect: {
                    minX: FieldConstants.Width - 1 - rect.maxX,
                    maxX: FieldConstants.Width - 1 - rect.minX,
                    minY: rect.minY,
                    maxY: rect.maxY,
                },
            },
        };
    },
    beginMoveRectSelection: () => (state): NextState => {
        const rect = state.rectSelect.rect;
        if (state.rectSelect.status !== 'selected' || rect === null) {
            return undefined;
        }
        return {
            rectSelect: {
                status: 'floating',
                rect,
                anchorIndex: null,
                floating: floatingFromSelection(state, rect),
            },
        };
    },
    copyRectSelection: () => (state): NextState => {
        const rect = state.rectSelect.rect;
        if (state.rectSelect.status !== 'selected' || rect === null) {
            return undefined;
        }
        return addPart(createPart(state, rect))(state);
    },
    cutRectSelection: () => (state): NextState => {
        const rect = state.rectSelect.rect;
        if (state.rectSelect.status !== 'selected' || rect === null) {
            return undefined;
        }
        const part = createPart(state, rect);
        const floating = floatingFromSelection(state, rect);
        floating.cells = floating.cells.map(() => Piece.Empty);
        return sequence(state, [addPart(part), commitFloating(floating)]);
    },
    activateStamp: () => (state): NextState => {
        const selectedId = state.parts.selectedId ?? state.parts.items[0]?.id ?? null;
        if (selectedId === null) {
            return undefined;
        }
        return {
            parts: { ...state.parts, selectedId },
            editorUi: { ...state.editorUi, primaryTool: 'select', compactPanel: 'tray' },
        };
    },
    deactivateStamp: () => (state): NextState => ({
        parts: { ...state.parts, selectedId: null, continuous: false },
        rectSelect: state.rectSelect.status === 'floating'
            ? { status: 'none', rect: null, anchorIndex: null, floating: null }
            : state.rectSelect,
    }),
    useSingleStamp: () => (state): NextState => ({
        parts: { ...state.parts, continuous: false },
    }),
    selectPart: ({ id }) => (state): NextState => {
        if (!state.parts.items.some(part => part.id === id)) {
            return undefined;
        }
        return { parts: { ...state.parts, selectedId: id } };
    },
    rotateSelectedPart: () => updateSelectedPart((part) => {
        const rotated = rotatePartCells(part.cells, part.width, part.height);
        return { ...part, ...rotated };
    }),
    mirrorSelectedPart: () => updateSelectedPart(part => ({
        ...part,
        cells: mirrorPartCells(part.cells, part.width, part.height),
    })),
    removeSelectedPart: () => (state): NextState => {
        if (state.parts.selectedId === null) {
            return undefined;
        }
        const items = state.parts.items.filter(part => part.id !== state.parts.selectedId);
        saveParts(items);
        return { parts: { ...state.parts, items, selectedId: null } };
    },
    toggleSelectedPartPin: () => updateSelectedPart(part => ({ ...part, pinned: !part.pinned })),
    toggleContinuousStamp: () => (state): NextState => ({
        parts: { ...state.parts, continuous: !state.parts.continuous },
    }),
    toggleBlackTransparentPaste: () => (state): NextState => {
        const blackTransparent = !state.parts.blackTransparent;
        saveBlackTransparentPaste(state.parts.items, blackTransparent);
        return { parts: { ...state.parts, blackTransparent } };
    },
};

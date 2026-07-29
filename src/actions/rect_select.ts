/* tslint:disable:object-shorthand-properties-first */
import { action, actions } from '../actions';
import { FieldConstants, isMinoPiece, Piece, toPositionIndex } from '../lib/enums';
import { getBlockPositions } from '../lib/piece';
import { PageFieldOperation, Pages, parseToCommands } from '../lib/pages';
import {
    floatingTargetForPointer,
    extractRectPieces,
    floatingPartSpawn,
    floatingRect,
    initialRectSelectState,
    isIndexInRect,
    mirrorPartCells,
    rotatePartCellsLeft,
    rectFromIndices,
    rectHeight,
    rectWidth,
    rotatePartCells,
} from '../lib/rect_selection';
import { insertPart, repackParts, saveBlackTransparentPaste, saveParts } from '../lib/parts';
import { generateKey } from '../lib/random';
import { toPrimitivePage, toSinglePageTask } from '../history_task';
import { EditorPart, FloatingSelection, RectSelectState, SelectionRect, State } from '../states';
import { NextState, sequence } from './commons';

export interface RectSelectActions {
    startRectSelection(data: { index: number }): action;
    moveRectSelection(data: { index: number }): action;
    endRectSelection(): action;
    commitRectSelection(): action;
    cancelRectSelectionPreview(): action;
    clearRectSelection(): action;
    deleteRectSelection(): action;
    deleteSelectionUnderEraser(): action;
    mirrorRectSelection(): action;
    beginMoveRectSelection(): action;
    beginWholeFieldMove(): action;
    copyRectSelection(): action;
    cutRectSelection(): action;
    selectPart(data: { id: string }): action;
    togglePartPin(data: { slot: Piece }): action;
    rotateSelectedPartLeft(): action;
    rotateSelectedPartRight(): action;
    mirrorSelectedPart(): action;
    toggleBlackTransparentPaste(): action;
}

const extractCurrentPieces = (state: State, rect: SelectionRect): Piece[] => {
    const field = new Pages(state.fumen.pages).getField(state.fumen.currentIndex, PageFieldOperation.Command);
    return extractRectPieces(field.toPlayFieldPieces().map(piece => ({ piece })), rect);
};

const savePartToSlot = (part: EditorPart) => (state: State): NextState => {
    const items = insertPart(state.parts.items, part);
    if (items === undefined) {
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

const floatingMatchesSource = (state: State, floating: FloatingSelection): boolean => {
    if (floating.sourceRect === null
        || floating.targetX !== floating.sourceRect.minX
        || floating.targetY !== floating.sourceRect.minY
        || floating.width !== rectWidth(floating.sourceRect)
        || floating.height !== rectHeight(floating.sourceRect)) {
        return false;
    }
    const original = extractCurrentPieces(state, floating.sourceRect);
    return original.length === floating.cells.length
        && original.every((piece, index) => piece === floating.cells[index]);
};

const commitFloating = (floating: FloatingSelection) => (state: State): NextState => {
    if (floatingMatchesSource(state, floating)) {
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
                if (0 <= x && x < FieldConstants.Width && 0 <= y && y < FieldConstants.Height) {
                    goalField.setToPlayField(x + y * FieldConstants.Width, Piece.Empty);
                }
            }
        }
    }
    for (let y = 0; y < floating.height; y += 1) {
        for (let x = 0; x < floating.width; x += 1) {
            const targetX = floating.targetX + x;
            const targetY = floating.targetY + y;
            if (targetX < 0 || FieldConstants.Width <= targetX
                || targetY < 0 || FieldConstants.Height <= targetY) {
                continue;
            }
            const index = targetX + targetY * FieldConstants.Width;
            const piece = floating.cells[x + y * floating.width];
            if (state.parts.blackTransparent && floating.forceEmpty !== true && piece === Piece.Empty) {
                continue;
            }
            goalField.setToPlayField(index, piece);
        }
    }
    const prevField = pagesObj.getField(currentIndex, PageFieldOperation.None);
    page.commands = parseToCommands(prevField, goalField);
    const rect = floatingRect(floating);
    const selectedId = state.parts.selectedId;

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
                reselectOnNextTouch: floating.sourceRect === null,
            },
            parts: {
                ...newState.parts,
                selectedId: floating.sourceRect === null ? null : selectedId,
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
});

const selectedPart = (state: State): EditorPart | undefined => (
    state.parts.items.find(part => part.id === state.parts.selectedId)
);

const spawnMinoOverlapsRect = (state: State, rect: SelectionRect): boolean => {
    const piece = state.fumen.pages[state.fumen.currentIndex]?.piece;
    if (piece === undefined || !isMinoPiece(piece.type)) {
        return false;
    }
    return getBlockPositions(piece.type, piece.rotation, piece.coordinate.x, piece.coordinate.y)
        .some(position => isIndexInRect(toPositionIndex(position), rect));
};

// 範囲削除は、設定がONなら削除範囲に重なるSPAWNミノも消す。消しゴムドラッグの
// 「通過したSPAWNミノも消す」と同じ規則を、範囲削除にも適用する。
const deleteFloating = (floating: FloatingSelection) => (state: State): NextState => {
    if (state.mode.deleteSpawnMinoOnPaintDrag && spawnMinoOverlapsRect(state, floatingRect(floating))) {
        return sequence(state, [actions.clearPiece(), commitFloating(floating)]);
    }
    return commitFloating(floating)(state);
};

const floatingForOperation = (state: State): FloatingSelection | undefined => {
    if (state.rectSelect.status === 'floating' && state.rectSelect.floating !== null) {
        return state.rectSelect.floating;
    }
    if (state.rectSelect.status === 'selected' && state.rectSelect.rect !== null) {
        return floatingFromSelection(state, state.rectSelect.rect);
    }
    return undefined;
};

const transformFloatingSelection = (
    transform: (floating: FloatingSelection) => Pick<FloatingSelection, 'cells' | 'width' | 'height'>,
) => (state: State): NextState => {
    const floating = floatingForOperation(state);
    if (floating === undefined) {
        return undefined;
    }
    const transformed = transform(floating);
    return {
        rectSelect: {
            status: 'floating',
            rect: floating.sourceRect,
            anchorIndex: null,
            floating: { ...floating, ...transformed },
            reselectOnNextTouch: false,
        },
    };
};

export const rectSelectActions: Readonly<RectSelectActions> = {
    startRectSelection: ({ index }) => (state): NextState => {
        if (state.rectSelect.status === 'floating' && state.rectSelect.floating !== null) {
            const floating = { ...state.rectSelect.floating };
            const pointerX = index % FieldConstants.Width;
            const pointerY = Math.floor(index / FieldConstants.Width);
            const isOutsideFloatingRect = !isIndexInRect(index, floatingRect(floating));
            if (floating.firstTapPending !== true
                && floating.firstTapInProgress !== true
                && isOutsideFloatingRect) {
                return sequence(state, [
                    commitFloating(floating),
                    newState => actions.startRectSelection({ index })(newState),
                ]);
            }
            if (floating.firstTapPending) {
                if (isOutsideFloatingRect) {
                    // Tapping outside the preview settles the part where it is
                    // shown, then the same touch starts a normal selection.
                    return sequence(state, [
                        commitFloating(floating),
                        newState => actions.startRectSelection({ index })(newState),
                    ]);
                }
                // Keep the tapped cell attached to the same cell of the part
                // instead of snapping the part's bottom-left to the pointer.
                return {
                    rectSelect: {
                        ...state.rectSelect,
                        anchorIndex: index,
                        floating: {
                            ...floating,
                            pointerOffsetX: pointerX - floating.targetX,
                            pointerOffsetY: pointerY - floating.targetY,
                            firstTapPending: false,
                            firstTapInProgress: true,
                        },
                    },
                };
            }
            floating.pointerOffsetX = pointerX - floating.targetX;
            floating.pointerOffsetY = pointerY - floating.targetY;
            return {
                rectSelect: { ...state.rectSelect, anchorIndex: index, floating },
            };
        }
        if (state.rectSelect.reselectOnNextTouch) {
            return {
                rectSelect: {
                    status: 'selecting',
                    rect: rectFromIndices(index, index),
                    anchorIndex: index,
                    floating: null,
                    reselectOnNextTouch: false,
                },
            };
        }
        const part = selectedPart(state);
        if (part !== undefined) {
            const floating: FloatingSelection = floatingPartSpawn(
                part.cells, part.width, part.height, state.field,
            );
            const pointerX = index % FieldConstants.Width;
            const pointerY = Math.floor(index / FieldConstants.Width);
            floating.targetX = pointerX;
            floating.targetY = pointerY;
            floating.firstTapPending = false;
            floating.firstTapInProgress = true;
            return {
                rectSelect: {
                    ...state.rectSelect,
                    status: 'floating',
                    anchorIndex: index,
                    floating,
                },
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
                rectSelect: {
                    status: 'floating', rect, anchorIndex: index, floating,
                },
            };
        }
        return {
            rectSelect: {
                status: 'selecting',
                rect: rectFromIndices(index, index),
                anchorIndex: index,
                floating: null,
                reselectOnNextTouch: false,
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
            const target = floatingTargetForPointer(floating, index);
            floating.targetX = target.x;
            floating.targetY = target.y;
            return { rectSelect: { ...state.rectSelect, floating } };
        }
        return undefined;
    },
    endRectSelection: () => (state): NextState => {
        if (state.rectSelect.status === 'selecting') {
            return {
                rectSelect: {
                    ...state.rectSelect, status: 'selected', anchorIndex: null, reselectOnNextTouch: false,
                },
            };
        }
        if (state.rectSelect.status === 'floating' && state.rectSelect.floating !== null) {
            if (state.rectSelect.floating.firstTapInProgress) {
                return {
                    rectSelect: {
                        ...state.rectSelect,
                        anchorIndex: null,
                        floating: { ...state.rectSelect.floating, firstTapInProgress: false },
                    },
                };
            }
            // Keep the moved selection as a preview until the next outside
            // click explicitly confirms it. Committing here would write the
            // preview to the field as soon as the pointer is released.
            return {
                rectSelect: {
                    ...state.rectSelect,
                    anchorIndex: null,
                },
            };
        }
        return undefined;
    },
    commitRectSelection: () => (state): NextState => {
        if (state.rectSelect.status === 'floating' && state.rectSelect.floating !== null) {
            return commitFloating(state.rectSelect.floating)(state);
        }
        return undefined;
    },
    cancelRectSelectionPreview: () => (state): NextState => {
        if (state.rectSelect.status === 'selecting') {
            return { rectSelect: initialRectSelectState };
        }
        if (state.rectSelect.status === 'floating') {
            const floating = state.rectSelect.floating;
            const rect = floating?.sourceRect ?? state.rectSelect.rect;
            const next = {
                rectSelect: {
                    status: rect === null ? 'none' : 'selected' as RectSelectState['status'],
                    rect,
                    anchorIndex: null,
                    floating: null,
                    reselectOnNextTouch: false,
                },
            };
            // パーツから出したプレビュー（sourceRect === null）を取り消したときは、パーツの選択も外す。
            // 選択が残っていると、次の左クリックが再選択ではなくパーツの再配置になってしまう。
            if (floating !== null && floating.sourceRect === null && state.parts.selectedId !== null) {
                return { ...next, parts: { ...state.parts, selectedId: null } };
            }
            return next;
        }
        return undefined;
    },
    clearRectSelection: () => (state): NextState => {
        if (state.rectSelect.status === 'none') {
            return undefined;
        }
        return { rectSelect: initialRectSelectState };
    },
    deleteRectSelection: () => (state): NextState => {
        if (state.rectSelect.status === 'floating' && state.rectSelect.floating !== null) {
            if (state.rectSelect.floating.sourceRect === null) {
                return rectSelectActions.cancelRectSelectionPreview()(state);
            }
            const floating = { ...state.rectSelect.floating };
            floating.cells = floating.cells.map(() => Piece.Empty);
            floating.forceEmpty = true;
            return deleteFloating(floating)(state);
        }
        const rect = state.rectSelect.rect;
        if (state.rectSelect.status !== 'selected' || rect === null) {
            return undefined;
        }
        const floating = floatingFromSelection(state, rect);
        floating.cells = floating.cells.map(() => Piece.Empty);
        floating.forceEmpty = true;
        return deleteFloating(floating)(state);
    },
    // 消しゴム / 右クリックが選択にかかったときの削除。SPAWNミノと同じく、対象を
    // まるごと消したうえで選択状態そのものもリセットする（パーツの選択も外す）。
    deleteSelectionUnderEraser: () => (state): NextState => {
        if (state.rectSelect.status === 'none') {
            return undefined;
        }
        return sequence(state, [
            rectSelectActions.deleteRectSelection(),
            rectSelectActions.clearRectSelection(),
            newState => (newState.parts.selectedId !== null
                ? { parts: { ...newState.parts, selectedId: null } }
                : undefined),
        ]);
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
                reselectOnNextTouch: false,
            },
        };
    },
    beginWholeFieldMove: () => (state): NextState => {
        const rect: SelectionRect = {
            minX: 0,
            minY: 0,
            maxX: FieldConstants.Width - 1,
            maxY: FieldConstants.Height - 1,
        };
        return {
            rectSelect: {
                status: 'floating',
                rect,
                anchorIndex: null,
                floating: floatingFromSelection(state, rect),
                reselectOnNextTouch: false,
            },
        };
    },
    copyRectSelection: () => (state): NextState => {
        const floating = floatingForOperation(state);
        if (floating === undefined) {
            return undefined;
        }
        return savePartToSlot({
            id: generateKey(),
            slot: Piece.Empty,
            width: floating.width,
            height: floating.height,
            cells: floating.cells.slice(),
            pinned: false,
            createdAt: Date.now(),
        })(state);
    },
    cutRectSelection: () => (state): NextState => {
        const floating = floatingForOperation(state);
        if (floating === undefined) {
            return undefined;
        }
        const part: EditorPart = {
            id: generateKey(),
            slot: Piece.Empty,
            width: floating.width,
            height: floating.height,
            cells: floating.cells.slice(),
            pinned: false,
            createdAt: Date.now(),
        };
        if (floating.sourceRect === null) {
            return savePartToSlot(part)(state);
        }
        const cleared = { ...floating, cells: floating.cells.map(() => Piece.Empty), forceEmpty: true };
        return sequence(state, [savePartToSlot(part), commitFloating(cleared)]);
    },
    selectPart: ({ id }) => (state): NextState => {
        const part = state.parts.items.find(item => item.id === id);
        if (part === undefined) {
            return undefined;
        }
        if (state.parts.selectedId === id
            && state.rectSelect.status === 'floating'
            && state.rectSelect.floating?.sourceRect === null) {
            return undefined;
        }
        return {
            parts: { ...state.parts, selectedId: id },
            rectSelect: {
                status: 'floating', rect: null, anchorIndex: null,
                floating: floatingPartSpawn(part.cells, part.width, part.height, state.field),
                reselectOnNextTouch: false,
            },
        };
    },
    togglePartPin: ({ slot }) => (state): NextState => {
        let changed = false;
        const toggled = state.parts.items.map((part) => {
            if (part.slot !== slot) {
                return part;
            }
            changed = true;
            return { ...part, pinned: !part.pinned };
        });
        if (!changed) {
            return undefined;
        }
        const items = repackParts(toggled);
        const selected = toggled.find(part => part.slot === slot);
        const repackedSelected = selected === undefined
            ? undefined : items.find(part => part.id === selected.id);
        saveParts(items);
        return {
            parts: { ...state.parts, items },
            editorUi: repackedSelected === undefined ? undefined : {
                ...state.editorUi,
                paletteSelection: repackedSelected.slot,
            },
        };
    },
    // Field coordinates grow upward, so the array's clockwise transform is
    // the visual counter-clockwise rotation on the editor canvas.
    rotateSelectedPartLeft: () => transformFloatingSelection(floating => rotatePartCells(
        floating.cells, floating.width, floating.height,
    )),
    rotateSelectedPartRight: () => transformFloatingSelection(floating => rotatePartCellsLeft(
        floating.cells, floating.width, floating.height,
    )),
    mirrorSelectedPart: () => transformFloatingSelection(floating => ({
        cells: mirrorPartCells(floating.cells, floating.width, floating.height),
        width: floating.width,
        height: floating.height,
    })),
    toggleBlackTransparentPaste: () => (state): NextState => {
        const blackTransparent = !state.parts.blackTransparent;
        saveBlackTransparentPaste(state.parts.items, blackTransparent);
        return { parts: { ...state.parts, blackTransparent } };
    },
};

import { action, actions } from '../actions';
import { NextState, sequence } from './commons';
import { Piece, Rotation } from '../lib/enums';
import { defaultPastePosition, extractCells, Part, trimUnpinnedParts } from '../lib/parts';
import { PageFieldOperation, Pages } from '../lib/pages';
import { generateKey } from '../lib/random';
import { localStorageWrapper } from '../memento';
import { State } from '../states';
import { persistViewSettings } from './view_settings';
import { getBlocks } from '../lib/piece';

export interface PartsActions {
    copySelectionToParts(): action;
    cutSelectionToParts(): action;
    pastePart(data?: { partId?: string }): action;
    selectPart(data: { partId: string }): action;
    deselectPart(): action;
    togglePartPin(data: { partId: string }): action;
    removePart(data: { partId: string }): action;
    stampPartAt(data: { partId: string, x: number, y: number }): action;
    toggleBlackTransparentPaste(data?: { persist?: boolean }): action;
    loadParts(data: { items: Part[] }): action;
    placePieceAsPart(data: { piece: Piece }): action;
}

const save = (items: Part[]) => {
    if (typeof localStorage !== 'undefined') localStorageWrapper.saveParts(items);
};

const currentField = (state: State) => new Pages(state.fumen.pages)
    .getField(state.fumen.currentIndex, PageFieldOperation.Command);

const selectedPartData = (state: State): Omit<Part, 'id' | 'pinned' | 'createdAt'> | undefined => {
    const floating = state.rectSelect.floating;
    if (floating) return { width: floating.width, height: floating.height, cells: [...floating.cells] };
    const rect = state.rectSelect.rect;
    if (!rect) return undefined;
    return {
        width: rect.maxX - rect.minX + 1,
        height: rect.maxY - rect.minY + 1,
        cells: extractCells(currentField(state), rect),
    };
};

const addCurrentSelection = (state: State): { part: Part, items: Part[] } | undefined => {
    const data = selectedPartData(state);
    if (!data) return undefined;
    const part: Part = { ...data, id: generateKey(), pinned: false, createdAt: Date.now() };
    const items = trimUnpinnedParts([part, ...state.parts.items]);
    save(items);
    return { part, items };
};

const floatPart = (state: State, part: Part, x: number, y: number): NextState => ({
    parts: { ...state.parts, selectedId: part.id },
    rectSelect: {
        phase: 'floating', dragAnchor: null, moveAnchor: null,
        rect: { minX: x, minY: y, maxX: x + part.width - 1, maxY: y + part.height - 1 },
        floating: { x, y, cells: [...part.cells], width: part.width, height: part.height, sourceRect: null },
    },
});

export const partsActions: Readonly<PartsActions> = {
    copySelectionToParts: () => (state): NextState => {
        const added = addCurrentSelection(state);
        return added ? { parts: { items: added.items, selectedId: added.part.id } } : undefined;
    },
    cutSelectionToParts: () => (state): NextState => {
        if (!selectedPartData(state)) return undefined;
        return sequence(state, [partsActions.copySelectionToParts(), actions.deleteSelection()]);
    },
    pastePart: (data = {}) => (state): NextState => {
        if (state.rectSelect.phase === 'floating') {
            return sequence(state, [actions.commitRectSelect(), partsActions.pastePart(data)]);
        }
        const part = state.parts.items.find(item => item.id === data.partId)
            || state.parts.items.find(item => item.id === state.parts.selectedId)
            || state.parts.items[0];
        if (!part) return undefined;
        const place = defaultPastePosition(currentField(state), part.width, part.height);
        return floatPart(state, part, place.x, place.y);
    },
    selectPart: ({ partId }) => (state): NextState => ({
        parts: { ...state.parts, selectedId: state.parts.selectedId === partId ? null : partId },
    }),
    deselectPart: () => (state): NextState => ({ parts: { ...state.parts, selectedId: null } }),
    togglePartPin: ({ partId }) => (state): NextState => {
        const items = state.parts.items.map(item => item.id === partId ? { ...item, pinned: !item.pinned } : item);
        const trimmed = trimUnpinnedParts(items);
        save(trimmed);
        return { parts: { ...state.parts, items: trimmed } };
    },
    removePart: ({ partId }) => (state): NextState => {
        const items = state.parts.items.filter(item => item.id !== partId);
        save(items);
        return { parts: { items, selectedId: state.parts.selectedId === partId ? null : state.parts.selectedId } };
    },
    stampPartAt: ({ partId, x, y }) => (state): NextState => {
        const part = state.parts.items.find(item => item.id === partId);
        return part ? floatPart(state, part, x, y) : undefined;
    },
    toggleBlackTransparentPaste: ({ persist = true } = {}) => (state): NextState => {
        const value = !state.mode.blackTransparentPaste;
        if (persist) persistViewSettings(state, { blackTransparentPaste: value });
        return { mode: { ...state.mode, blackTransparentPaste: value } };
    },
    loadParts: ({ items }) => (state): NextState => ({ parts: { ...state.parts, items } }),
    placePieceAsPart: ({ piece }) => (state): NextState => {
        const blocks = getBlocks(piece, Rotation.Spawn);
        const xs = blocks.map(block => block[0]);
        const ys = blocks.map(block => block[1]);
        const minX = Math.min(...xs);
        const minY = Math.min(...ys);
        const width = Math.max(...xs) - minX + 1;
        const height = Math.max(...ys) - minY + 1;
        const cells = Array.from({ length: width * height }).map(() => Piece.Empty);
        blocks.forEach(([x, y]) => cells[(x - minX) + (y - minY) * width] = piece);
        const transient: Part = {
            width, height, cells, id: `mino-${piece}`, pinned: false, createdAt: Date.now(),
        };
        const position = defaultPastePosition(currentField(state), width, height);
        return floatPart(state, transient, position.x, position.y);
    },
};

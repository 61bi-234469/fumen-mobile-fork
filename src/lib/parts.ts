import { EditorPart } from '../states';
import { Piece } from './enums';

export const PARTS_STORAGE_KEY = 'parts@1';

export const PART_SLOTS: Piece[] = [
    Piece.I, Piece.L, Piece.O, Piece.Z, Piece.T, Piece.J, Piece.S, Piece.Empty, Piece.Gray,
];

const isPartSlot = (value: any): value is Piece => PART_SLOTS.includes(value);

const isPart = (value: any): value is EditorPart => (
    value !== null
    && typeof value === 'object'
    && typeof value.id === 'string'
    && (value.slot === undefined || isPartSlot(value.slot))
    && Number.isInteger(value.width)
    && Number.isInteger(value.height)
    && 0 < value.width
    && 0 < value.height
    && Array.isArray(value.cells)
    && value.cells.length === value.width * value.height
    && value.cells.every((piece: any) => Number.isInteger(piece) && Piece.Empty <= piece && piece <= Piece.Gray)
    && typeof value.pinned === 'boolean'
    && typeof value.createdAt === 'number'
);

export const limitParts = (items: EditorPart[]): EditorPart[] => {
    const bySlot = new Map<Piece, EditorPart>();
    items.forEach((item) => {
        if (!isPartSlot(item.slot)) {
            return;
        }
        const previous = bySlot.get(item.slot);
        if (previous === undefined
            || (item.pinned && !previous.pinned)
            || (!previous.pinned && item.createdAt > previous.createdAt)) {
            bySlot.set(item.slot, item);
        }
    });
    const limited = PART_SLOTS
        .map(slot => bySlot.get(slot))
        .filter((item): item is EditorPart => item !== undefined);
    return assignPartSlots(limited);
};

const orderedParts = (items: EditorPart[]): EditorPart[] => PART_SLOTS
    .map(slot => items.find(item => item.slot === slot))
    .filter((item): item is EditorPart => item !== undefined);

const assignOrderedPartSlots = (ordered: EditorPart[]): EditorPart[] => {
    const unpinned = ordered.filter(item => !item.pinned);
    const pinned = ordered.filter(item => item.pinned);
    const pinnedStart = PART_SLOTS.length - pinned.length;
    return unpinned.map((item, index) => ({ ...item, slot: PART_SLOTS[index] }))
        .concat(pinned.map((item, index) => ({ ...item, slot: PART_SLOTS[pinnedStart + index] })));
};

const assignPartSlots = (items: EditorPart[]): EditorPart[] => assignOrderedPartSlots(orderedParts(items));

export const repackParts = (items: EditorPart[]): EditorPart[] => assignPartSlots(items);

export const clearUnpinnedParts = (items: EditorPart[]): EditorPart[] => (
    repackParts(items.filter(item => item.pinned))
);

/** Adds a copied part to the FIFO portion of the palette. */
export const insertPart = (items: EditorPart[], part: EditorPart): EditorPart[] | undefined => {
    const ordered = repackParts(items);
    const unpinned = ordered.filter(item => !item.pinned);
    const pinned = ordered.filter(item => item.pinned);
    if (ordered.length >= PART_SLOTS.length && unpinned.length === 0) {
        return undefined;
    }
    const nextUnpinned = ordered.length >= PART_SLOTS.length ? unpinned.slice(1) : unpinned;
    return assignOrderedPartSlots(nextUnpinned.concat([{ ...part, pinned: false }], pinned));
};

const normalizeLoadedParts = (items: any[]): EditorPart[] => {
    let legacySlotIndex = 0;
    const normalized = items.reduce<EditorPart[]>((result, item) => {
        if (!isPart(item)) {
            return result;
        }
        const slot = item.slot ?? PART_SLOTS[legacySlotIndex];
        legacySlotIndex += 1;
        if (!isPartSlot(slot)) {
            return result;
        }
        result.push({ ...item, slot });
        return result;
    }, []);
    return limitParts(normalized);
};

export const loadParts = (): EditorPart[] => {
    try {
        if (typeof localStorage === 'undefined') {
            return [];
        }
        const stored = localStorage.getItem(PARTS_STORAGE_KEY);
        if (stored === null) {
            return [];
        }
        const parsed = JSON.parse(stored);
        const items = parsed?.version === 1 && Array.isArray(parsed.items) ? parsed.items : [];
        return normalizeLoadedParts(items);
    } catch {
        return [];
    }
};

export const loadBlackTransparentPaste = (): boolean => {
    try {
        if (typeof localStorage === 'undefined') {
            return true;
        }
        const stored = localStorage.getItem(PARTS_STORAGE_KEY);
        if (stored === null) {
            return true;
        }
        const parsed = JSON.parse(stored);
        return parsed?.version === 1 && typeof parsed.blackTransparent === 'boolean'
            ? parsed.blackTransparent : true;
    } catch {
        return true;
    }
};

export const saveParts = (items: EditorPart[]) => {
    try {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(PARTS_STORAGE_KEY, JSON.stringify({
                version: 1, items: limitParts(items), blackTransparent: loadBlackTransparentPaste(),
            }));
        }
    } catch {
        // Storage can be unavailable in private browsing; editing remains session-local.
    }
};

export const saveBlackTransparentPaste = (items: EditorPart[], blackTransparent: boolean) => {
    try {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(PARTS_STORAGE_KEY, JSON.stringify({
                blackTransparent, version: 1, items: limitParts(items),
            }));
        }
    } catch {
        // Storage can be unavailable in private browsing; editing remains session-local.
    }
};

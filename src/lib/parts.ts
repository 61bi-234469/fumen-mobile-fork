import { EditorPart } from '../states';
import { Piece } from './enums';

export const PARTS_STORAGE_KEY = 'parts@1';

const isPart = (value: any): value is EditorPart => (
    value !== null
    && typeof value === 'object'
    && typeof value.id === 'string'
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
    const pinned = items.filter(item => item.pinned);
    const recent = items
        .filter(item => !item.pinned)
        .sort((left, right) => right.createdAt - left.createdAt)
        .slice(0, 10);
    return pinned.concat(recent).sort((left, right) => right.createdAt - left.createdAt);
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
        return limitParts(items.filter(isPart));
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

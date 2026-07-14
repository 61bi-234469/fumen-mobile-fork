import { Piece } from '../enums';
import {
    limitParts,
    loadBlackTransparentPaste,
    loadParts,
    PARTS_STORAGE_KEY,
    saveBlackTransparentPaste,
    saveParts,
} from '../parts';
import { EditorPart } from '../../states';

const part = (id: string, createdAt: number, pinned = false): EditorPart => ({
    pinned,
    createdAt,
    id,
    width: 1,
    height: 1,
    cells: [Piece.T],
});

describe('parts persistence', () => {
    let stored: { [key: string]: string };

    beforeEach(() => {
        stored = {};
        (global as any).localStorage = {
            clear: () => { stored = {}; },
            getItem: (key: string) => stored[key] ?? null,
            setItem: (key: string, value: string) => { stored[key] = value; },
        };
    });

    it('keeps every pinned part and only the ten newest unpinned parts', () => {
        const items = [part('pinned', 0, true)].concat(
            Array.from({ length: 12 }).map((_, index) => part(`recent-${index}`, index + 1)),
        );

        const limited = limitParts(items);

        expect(limited).toHaveLength(11);
        expect(limited.some(item => item.id === 'pinned')).toBe(true);
        expect(limited.some(item => item.id === 'recent-0')).toBe(false);
        expect(limited.some(item => item.id === 'recent-1')).toBe(false);
    });

    it('round-trips parts and the empty-cell transparency option', () => {
        saveParts([part('saved', 1)]);
        saveBlackTransparentPaste(loadParts(), false);

        expect(loadParts()).toEqual([part('saved', 1)]);
        expect(loadBlackTransparentPaste()).toBe(false);
    });

    it('rejects malformed persisted data', () => {
        localStorage.setItem(PARTS_STORAGE_KEY, JSON.stringify({
            version: 1,
            items: [{ id: 'bad', width: 2, height: 2, cells: [Piece.T] }],
        }));

        expect(loadParts()).toEqual([]);
        expect(loadBlackTransparentPaste()).toBe(true);
    });
});

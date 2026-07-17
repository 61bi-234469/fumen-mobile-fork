import { Piece } from '../enums';
import {
    clearUnpinnedParts,
    limitParts,
    insertPart,
    loadBlackTransparentPaste,
    loadParts,
    PART_SLOTS,
    PARTS_STORAGE_KEY,
    repackParts,
    saveBlackTransparentPaste,
    saveParts,
} from '../parts';
import { EditorPart } from '../../states';

const part = (id: string, createdAt: number, pinned = false, slot = Piece.I): EditorPart => ({
    pinned,
    createdAt,
    id,
    slot,
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

    it('keeps one saved part per paint slot', () => {
        const items = [part('i', 0, true, Piece.I)].concat(
            Array.from({ length: 3 }).map((_, index) => part(`recent-${index}`, index + 1, false, Piece.L)),
        );

        const limited = limitParts(items);

        expect(limited).toHaveLength(2);
        expect(limited.some(item => item.id === 'i')).toBe(true);
        expect(limited.some(item => item.id === 'recent-2')).toBe(true);
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

    it('keeps pinned parts at the bottom when repacking slots', () => {
        const items = [
            part('pinned-top', 1, true, Piece.I),
            part('recent', 2, false, Piece.T),
        ];

        const repacked = repackParts(items);

        expect(repacked.map(item => [item.id, item.slot])).toEqual([
            ['recent', Piece.I],
            ['pinned-top', Piece.Gray],
        ]);
    });

    it('inserts copied parts into the FIFO slots and removes the top unpinned part when full', () => {
        const items = PART_SLOTS.map((slot, index) => part(
            `part-${index}`, index, index === PART_SLOTS.length - 1, slot,
        ));

        const inserted = insertPart(items, part('new', 99));

        expect(inserted).toBeDefined();
        expect(inserted!.map(item => item.id)).toEqual([
            'part-1', 'part-2', 'part-3', 'part-4', 'part-5', 'part-6', 'part-7', 'new', 'part-8',
        ]);
        expect(inserted!.slice(-1)[0].pinned).toBe(true);
        expect(inserted!.map(item => item.slot)).toEqual([
            ...PART_SLOTS.slice(0, PART_SLOTS.length - 1),
            PART_SLOTS[PART_SLOTS.length - 1],
        ]);
    });

    it('does not insert when every slot is pinned', () => {
        const items = PART_SLOTS.map((slot, index) => part(`part-${index}`, index, true, slot));

        expect(insertPart(items, part('new', 99))).toBeUndefined();
    });

    it('clears unpinned parts while preserving pinned parts', () => {
        const items = [
            part('pinned', 1, true, Piece.Gray),
            part('unpinned', 2, false, Piece.L),
        ];

        expect(clearUnpinnedParts(items)).toEqual([{ ...items[0], slot: Piece.Gray }]);
    });
});

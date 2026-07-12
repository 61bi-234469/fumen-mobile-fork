/** @jest-environment jsdom */

import { Piece } from '../lib/enums';
import { localStorageWrapper } from '../memento';

describe('parts persistence', () => {
    beforeEach(() => localStorage.clear());

    test('round-trips valid parts and rejects invalid items', () => {
        localStorageWrapper.saveParts([{
            id: 'part', width: 2, height: 1, cells: [Piece.I, Piece.Empty],
            pinned: true, createdAt: 1,
        }]);
        expect(localStorageWrapper.loadParts()).toHaveLength(1);

        localStorage.setItem('parts@1', JSON.stringify({ version: 1, items: [
            { id: 'bad', width: 2, height: 1, cells: [999], pinned: false, createdAt: 1 },
        ] }));
        expect(localStorageWrapper.loadParts()).toEqual([]);
    });
});

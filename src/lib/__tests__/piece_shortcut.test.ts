import { executePieceShortcut } from '../piece_shortcut';

describe('executePieceShortcut', () => {
    test('executes soft drop and hard drop independently', () => {
        const softdrop = jest.fn();
        const harddrop = jest.fn();

        executePieceShortcut('SoftDrop', { softdrop, harddrop });
        expect(softdrop).toHaveBeenCalledTimes(1);
        expect(harddrop).not.toHaveBeenCalled();

        executePieceShortcut('HardDrop', { softdrop, harddrop });
        expect(softdrop).toHaveBeenCalledTimes(1);
        expect(harddrop).toHaveBeenCalledTimes(1);
    });

    test('executes hold', () => {
        const hold = jest.fn();

        executePieceShortcut('Hold', { hold });

        expect(hold).toHaveBeenCalledTimes(1);
    });
});

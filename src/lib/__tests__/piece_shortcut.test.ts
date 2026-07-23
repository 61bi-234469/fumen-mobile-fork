import { endAllDasHolds, FRAME_DURATION_MS } from '../piece_das';
import {
    endPieceShortcut,
    executePieceShortcut,
    isPieceShortcutHoldActive,
    startPieceShortcut,
} from '../piece_shortcut';

const holdOptions = {
    dasFrames: 10,
    arrFrames: 2,
    sdf: 5,
};

describe('piece input lifecycle', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        endAllDasHolds();
        jest.useRealTimers();
    });

    test('uses one shared DAS lifecycle for a held movement', () => {
        const moveToLeft = jest.fn();
        const moveToLeftEnd = jest.fn();

        startPieceShortcut('tray:left', 'MoveLeft', holdOptions, () => ({
            moveToLeft,
            moveToLeftEnd,
        }));

        expect(moveToLeft).toHaveBeenCalledTimes(1);
        expect(isPieceShortcutHoldActive('tray:left')).toBe(true);

        jest.advanceTimersByTime(FRAME_DURATION_MS * holdOptions.dasFrames);
        expect(moveToLeft).toHaveBeenCalledTimes(2);

        endPieceShortcut('tray:left');
        expect(isPieceShortcutHoldActive('tray:left')).toBe(false);
        jest.advanceTimersByTime(1000);
        expect(moveToLeft).toHaveBeenCalledTimes(2);
    });

    test('keeps independent input IDs active at the same time', () => {
        const moveToLeft = jest.fn();
        const softdropStep = jest.fn();

        startPieceShortcut('tray:left', 'MoveLeft', holdOptions, () => ({ moveToLeft }));
        startPieceShortcut('tray:softdrop', 'SoftDrop', holdOptions, () => ({ softdropStep }));

        expect(moveToLeft).toHaveBeenCalledTimes(1);
        expect(softdropStep).toHaveBeenCalledTimes(1);

        endPieceShortcut('tray:left');
        jest.advanceTimersByTime(FRAME_DURATION_MS * 4);

        expect(moveToLeft).toHaveBeenCalledTimes(1);
        expect(softdropStep).toHaveBeenCalledTimes(2);
    });

    test('uses the configured soft-drop action for finite SDF', () => {
        const softdrop = jest.fn();
        const softdropStep = jest.fn();

        startPieceShortcut('keyboard:ArrowDown', 'SoftDrop', holdOptions, () => ({
            softdrop,
            softdropStep,
        }));

        expect(softdropStep).toHaveBeenCalledTimes(1);
        expect(softdrop).not.toHaveBeenCalled();

        jest.advanceTimersByTime(FRAME_DURATION_MS * 4);
        expect(softdropStep).toHaveBeenCalledTimes(2);

        endPieceShortcut('keyboard:ArrowDown');
        jest.advanceTimersByTime(1000);
        expect(softdropStep).toHaveBeenCalledTimes(2);
    });

    test('uses instant soft drop for SDF infinity and repeats after a new spawn', () => {
        const softdrop = jest.fn();
        const softdropStep = jest.fn();

        startPieceShortcut('keyboard:ArrowDown', 'SoftDrop', {
            ...holdOptions,
            sdf: Infinity,
        }, () => ({ softdrop, softdropStep }));

        expect(softdrop).toHaveBeenCalledTimes(1);
        expect(softdropStep).not.toHaveBeenCalled();

        jest.advanceTimersByTime(FRAME_DURATION_MS * 2);
        expect(softdrop).toHaveBeenCalledTimes(3);

        endPieceShortcut('keyboard:ArrowDown');
    });
});

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

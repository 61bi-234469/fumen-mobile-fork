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
    softDropPriority: false,
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

    test('re-evaluates MoveLeftEnd on every ARR=0 tick', () => {
        const firstMoveToLeftEnd = jest.fn();
        const secondMoveToLeftEnd = jest.fn();
        let currentActions = {
            moveToLeftEnd: firstMoveToLeftEnd,
        };

        startPieceShortcut('keyboard:left', 'MoveLeft', {
            ...holdOptions,
            arrFrames: 0,
        }, () => currentActions);

        jest.advanceTimersByTime(FRAME_DURATION_MS * holdOptions.dasFrames);
        expect(firstMoveToLeftEnd).toHaveBeenCalledTimes(1);

        currentActions = { moveToLeftEnd: secondMoveToLeftEnd };
        jest.advanceTimersByTime(FRAME_DURATION_MS);
        expect(firstMoveToLeftEnd).toHaveBeenCalledTimes(1);
        expect(secondMoveToLeftEnd).toHaveBeenCalledTimes(1);
    });

    test('defers the initial horizontal move when soft drop has priority', () => {
        const moveToLeft = jest.fn();
        startPieceShortcut('keyboard:left', 'MoveLeft', {
            ...holdOptions,
            softDropPriority: true,
        }, () => ({ moveToLeft }));

        expect(moveToLeft).not.toHaveBeenCalled();
        jest.advanceTimersByTime(FRAME_DURATION_MS);
        expect(moveToLeft).toHaveBeenCalledTimes(1);
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

    test('prefers the layout-aware reset action and keeps the legacy fallback', () => {
        const resetPieceOrField = jest.fn();
        const clearPiece = jest.fn();

        executePieceShortcut('Reset', { resetPieceOrField, clearPiece });
        expect(resetPieceOrField).toHaveBeenCalledTimes(1);
        expect(clearPiece).not.toHaveBeenCalled();

        executePieceShortcut('Reset', { clearPiece });
        expect(clearPiece).toHaveBeenCalledTimes(1);
    });
});

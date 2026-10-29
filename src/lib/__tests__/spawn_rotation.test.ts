import { endAllDasHolds } from '../piece_das';
import { endPieceShortcut, startPieceShortcut } from '../piece_shortcut';
import {
    heldSpawnRotation, isValidSpawnRotationMode, pressRotation, releaseAllRotations,
} from '../spawn_rotation';

const holdOptions = { dasFrames: 10, arrFrames: 1, sdf: 5, softDropPriority: false };
const noActions = () => ({});

describe('spawn rotation mode', () => {
    test('accepts only off and hold', () => {
        expect(isValidSpawnRotationMode('off')).toBe(true);
        expect(isValidSpawnRotationMode('hold')).toBe(true);
        expect(isValidSpawnRotationMode('tap')).toBe(false);
        expect(isValidSpawnRotationMode(undefined)).toBe(false);
    });
});

describe('held rotate inputs', () => {
    afterEach(() => {
        releaseAllRotations();
        endAllDasHolds();
    });

    test('reports no rotation when nothing is held', () => {
        expect(heldSpawnRotation()).toBeNull();
    });

    test('uses the most recently pressed rotate input', () => {
        pressRotation('a', 'cw');
        pressRotation('b', 'ccw');
        expect(heldSpawnRotation()).toBe('ccw');
    });

    test('falls back to the earlier input when the latest one is released', () => {
        startPieceShortcut('keyboard:KeyX', 'RotateRight', holdOptions, noActions);
        startPieceShortcut('tray:rotate-180', 'Rotate180', holdOptions, noActions);
        expect(heldSpawnRotation()).toBe('180');

        endPieceShortcut('tray:rotate-180');
        expect(heldSpawnRotation()).toBe('cw');

        endPieceShortcut('keyboard:KeyX');
        expect(heldSpawnRotation()).toBeNull();
    });

    test('maps each rotate shortcut to its direction', () => {
        startPieceShortcut('k', 'RotateLeft', holdOptions, noActions);
        expect(heldSpawnRotation()).toBe('ccw');
        startPieceShortcut('k', 'RotateRight', holdOptions, noActions);
        expect(heldSpawnRotation()).toBe('cw');
    });

    test('does not track non-rotate shortcuts', () => {
        startPieceShortcut('k', 'HardDrop', holdOptions, noActions);
        startPieceShortcut('l', 'MoveLeft', holdOptions, noActions);
        expect(heldSpawnRotation()).toBeNull();
    });

    test('reusing an input id for another shortcut drops the old rotation', () => {
        startPieceShortcut('k', 'RotateRight', holdOptions, noActions);
        startPieceShortcut('k', 'HardDrop', holdOptions, noActions);
        expect(heldSpawnRotation()).toBeNull();
    });
});

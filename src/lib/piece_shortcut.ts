import type { PieceShortcuts } from '../states';
import {
    endPieceHold,
    isPieceHoldActive,
    setPieceShortcutSoftDropPriority,
    startDasHold,
    startSoftDropHold,
} from './piece_das';
import { pressRotation, releaseRotation, SpawnRotationDirection } from './spawn_rotation';

export type PieceShortcutKey = keyof PieceShortcuts;

export type PieceShortcutActions = {
    moveToLeft?: () => void;
    moveToLeftEnd?: () => void;
    moveToRight?: () => void;
    moveToRightEnd?: () => void;
    softdropStep?: () => void;
    softdrop?: () => void;
    harddrop?: () => void;
    hold?: () => void;
    swapCurrentPieceWithHoldQueue?: () => void;
    rotateToLeft?: () => void;
    rotateToRight?: () => void;
    rotateTo180?: () => void;
    clearPiece?: () => void;
    resetPieceOrField?: () => void;
};

export interface PieceShortcutHoldOptions {
    dasFrames: number;
    arrFrames: number;
    sdf: number;
    softDropPriority: boolean;
}

export const executePieceShortcut = (
    key: PieceShortcutKey,
    actions: PieceShortcutActions,
) => {
    switch (key) {
    case 'MoveLeft':
        actions.moveToLeft?.();
        break;
    case 'MoveRight':
        actions.moveToRight?.();
        break;
    case 'SoftDrop':
        actions.softdrop?.();
        break;
    case 'HardDrop':
        actions.harddrop?.();
        break;
    case 'Hold':
        (actions.hold ?? actions.swapCurrentPieceWithHoldQueue)?.();
        break;
    case 'RotateLeft':
        actions.rotateToLeft?.();
        break;
    case 'RotateRight':
        actions.rotateToRight?.();
        break;
    case 'Rotate180':
        actions.rotateTo180?.();
        break;
    case 'Reset':
        (actions.resetPieceOrField ?? actions.clearPiece)?.();
        break;
    }
};

const ROTATE_KEY_DIRECTIONS: { [key in PieceShortcutKey]?: SpawnRotationDirection } = {
    RotateRight: 'cw',
    RotateLeft: 'ccw',
    Rotate180: '180',
};

/**
 * Start one logical PIECE input using the same lifecycle for keyboard and touch.
 * The action getter is evaluated on every timer tick so a hold always operates
 * on the current Hyperapp action set after page transitions.
 */
export const startPieceShortcut = (
    id: string,
    key: PieceShortcutKey,
    options: PieceShortcutHoldOptions,
    getActions: () => PieceShortcutActions,
) => {
    // A reused input ID must not leave a previous kind of hold running.
    endPieceHold(id);
    releaseRotation(id);
    setPieceShortcutSoftDropPriority(options.softDropPriority);

    if (key === 'MoveLeft') {
        startDasHold(id, {
            move: () => getActions().moveToLeft?.(),
            moveToEnd: () => getActions().moveToLeftEnd?.(),
            dasFrames: options.dasFrames,
            arrFrames: options.arrFrames,
            softDropPriority: options.softDropPriority,
        });
        return;
    }

    if (key === 'MoveRight') {
        startDasHold(id, {
            move: () => getActions().moveToRight?.(),
            moveToEnd: () => getActions().moveToRightEnd?.(),
            dasFrames: options.dasFrames,
            arrFrames: options.arrFrames,
            softDropPriority: options.softDropPriority,
        });
        return;
    }

    if (key === 'SoftDrop') {
        startSoftDropHold(id, () => {
            const actions = getActions();
            if (options.sdf === Infinity) {
                actions.softdrop?.();
            } else {
                actions.softdropStep?.();
            }
        }, options.sdf);
        return;
    }

    const rotationDirection = ROTATE_KEY_DIRECTIONS[key];
    if (rotationDirection !== undefined) {
        // Remember the rotate input until it is released so a piece that spawns meanwhile can be pre-rotated.
        pressRotation(id, rotationDirection);
    }
    executePieceShortcut(key, getActions());
};

/** Stop all continuous work belonging to one logical PIECE input. */
export const endPieceShortcut = (id: string) => {
    endPieceHold(id);
    releaseRotation(id);
};

/** Return whether a logical PIECE input currently owns a continuous hold. */
export const isPieceShortcutHoldActive = (id: string): boolean => {
    return isPieceHoldActive(id);
};

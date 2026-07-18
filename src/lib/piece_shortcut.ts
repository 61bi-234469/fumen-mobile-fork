import type { PieceShortcuts } from '../states';

export type PieceShortcutKey = keyof PieceShortcuts;

type PieceShortcutActions = {
    moveToLeft?: () => void;
    moveToRight?: () => void;
    softdrop?: () => void;
    harddrop?: () => void;
    hold?: () => void;
    swapCurrentPieceWithHoldQueue?: () => void;
    rotateToLeft?: () => void;
    rotateToRight?: () => void;
    rotateTo180?: () => void;
    clearPiece?: () => void;
};

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
        actions.clearPiece?.();
        break;
    }
};

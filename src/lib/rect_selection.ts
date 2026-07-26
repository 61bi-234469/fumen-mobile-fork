import { FieldConstants, Piece } from './enums';
import { Block } from '../state_types';
import { FloatingSelection, RectSelectState, SelectionRect, State } from '../states';

// 「選択なし」を表す共通の初期値。states.ts の initState と、選択解除する各アクションで共有する。
// states.ts 自体は import 時に環境依存の副作用（env.ts 等）を伴うため、値としての単一の
// 定義元はここ（副作用のない lib モジュール）に置く。
export const initialRectSelectState: RectSelectState = {
    status: 'none', rect: null, anchorIndex: null, floating: null,
};

export const rectFromIndices = (first: number, second: number): SelectionRect => {
    const firstX = first % FieldConstants.Width;
    const firstY = Math.floor(first / FieldConstants.Width);
    const secondX = second % FieldConstants.Width;
    const secondY = Math.floor(second / FieldConstants.Width);
    return {
        minX: Math.min(firstX, secondX),
        minY: Math.min(firstY, secondY),
        maxX: Math.max(firstX, secondX),
        maxY: Math.max(firstY, secondY),
    };
};

export const rectWidth = (rect: SelectionRect): number => rect.maxX - rect.minX + 1;
export const rectHeight = (rect: SelectionRect): number => rect.maxY - rect.minY + 1;

export const isIndexInRect = (index: number, rect: SelectionRect): boolean => {
    const x = index % FieldConstants.Width;
    const y = Math.floor(index / FieldConstants.Width);
    return rect.minX <= x && x <= rect.maxX && rect.minY <= y && y <= rect.maxY;
};

export const extractRectPieces = (field: Block[], rect: SelectionRect): Piece[] => {
    const cells: Piece[] = [];
    for (let y = rect.minY; y <= rect.maxY; y += 1) {
        for (let x = rect.minX; x <= rect.maxX; x += 1) {
            const piece = field[x + y * FieldConstants.Width]?.piece ?? Piece.Empty;
            cells.push(piece === 'inference' ? Piece.Gray : piece);
        }
    }
    return cells;
};

export const floatingTargetForPointer = (
    floating: FloatingSelection,
    pointerIndex: number,
): { x: number; y: number } => {
    const pointerX = pointerIndex % FieldConstants.Width;
    const pointerY = Math.floor(pointerIndex / FieldConstants.Width);
    return {
        // Keep the cursor attached to the pointer even when the selection
        // extends beyond the field. Rendering and committing clip the
        // overflow separately.
        x: pointerX - floating.pointerOffsetX,
        y: pointerY - floating.pointerOffsetY,
    };
};

// Distance between the landing surface and the spawned part. The preview stays
// within thumb reach on low terrain without looking glued to the stack.
export const PART_SPAWN_GAP = 3;

export const columnTopFilledRow = (field: Block[], x: number): number => {
    for (let y = FieldConstants.Height - 1; 0 <= y; y -= 1) {
        const block = field[x + y * FieldConstants.Width];
        if (block !== undefined && block.piece !== Piece.Empty) {
            return y;
        }
    }
    return -1;
};

/** The row the part would rest on, judged by its bounding box. */
export const partLandingY = (field: Block[], targetX: number, width: number): number => {
    let landing = 0;
    for (let x = targetX; x < targetX + width; x += 1) {
        if (x < 0 || FieldConstants.Width <= x) {
            continue;
        }
        landing = Math.max(landing, columnTopFilledRow(field, x) + 1);
    }
    return landing;
};

export const partSpawnTargetY = (
    field: Block[], targetX: number, width: number, height: number,
): number => Math.max(0, Math.min(
    partLandingY(field, targetX, width) + PART_SPAWN_GAP,
    FieldConstants.Height - height,
));

export const floatingPartSpawn = (
    cells: Piece[], width: number, height: number, field: Block[],
): FloatingSelection => {
    const targetX = Math.floor((FieldConstants.Width - width) / 2);
    return {
        cells,
        width,
        height,
        targetX,
        sourceRect: null,
        targetY: partSpawnTargetY(field, targetX, width, height),
        pointerOffsetX: 0,
        pointerOffsetY: 0,
        firstTapPending: true,
    };
};

export const floatingRect = (floating: FloatingSelection): SelectionRect => ({
    minX: floating.targetX,
    minY: floating.targetY,
    maxX: floating.targetX + floating.width - 1,
    maxY: floating.targetY + floating.height - 1,
});

export const mirrorPartCells = (cells: Piece[], width: number, height: number): Piece[] => {
    const mirrorPiece = (piece: Piece): Piece => {
        switch (piece) {
        case Piece.J:
            return Piece.L;
        case Piece.L:
            return Piece.J;
        case Piece.S:
            return Piece.Z;
        case Piece.Z:
            return Piece.S;
        default:
            return piece;
        }
    };
    const mirrored: Piece[] = [];
    for (let y = 0; y < height; y += 1) {
        for (let x = width - 1; 0 <= x; x -= 1) {
            mirrored.push(mirrorPiece(cells[x + y * width]));
        }
    }
    return mirrored;
};

export const rotatePartCells = (
    cells: Piece[], width: number, height: number,
): { cells: Piece[]; width: number; height: number } => {
    const rotated = Array.from({ length: cells.length }).map(() => Piece.Empty);
    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            const nextX = height - 1 - y;
            const nextY = x;
            rotated[nextX + nextY * height] = cells[x + y * width];
        }
    }
    return { cells: rotated, width: height, height: width };
};

export const rotatePartCellsLeft = (
    cells: Piece[], width: number, height: number,
): { cells: Piece[]; width: number; height: number } => {
    const rotated = Array.from({ length: cells.length }).map(() => Piece.Empty);
    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            const nextX = y;
            const nextY = width - 1 - x;
            rotated[nextX + nextY * height] = cells[x + y * width];
        }
    }
    return { cells: rotated, width: height, height: width };
};

export const composeSelectionField = (state: State): Block[] => {
    const field = state.field.map(block => ({ ...block }));
    const originalField = state.field.map(block => ({ ...block }));
    const floating = state.rectSelect.floating;
    if (state.rectSelect.status !== 'floating' || floating === null) {
        return field;
    }
    if (floating.sourceRect !== null) {
        for (let y = floating.sourceRect.minY; y <= floating.sourceRect.maxY; y += 1) {
            for (let x = floating.sourceRect.minX; x <= floating.sourceRect.maxX; x += 1) {
                if (0 <= x && x < FieldConstants.Width && 0 <= y && y < FieldConstants.Height) {
                    field[x + y * FieldConstants.Width] = { piece: Piece.Empty };
                }
            }
        }
    }
    for (let y = 0; y < floating.height; y += 1) {
        for (let x = 0; x < floating.width; x += 1) {
            const targetX = floating.targetX + x;
            const targetY = floating.targetY + y;
            if (targetX < 0 || FieldConstants.Width <= targetX
                || targetY < 0 || FieldConstants.Height <= targetY) {
                continue;
            }
            const index = targetX + targetY * FieldConstants.Width;
            const piece = floating.cells[x + y * floating.width];
            if (state.parts.blackTransparent && floating.forceEmpty !== true && piece === Piece.Empty) {
                if (floating.sourceRect !== null && isIndexInRect(index, floating.sourceRect)) {
                    field[index] = originalField[index];
                }
                continue;
            }
            field[index] = { piece };
        }
    }
    return field;
};

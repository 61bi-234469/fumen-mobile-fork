import { FieldConstants, Piece } from './enums';
import { HighlightType, Block } from '../state_types';
import { FloatingSelection, SelectionRect, State } from '../states';

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

export const clampFloatingTarget = (floating: FloatingSelection, pointerIndex: number): { x: number; y: number } => {
    const pointerX = pointerIndex % FieldConstants.Width;
    const pointerY = Math.floor(pointerIndex / FieldConstants.Width);
    return {
        x: Math.max(0, Math.min(FieldConstants.Width - floating.width, pointerX - floating.pointerOffsetX)),
        y: Math.max(0, Math.min(FieldConstants.Height - floating.height, pointerY - floating.pointerOffsetY)),
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

export const composeSelectionField = (state: State): Block[] => {
    const field = state.field.map(block => ({ ...block }));
    const floating = state.rectSelect.floating;
    if (state.rectSelect.status !== 'floating' || floating === null) {
        return field;
    }
    if (floating.sourceRect !== null) {
        for (let y = floating.sourceRect.minY; y <= floating.sourceRect.maxY; y += 1) {
            for (let x = floating.sourceRect.minX; x <= floating.sourceRect.maxX; x += 1) {
                field[x + y * FieldConstants.Width] = { piece: Piece.Empty };
            }
        }
    }
    for (let y = 0; y < floating.height; y += 1) {
        for (let x = 0; x < floating.width; x += 1) {
            const piece = floating.cells[x + y * floating.width];
            if (floating.kind === 'stamp' && state.parts.blackTransparent && piece === Piece.Empty) {
                continue;
            }
            const index = floating.targetX + x + (floating.targetY + y) * FieldConstants.Width;
            field[index] = {
                piece,
                highlight: piece === Piece.Empty ? undefined : HighlightType.Lighter,
            };
        }
    }
    return field;
};

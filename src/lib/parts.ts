import { Piece } from './enums';
import { Field } from './fumen/field';
import { Block, HighlightType } from '../state_types';

export interface Rect {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
}

export interface Part {
    id: string;
    width: number;
    height: number;
    cells: Piece[];
    pinned: boolean;
    createdAt: number;
}

export interface FloatingPart {
    cells: Piece[];
    width: number;
    height: number;
    x: number;
    y: number;
    sourceRect: Rect | null;
}

export interface RectSelectState {
    phase: 'none' | 'selecting' | 'selected' | 'floating';
    dragAnchor: { x: number, y: number } | null;
    rect: Rect | null;
    floating: FloatingPart | null;
    moveAnchor: { dx: number, dy: number } | null;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const toPoint = (value: number | { x: number, y: number }) => typeof value === 'number'
    ? { x: value % 10, y: Math.floor(value / 10) }
    : value;

export const normalizeRect = (
    a: number | { x: number, y: number },
    b: number | { x: number, y: number },
): Rect => {
    const left = toPoint(a);
    const right = toPoint(b);
    const ax = clamp(left.x, 0, 9);
    const ay = clamp(left.y, 0, 22);
    const bx = clamp(right.x, 0, 9);
    const by = clamp(right.y, 0, 22);
    return {
        minX: Math.min(ax, bx),
        minY: Math.min(ay, by),
        maxX: Math.max(ax, bx),
        maxY: Math.max(ay, by),
    };
};

export const containsPoint = (rect: Rect, x: number, y: number) =>
    rect.minX <= x && x <= rect.maxX && rect.minY <= y && y <= rect.maxY;

export const extractCells = (field: Field, rect: Rect): Piece[] => {
    const cells: Piece[] = [];
    for (let y = rect.minY; y <= rect.maxY; y += 1) {
        for (let x = rect.minX; x <= rect.maxX; x += 1) {
            cells.push(field.get(x, y));
        }
    }
    return cells;
};

export const mirrorPiece = (piece: Piece): Piece => {
    switch (piece) {
    case Piece.J: return Piece.L;
    case Piece.L: return Piece.J;
    case Piece.S: return Piece.Z;
    case Piece.Z: return Piece.S;
    default: return piece;
    }
};

export const mirrorCells = (cells: Piece[], width: number, height: number): Piece[] => {
    const mirrored: Piece[] = [];
    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            mirrored.push(mirrorPiece(cells[(width - x - 1) + y * width]));
        }
    }
    return mirrored;
};

export const buildGoalField = (baseField: Field, edit: {
    clearRect?: Rect | null;
    place?: {
        cells: Piece[];
        width: number;
        height: number;
        x: number;
        y: number;
        blackTransparent: boolean;
    } | null;
}): Field => {
    const result = baseField.copy();
    if (edit.clearRect) {
        for (let y = edit.clearRect.minY; y <= edit.clearRect.maxY; y += 1) {
            for (let x = edit.clearRect.minX; x <= edit.clearRect.maxX; x += 1) {
                result.setToPlayField(x + y * 10, Piece.Empty);
            }
        }
    }
    if (edit.place) {
        const place = edit.place;
        for (let dy = 0; dy < place.height; dy += 1) {
            for (let dx = 0; dx < place.width; dx += 1) {
                const x = place.x + dx;
                const y = place.y + dy;
                const piece = place.cells[dx + dy * place.width];
                if (x < 0 || 10 <= x || y < 0 || 23 <= y || (place.blackTransparent && piece === Piece.Empty)) {
                    continue;
                }
                result.setToPlayField(x + y * 10, piece);
            }
        }
    }
    return result;
};

export const defaultPastePosition = (field: Field, width: number, height: number) => {
    let highest = -1;
    for (let y = 22; 0 <= y; y -= 1) {
        if (Array.from({ length: 10 }).some((_, x) => field.get(x, y) !== Piece.Empty)) {
            highest = y;
            break;
        }
    }
    return {
        x: Math.floor((10 - width) / 2),
        y: clamp(highest + 2, 0, Math.max(0, 23 - height)),
    };
};

export const composeDisplayField = (
    field: Block[],
    rectSelect: RectSelectState,
    blackTransparent: boolean,
): Block[] => {
    const result = field.map(block => ({ ...block }));
    const floating = rectSelect.floating;
    if (floating) {
        if (floating.sourceRect) {
            for (let y = floating.sourceRect.minY; y <= floating.sourceRect.maxY; y += 1) {
                for (let x = floating.sourceRect.minX; x <= floating.sourceRect.maxX; x += 1) {
                    result[x + y * 10] = { piece: Piece.Empty };
                }
            }
        }
        for (let dy = 0; dy < floating.height; dy += 1) {
            for (let dx = 0; dx < floating.width; dx += 1) {
                const x = floating.x + dx;
                const y = floating.y + dy;
                const piece = floating.cells[dx + dy * floating.width];
                if (x < 0 || 10 <= x || y < 0 || 23 <= y || (blackTransparent && piece === Piece.Empty)) continue;
                result[x + y * 10] = { piece };
            }
        }
    }
    const rect = floating ? {
        minX: floating.x,
        minY: floating.y,
        maxX: floating.x + floating.width - 1,
        maxY: floating.y + floating.height - 1,
    } : rectSelect.rect;
    if (rect) {
        for (let y = Math.max(0, rect.minY); y <= Math.min(22, rect.maxY); y += 1) {
            for (let x = Math.max(0, rect.minX); x <= Math.min(9, rect.maxX); x += 1) {
                result[x + y * 10] = { ...result[x + y * 10], highlight: HighlightType.Lighter };
            }
        }
    }
    return result;
};

export const trimUnpinnedParts = (items: Part[], maximum = 10): Part[] => {
    let unpinned = 0;
    return items.filter((item) => {
        if (item.pinned) return true;
        unpinned += 1;
        return unpinned <= maximum;
    });
};

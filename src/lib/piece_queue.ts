import { Piece } from './enums';

export const PIECE_QUEUE_ORDER: Piece[] = [Piece.I, Piece.O, Piece.T, Piece.L, Piece.J, Piece.S, Piece.Z];

export const PIECE_QUEUE_TO_CHAR: Record<number, string> = {
    [Piece.I]: 'I',
    [Piece.O]: 'O',
    [Piece.T]: 'T',
    [Piece.L]: 'L',
    [Piece.J]: 'J',
    [Piece.S]: 'S',
    [Piece.Z]: 'Z',
};

const CHAR_TO_PIECE: Record<string, Piece> = {
    I: Piece.I,
    O: Piece.O,
    T: Piece.T,
    L: Piece.L,
    J: Piece.J,
    S: Piece.S,
    Z: Piece.Z,
};

export const pieceQueueToText = (queue: Piece[]): string => {
    return queue.map(piece => PIECE_QUEUE_TO_CHAR[piece]).join('');
};

export const pieceQueuePieceToChar = (piece: Piece): string => PIECE_QUEUE_TO_CHAR[piece] ?? '';

export const parsePieceQueueText = (text: string): Piece[] | null => {
    const trimmed = text.trim();
    if (trimmed.length === 0) {
        return [];
    }

    const parsed: Piece[] = [];
    for (const char of trimmed.toUpperCase()) {
        const piece = CHAR_TO_PIECE[char];
        if (piece === undefined) {
            return null;
        }
        parsed.push(piece);
    }
    return parsed;
};

export const parsePieceHoldText = (text: string): Piece | null | undefined => {
    const trimmed = text.trim();
    if (trimmed.length === 0) {
        return null;
    }
    if (trimmed.length !== 1) {
        return undefined;
    }
    return CHAR_TO_PIECE[trimmed.toUpperCase()];
};

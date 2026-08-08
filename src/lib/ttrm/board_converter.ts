import { FieldConstants, Piece } from '../enums';
import { Field, PlayField } from '../fumen/field';
import { IRField } from './types';

// Engine board cell: { mino, connections } | null, board.state[0] is the
// bottom row — the same orientation as the app Field, so no flipping here.
// Only the raw .ttrm JSON boards (verification-only) are top-down.
interface EngineTileLike {
    mino: string;
}

export type EngineBoardState = (EngineTileLike | null)[][];

export const minoToPiece = (mino: string): Piece => {
    switch (mino) {
    case 'i':
        return Piece.I;
    case 'j':
        return Piece.J;
    case 'l':
        return Piece.L;
    case 'o':
        return Piece.O;
    case 's':
        return Piece.S;
    case 't':
        return Piece.T;
    case 'z':
        return Piece.Z;
    default:
        // 'gb' (garbage) and anything unknown ('bomb', ...) become gray.
        return Piece.Gray;
    }
};

export interface ConvertedBoard {
    field: IRField;
    sourceHeight: number;
    clippedRowCount: number;
}

// FR-56: the engine plays on 40 rows but fumen holds 23; always keep the
// bottom 23 rows and report how many occupied rows were clipped from the top.
export const convertEngineBoard = (state: EngineBoardState): ConvertedBoard => {
    let sourceHeight = 0;
    for (let y = state.length - 1; 0 <= y; y -= 1) {
        const row = state[y];
        if (row && row.some(cell => cell !== null && cell !== undefined)) {
            sourceHeight = y + 1;
            break;
        }
    }

    const field: IRField = [];
    for (let y = 0; y < FieldConstants.Height; y += 1) {
        const row = state[y];
        for (let x = 0; x < FieldConstants.Width; x += 1) {
            const cell = row ? row[x] : null;
            field.push(cell !== null && cell !== undefined ? minoToPiece(cell.mino) : Piece.Empty);
        }
    }

    return {
        field,
        sourceHeight,
        clippedRowCount: Math.max(0, sourceHeight - FieldConstants.Height),
    };
};

// sentLine は 10 セル（FieldConstants.Width）。FR-54 でゲージ 1 行を載せるときだけ渡す。
export const irFieldToField = (cells: IRField, sentLine?: IRField): Field => {
    const field = new Field({ field: new PlayField({ pieces: cells.concat() }) });
    if (sentLine !== undefined) {
        for (let x = 0; x < FieldConstants.Width; x += 1) {
            field.setToSentLine(x, sentLine[x] ?? Piece.Empty);
        }
    }
    return field;
};

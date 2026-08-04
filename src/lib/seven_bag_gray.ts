import { FieldConstants, Piece } from './enums';
import { SevenBagGrayDisplay } from './comment_metadata';
import { Field } from './fumen/field';
import { Move } from './fumen/types';
import { getBlockPositions } from './piece';

const initialRowMap = (): number[] => Array.from({ length: FieldConstants.Height }, (_, y) => y);

const fieldFromPieces = (pieces: number[]): Field => {
    const field = new Field({});
    pieces.slice(0, FieldConstants.PlayBlocks).forEach((piece, index) => {
        field.setToPlayField(index, piece);
    });
    return field;
};

export const advanceSevenBagGrayDisplay = (
    previous: SevenBagGrayDisplay | undefined,
    actualFieldBeforePlacement: Field,
    move: Move,
): { display: SevenBagGrayDisplay; field: Field } => {
    const displayField = previous === undefined
        ? actualFieldBeforePlacement.copy()
        : fieldFromPieces(previous.pieces);
    if (previous === undefined) {
        // The page being built shows only this bag in color. Everything that existed
        // before its first placement belongs to an older bag.
        displayField.convertToGray();
    }

    const rowMap = previous?.rowMap.slice() ?? initialRowMap();
    for (const [x, actualY] of getBlockPositions(
        move.type, move.rotation, move.coordinate.x, move.coordinate.y,
    )) {
        const displayY = rowMap[actualY];
        if (displayY !== undefined && displayY < FieldConstants.Height) {
            displayField.setToPlayField(x + displayY * FieldConstants.Width, move.type);
        }
    }

    const beforeClear = actualFieldBeforePlacement.copy();
    beforeClear.put(move);
    const clearedRows: number[] = [];
    for (let y = 0; y < FieldConstants.Height; y += 1) {
        const filled = Array.from({ length: FieldConstants.Width })
            .every((_, x) => beforeClear.get(x, y) !== Piece.Empty);
        if (filled) clearedRows.push(y);
    }
    // Remove from top to bottom so indices still refer to the pre-clear actual field.
    clearedRows.sort((a, b) => b - a).forEach((actualY) => {
        rowMap.splice(actualY, 1);
    });
    while (rowMap.length < FieldConstants.Height) {
        rowMap.push((rowMap[rowMap.length - 1] ?? -1) + 1);
    }

    return {
        field: displayField,
        display: {
            rowMap,
            pieces: displayField.toPlayFieldPieces(),
        },
    };
};

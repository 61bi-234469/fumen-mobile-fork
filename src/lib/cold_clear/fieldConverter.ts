import { FieldConstants, Piece } from '../enums';

const CELL_LETTERS: Partial<Record<Piece, string>> = {
    [Piece.I]: 'I',
    [Piece.J]: 'J',
    [Piece.L]: 'L',
    [Piece.O]: 'O',
    [Piece.S]: 'S',
    [Piece.T]: 'T',
    [Piece.Z]: 'Z',
    [Piece.Gray]: 'G',
};
import { Field } from '../fumen/field';

export function fieldToCC(field: Field): Uint8Array {
    const result = new Uint8Array(400); // 40 rows x 10 cols, all zeros
    // Map app field (23 rows, y=0..22) to CC field (y=0..22)
    // y=23..39 remain 0 (empty)
    // sent line (y=-1) is excluded
    for (let y = 0; y < FieldConstants.Height; y += 1) {
        for (let x = 0; x < FieldConstants.Width; x += 1) {
            const piece = field.get(x, y);
            if (piece !== Piece.Empty) {
                result[y * FieldConstants.Width + x] = 1;
            }
        }
    }
    return result;
}

// Sold Slear 用の色付き盤面（40 行 x 10 列、y = 0 が最下段）。空きは '_'。
// せり上がり行（y = -1）は含めない。
export function fieldToCells(field: Field): string {
    const cells: string[] = [];
    for (let y = 0; y < 40; y += 1) {
        for (let x = 0; x < FieldConstants.Width; x += 1) {
            const piece = y < FieldConstants.Height ? field.get(x, y) : Piece.Empty;
            cells.push(piece === Piece.Empty ? '_' : CELL_LETTERS[piece] ?? 'G');
        }
    }
    return cells.join('');
}

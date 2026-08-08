import { FieldConstants, Piece } from '../../enums';
import { convertEngineBoard, EngineBoardState, irFieldToField, minoToPiece } from '../board_converter';

const tile = (mino: string) => ({ mino, connections: 0 });
const emptyRow = () => Array.from({ length: 10 }).map(() => null) as any[];

// rows[0] is the bottom row, same as the engine board state.
const boardOf = (rows: any[][]): EngineBoardState => {
    const state = rows.slice();
    while (state.length < 40) {
        state.push(emptyRow());
    }
    return state;
};

describe('minoToPiece', () => {
    test('maps minos and garbage', () => {
        expect(minoToPiece('i')).toEqual(Piece.I);
        expect(minoToPiece('t')).toEqual(Piece.T);
        expect(minoToPiece('gb')).toEqual(Piece.Gray);
        expect(minoToPiece('bomb')).toEqual(Piece.Gray);
    });
});

describe('convertEngineBoard', () => {
    test('keeps orientation: state[0] stays the bottom row', () => {
        const bottom = emptyRow();
        bottom[3] = tile('s');
        const { field } = convertEngineBoard(boardOf([bottom]));
        expect(field[3]).toEqual(Piece.S);                         // y=0, x=3
        expect(field.filter(cell => cell !== Piece.Empty)).toHaveLength(1);
    });

    test('no clipping within 23 rows', () => {
        const rows = Array.from({ length: 23 }).map(() => {
            const row = emptyRow();
            row[0] = tile('gb');
            return row;
        });
        const { sourceHeight, clippedRowCount } = convertEngineBoard(boardOf(rows));
        expect(sourceHeight).toEqual(23);
        expect(clippedRowCount).toEqual(0);
    });

    test('24+ rows keep the bottom 23 and report the clipped count', () => {
        const rows = Array.from({ length: 25 }).map((ignore, y) => {
            const row = emptyRow();
            row[0] = tile(y === 0 ? 'i' : 'gb');
            return row;
        });
        const { field, sourceHeight, clippedRowCount } = convertEngineBoard(boardOf(rows));
        expect(sourceHeight).toEqual(25);
        expect(clippedRowCount).toEqual(2);
        expect(field).toHaveLength(FieldConstants.PlayBlocks);
        expect(field[0]).toEqual(Piece.I);                         // bottom row survives
        expect(field[22 * 10]).toEqual(Piece.Gray);                // top visible row is row 22
    });

    test('irFieldToField round-trips the cells', () => {
        const bottom = emptyRow();
        bottom[7] = tile('z');
        const { field } = convertEngineBoard(boardOf([bottom]));
        const converted = irFieldToField(field);
        expect(converted.get(7, 0)).toEqual(Piece.Z);
        expect(converted.get(0, 0)).toEqual(Piece.Empty);
    });
});

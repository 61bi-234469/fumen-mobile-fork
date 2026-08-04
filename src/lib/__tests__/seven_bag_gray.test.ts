import { Piece, Rotation } from '../enums';
import { Field } from '../fumen/field';
import { getBlockPositions } from '../piece';
import { advanceSevenBagGrayDisplay } from '../seven_bag_gray';
import { parseSevenBagGrayDisplay, withSevenBagGrayDisplay } from '../comment_metadata';

describe('seven-bag gray display field', () => {
    test('round-trips display metadata alongside a queue comment', () => {
        const display = {
            pieces: Array.from({ length: 230 }, (_, index) => index % 9),
            rowMap: Array.from({ length: 23 }, (_, index) => index + 2),
        };

        const text = withSevenBagGrayDisplay('#Q=[](T)IOLJSZ', display);

        expect(parseSevenBagGrayDisplay(text)).toEqual(display);
        expect(withSevenBagGrayDisplay(text, undefined)).toBe('#Q=[](T)IOLJSZ');
    });

    test('grays older terrain but keeps the current bag piece colored', () => {
        const actual = new Field({});
        actual.add(0, 0, Piece.T);
        const move = { type: Piece.O, rotation: Rotation.Spawn, coordinate: { x: 4, y: 1 } };

        const result = advanceSevenBagGrayDisplay(undefined, actual, move);

        expect(result.field.get(0, 0)).toBe(Piece.Gray);
        getBlockPositions(move.type, move.rotation, move.coordinate.x, move.coordinate.y)
            .forEach(([x, y]) => expect(result.field.get(x, y)).toBe(Piece.O));
    });

    test('retains cleared rows and maps later placements above them', () => {
        const actualBeforeI = new Field({});
        [0, 1, 2, 7, 8, 9].forEach(x => actualBeforeI.add(x, 0, Piece.Gray));
        const iMove = { type: Piece.I, rotation: Rotation.Spawn, coordinate: { x: 4, y: 0 } };
        const afterI = advanceSevenBagGrayDisplay(undefined, actualBeforeI, iMove);

        const actualAfterI = actualBeforeI.copy();
        actualAfterI.put(iMove);
        actualAfterI.clearLine();
        const oMove = { type: Piece.O, rotation: Rotation.Spawn, coordinate: { x: 4, y: 0 } };
        const afterO = advanceSevenBagGrayDisplay(afterI.display, actualAfterI, oMove);

        for (let x = 0; x < 10; x += 1) {
            expect(afterO.field.get(x, 0)).not.toBe(Piece.Empty);
        }
        getBlockPositions(oMove.type, oMove.rotation, oMove.coordinate.x, oMove.coordinate.y)
            .forEach(([x, y]) => expect(afterO.field.get(x, y + 1)).toBe(Piece.O));
    });
});

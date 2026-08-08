import { FieldConstants, Piece } from '../../enums';
import { decode, encode } from '../../fumen/fumen';
import { Field } from '../../fumen/field';
import { Page } from '../../fumen/types';
import { irPointToPage } from '../ir_to_page';
import { IRField } from '../types';

const sampleField = (): IRField => {
    const cells: IRField = Array.from({ length: FieldConstants.PlayBlocks }).map(() => Piece.Empty);
    for (let x = 0; x < 9; x += 1) {
        cells[x] = Piece.Gray;                 // bottom row
    }
    cells[10 + 4] = Piece.T;                   // y=1, x=4
    return cells;
};

const sampleQueue = () => ({
    hold: Piece.J,
    current: Piece.I,
    next: [Piece.O, Piece.S, Piece.Z],
});

describe('irPointToPage', () => {
    test('generates a standalone key page with colorize', () => {
        const page = irPointToPage(sampleField());
        expect(page.index).toEqual(0);
        expect(page.field.ref).toBeUndefined();
        expect(page.field.obj).toBeInstanceOf(Field);
        expect(page.comment.ref).toBeUndefined();
        expect(page.piece).toBeUndefined();
        expect(page.flags.colorize).toBeTruthy();
        expect(page.flags.lock).toBeTruthy();
    });

    test('writes no comment when no queue is supplied', () => {
        const page = irPointToPage(sampleField());
        expect(page.comment.text).toEqual('');
        expect(page.flags.quiz).toBeFalsy();
    });

    test('carries HOLD / current / NEXT as a standard quiz comment', () => {
        const page = irPointToPage(sampleField(), sampleQueue());
        expect(page.comment.text).toEqual('#Q=[J](I)OSZ');
        expect(page.flags.quiz).toBeTruthy();
    });

    test('omits an empty hold and tolerates a missing current', () => {
        expect(irPointToPage(sampleField(), {
            hold: null, current: Piece.T, next: [Piece.L],
        }).comment.text).toEqual('#Q=[](T)L');

        expect(irPointToPage(sampleField(), {
            hold: Piece.T, current: null, next: [],
        }).comment.text).toEqual('#Q=[](T)');
    });

    test('writes no comment when the queue holds nothing usable', () => {
        const page = irPointToPage(sampleField(), { hold: null, current: null, next: [] });
        expect(page.comment.text).toEqual('');
        expect(page.flags.quiz).toBeFalsy();
    });

    test('the field cells survive an encode/decode round trip', async () => {
        const cells = sampleField();
        const encoded = await encode([irPointToPage(cells)]);
        const pages: Page[] = await decode(`v115@${encoded}`);
        expect(pages).toHaveLength(1);
        const decoded = pages[0].field.obj!;
        for (let y = 0; y < FieldConstants.Height; y += 1) {
            for (let x = 0; x < FieldConstants.Width; x += 1) {
                expect(decoded.get(x, y)).toEqual(cells[x + y * FieldConstants.Width]);
            }
        }
    });

    test('the quiz comment survives an encode/decode round trip', async () => {
        const encoded = await encode([irPointToPage(sampleField(), sampleQueue())]);
        const pages: Page[] = await decode(`v115@${encoded}`);
        expect(pages[0].comment.text).toEqual('#Q=[J](I)OSZ');
    });
});

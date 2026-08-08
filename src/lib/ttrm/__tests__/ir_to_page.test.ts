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

describe('irPointToPage', () => {
    test('generates a standalone key page with colorize', () => {
        const page = irPointToPage(sampleField());
        expect(page.index).toEqual(0);
        expect(page.field.ref).toBeUndefined();
        expect(page.field.obj).toBeInstanceOf(Field);
        expect(page.comment.ref).toBeUndefined();
        expect(page.comment.text).toEqual('');
        expect(page.piece).toBeUndefined();
        expect(page.flags.colorize).toBeTruthy();
        expect(page.flags.lock).toBeTruthy();
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
});

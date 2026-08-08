import { FieldConstants, Piece, Rotation } from '../../enums';
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

    test('spawns the current mino so INPUT can move it right away', () => {
        const page = irPointToPage(sampleField(), sampleQueue());
        expect(page.piece).toEqual({
            type: Piece.I,
            rotation: Rotation.Spawn,
            coordinate: { x: 4, y: 20 },
        });
    });

    test('the spawn position follows the rotation system', () => {
        const page = irPointToPage(sampleField(), sampleQueue(), true, false);
        expect(page.piece).toEqual({
            type: Piece.I,
            rotation: Rotation.Spawn,
            coordinate: { x: 4, y: 21 },
        });
    });

    test('nothing is spawned when the point has no current', () => {
        expect(irPointToPage(sampleField(), { hold: Piece.T, current: null, next: [] }).piece)
            .toBeUndefined();
    });

    test('writes no comment when the queue holds nothing usable', () => {
        const page = irPointToPage(sampleField(), { hold: null, current: null, next: [] });
        expect(page.comment.text).toEqual('');
        expect(page.flags.quiz).toBeFalsy();
    });

    // P2 §3-3: 開始地点（空盤面 ＋ ホールド無し ＋ NEXT 全件）も切り出しの対象にする。
    test('the round start point becomes an empty board with the whole opening queue', async () => {
        const empty: IRField = Array.from({ length: FieldConstants.PlayBlocks }).map(() => Piece.Empty);
        const page = irPointToPage(empty, {
            hold: null, current: Piece.T, next: [Piece.I, Piece.O, Piece.S, Piece.Z],
        });
        expect(page.comment.text).toEqual('#Q=[](T)IOSZ');
        expect(page.flags.quiz).toBeTruthy();
        expect(page.field.obj!.toPlayFieldPieces().every(cell => cell === Piece.Empty)).toBeTruthy();

        const pages: Page[] = await decode(`v115@${await encode([page])}`);
        expect(pages[0].comment.text).toEqual('#Q=[](T)IOSZ');
        expect(pages[0].field.obj!.toPlayFieldPieces().every(cell => cell === Piece.Empty)).toBeTruthy();
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

    // ---- FR-54: ゲージ 1 行をせり上がり行として持ち込む（P3 §3-6） ----

    // Field 側の綴りは既存のまま（toSentLintPieces）
    const sentLineOf = (page: Page): Piece[] => page.field.obj!.toSentLintPieces();

    test('without a rise the page is bit-for-bit what P1 / P2 produced', () => {
        const page = irPointToPage(sampleField(), sampleQueue());
        expect(page.flags.rise).toBeFalsy();
        expect(sentLineOf(page).every(cell => cell === Piece.Empty)).toBeTruthy();
    });

    test('a rise fills the sent line with gray except the hole column', () => {
        const page = irPointToPage(sampleField(), sampleQueue(), true, true, { column: 3, size: 1 });
        expect(page.flags.rise).toBeTruthy();
        expect(sentLineOf(page)).toEqual([
            Piece.Gray, Piece.Gray, Piece.Gray, Piece.Empty, Piece.Gray,
            Piece.Gray, Piece.Gray, Piece.Gray, Piece.Gray, Piece.Gray,
        ]);
    });

    test('a wider hole opens the matching number of columns', () => {
        const page = irPointToPage(sampleField(), undefined, true, true, { column: 8, size: 2 });
        expect(sentLineOf(page).filter(cell => cell === Piece.Empty)).toHaveLength(2);
        expect(sentLineOf(page)[8]).toEqual(Piece.Empty);
        expect(sentLineOf(page)[9]).toEqual(Piece.Empty);
    });

    test('the hole is clamped so a bad column never spills out of the row', () => {
        const page = irPointToPage(sampleField(), undefined, true, true, { column: 9, size: 4 });
        expect(sentLineOf(page)).toHaveLength(FieldConstants.Width);
        expect(sentLineOf(page)[9]).toEqual(Piece.Empty);
    });

    test('the sent line and the rise flag survive an encode/decode round trip', async () => {
        const page = irPointToPage(sampleField(), sampleQueue(), true, true, { column: 6, size: 1 });
        const pages: Page[] = await decode(`v115@${await encode([page])}`);
        expect(pages[0].flags.rise).toBeTruthy();
        expect(sentLineOf(pages[0])).toEqual(sentLineOf(page));
        // §3-6 の要: コメントは quiz のままでなければならない
        expect(pages[0].comment.text!.startsWith('#Q=')).toBeTruthy();
    });
});

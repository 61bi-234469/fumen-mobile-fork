import { isMinoPaletteSelection, paletteMinoImageSrc } from '../editor_interaction';
import { Piece } from '../enums';

describe('paletteMinoImageSrc', () => {
    const minos = [Piece.I, Piece.L, Piece.O, Piece.Z, Piece.T, Piece.J, Piece.S];

    test('uses the guideline asset when guideLineColor is enabled', () => {
        expect(paletteMinoImageSrc(Piece.I, true)).toBe('img/I.svg');
        expect(paletteMinoImageSrc(Piece.T, true)).toBe('img/T.svg');
    });

    test('uses the classic asset when guideLineColor is disabled', () => {
        expect(paletteMinoImageSrc(Piece.I, false)).toBe('img/I_classic.svg');
        expect(paletteMinoImageSrc(Piece.T, false)).toBe('img/T_classic.svg');
    });

    test('resolves a name for every palette mino', () => {
        minos.forEach((piece) => {
            expect(isMinoPaletteSelection(piece)).toBe(true);
            expect(paletteMinoImageSrc(piece, true)).toMatch(/^img\/[ILOZTJS]\.svg$/);
            expect(paletteMinoImageSrc(piece, false)).toMatch(/^img\/[ILOZTJS]_classic\.svg$/);
        });
    });
});

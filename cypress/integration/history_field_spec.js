import { datatest, Piece, Rotation } from '../support/common';
import { operations } from '../support/operations';
import { play } from '../support/history_play';

describe('History (field)', () => {
    it('Clear', () => {
        const testCases = [
            {
                callback: () => {
                    operations.mode.tools.nextPage();
                    operations.mode.tools.nextPage();
                    operations.mode.tools.nextPage();
                    operations.mode.utils.clearPast();
                },
                fumen: 'v115@HhglBeBtEeglCeBtDehlAezhMeWSYFAooMDEPBAAAv?hBToQFA3XaDEEBAAAPnB',
                count: 1,
            },
            {
                callback: () => {
                    operations.mode.utils.clearToEnd();
                },
                fumen: 'v115@HhglBeBtEeglCeBtDehlAezhMeWSYFAooMDEPBAAA',
                count: 1,
            },
            {
                callback: () => {
                    operations.menu.firstPage();
                    operations.mode.comment.open();
                    cy.get(datatest('text-comment')).clear().type('#Q=[](O)TS');
                },
                fumen: 'v115@HhglBeBtEeglCeBtDehlAezhMeWSYWAFLDmClcJSAV?DEHBEooRBPoAVBUNBAA',
                count: 1,
            },
            {
                callback: () => {
                    operations.mode.piece.place(Piece.O, Rotation.Spawn, 8, 1);
                },
                fumen: 'v115@HhglBeBtEeglCeBtDehlAezhMeWSYWAFLDmClcJSAV?DEHBEooRBPoAVBUNBAAHhg0BeBtEeg0CeBtAeglBeh0AeT4?ilJeTIYWAFLDmClcJSAVDEHBEooRBPoAVBUNBAA',
                count: 1,
            },
            {
                callback: () => {
                    operations.mode.piece.place(Piece.T, Rotation.Reverse, 2, 1);
                },
                fumen: 'v115@HhglBeBtEeglCeBtDehlAezhMeWSYWAFLDmClcJSAV?DEHBEooRBPoAVBUNBAAHhg0BeBtEeg0CeBtAeglBeh0AeT4?ilJeTIYWAFLDmClcJSAVDEHBEooRBPoAVBUNBAAPhxwHexw?TeFKYVAFLDmClcJSAVDEHBEooRBUoAVBzAAAA',
                count: 1,
            },
            {
                callback: () => {
                    operations.mode.piece.place(Piece.S, Rotation.Right, 5, 1);
                },
                fumen: 'v115@HhglBeBtEeglCeBtDehlAezhMeWSYWAFLDmClcJSAV?DEHBEooRBPoAVBUNBAAHhg0BeBtEeg0CeBtAeglBeh0AeT4?ilJeTIYWAFLDmClcJSAVDEHBEooRBPoAVBUNBAAPhxwHexw?TeFKYVAFLDmClcJSAVDEHBEooRBUoAVBzAAAAchSpPePMYU?AFLDmClcJSAVDEHBEooRBToAVB',
                count: 1,
            },
            {
                callback: () => {
                    operations.mode.tools.backPage();
                    operations.mode.utils.clearToEnd();
                },
                fumen: 'v115@HhglBeBtEeglCeBtDehlAezhMeWSYWAFLDmClcJSAV?DEHBEooRBPoAVBUNBAAHhg0BeBtEeg0CeBtAeglBeh0AeT4?ilJeTIYWAFLDmClcJSAVDEHBEooRBPoAVBUNBAAPhxwHexw?TeFKYVAFLDmClcJSAVDEHBEooRBUoAVBzAAAA',
                count: 1,
            },
            {
                callback: () => {
                    operations.mode.utils.clearPast();
                },
                fumen: 'v115@HhA8BeB8CeC8CeB8AeE8AeG8JeFKYVAFLDmClcJSAV?DEHBEooRBUoAVBzAAAA',
                count: 1,
            },
        ];

        play('v115@vhFRQYFAooMDEPBAAAKpBUmBWyBToQFA3XaDEEBAAA?PnB', testCases);
    });

    it('Slide', () => {
        const testCases = [
            {
                callback: () => {
                    operations.mode.piece.place(Piece.I, Rotation.Spawn, 4, 0);
                },
                fumen: 'v115@hlFexhhlFexh9gRpFeBtRpFeBtg0HewwRQJ',
                // スポーン + ドラッグ
                count: 2,
            },
            {
                callback: () => {
                    operations.mode.slide.open();
                    operations.mode.slide.right();
                },
                fumen: 'v115@AehlFewhAehlFewh+gRpFeAtAeRpFeAtg0HewwxQJ',
                count: 1,
            },
            {
                callback: () => {
                    operations.mode.slide.open();
                    operations.mode.slide.up();
                },
                fumen: 'v115@AehlFewh+gRpFeAtAeRpFeAtJeg0HewwxLJ',
                count: 1,
            },
            {
                callback: () => {
                    operations.mode.slide.open();
                    operations.mode.slide.left();
                    operations.mode.slide.left();
                },
                fumen: 'v115@glFewh/gQpFeAtBeQpFeAtLeg0HewwxKJ',
                count: 2,
            },
            {
                callback: () => {
                    operations.mode.slide.open();
                    operations.mode.slide.down();
                    operations.mode.slide.down();
                },
                fumen: 'v115@TeglFewh/gQpFeAtBeg0HewwAgH',
                count: 2,
            },
        ];

        // Representative: cases with count > 1 (multi-press undo grouping) keep full per-step
        // undo/redo verification.
        play('v115@hlFexhhlFexh9gRpFeBtRpFeBtg0HewwAgH', testCases, { fullUndoRedo: true });
    });

    it('Fill row', () => {
        const testCases = [
            {
                callback: () => {
                    operations.mode.fillRow.open();
                    operations.mode.block.click(0, 0);
                },
                fumen: 'v115@chI8JeAgH',
                count: 1,
            },
            {
                callback: () => {
                    operations.mode.fillRow.open();
                    operations.mode.fillRow.I();
                    operations.mode.block.dragToUp(1, { from: 1, to: 4 });
                },
                fumen: 'v115@zgwhAe4hAe4hAe4hAe3hAeI8JeAgH',
                count: 1,
            },
            {
                callback: () => {
                    operations.mode.fillRow.open();
                    operations.mode.fillRow.S();
                    operations.mode.block.dragToRight({ from: 5, to: 8 }, 0);
                },
                fumen: 'v115@zgwhAe4hAe4hAe4hAe3hX4AeQ4JeAgH',
                count: 1,
            },
            {
                callback: () => {
                    operations.mode.fillRow.open();
                    operations.mode.fillRow.T();
                    operations.mode.block.click(4, -1);
                },
                fumen: 'v115@zgwhAe4hAe4hAe4hAe3hX4AeQ4zwAe0wAgH',
                count: 1,
            },
            {
                callback: () => {
                    operations.mode.fillRow.open();
                    operations.mode.fillRow.Empty();
                    // Sent-line and field blocks use separate Konva drag state. Clear the
                    // sent line with its own gesture, then sweep the field rows.
                    operations.mode.block.click(9, -1);
                    operations.mode.block.dragToUp(9, { from: 0, to: 10 });
                },
                fumen: 'v115@vhAAgH',
                count: 1,
            },
        ];

        play('v115@vhAAgH', testCases);
    });

    it('Fill & Clear', () => {
        const testCases = [
            {
                callback: () => {
                    operations.mode.fill.open();
                    operations.mode.fill.Gray();
                    operations.mode.block.dragToUp(4, { from: 4, to: 11 });
                },
                fumen: 'v115@RfF8CeH8AeU8AtF8AtB8AtF8AtB8AtF8AtU8AeH8Ce?F8zeAgH',
                count: 1,
            },
            {
                callback: () => {
                    operations.mode.fill.open();
                    operations.mode.fill.L();
                    operations.mode.block.click(5, -1);
                },
                fumen: 'v115@RfF8CeH8AeU8AtF8AtB8AtF8AtB8AtF8AtU8AeH8Ce?F8peplAgH',
                count: 1,
            },

            {
                callback: () => {
                    operations.mode.tools.clearField();
                },
                fumen: 'v115@vhAAgH',
                count: 1,
            },
        ];

        play('v115@RfF8CeA8FeA8AeA8HeA8BeFtCeAtFeAtBeAtAezwAe?AtBeAtFeAtCeFtBeA8HeA8AeA8FeA8CeF8zeAgH', testCases);
    });

    it('Mirror', () => {
        const testCases = [
            {
                callback: () => {
                    operations.mode.tools.mirror({ home: true });
                },
                fumen: 'v115@FhR4GeR4wwFeBtxwGeBtwwJe2OYWAFLDmClcJSAVDE?HBEooRBKoAVBvCBAAvhBzEJi/I9gi0Eexhg0xwDexhQpglx?wCeBtRpilDeBtQpJeAgWAA',
                count: 1,
            },
            {
                callback: () => {
                    operations.mode.tools.nextPage();
                    operations.mode.tools.mirror({ home: true });
                },
                fumen: 'v115@FhR4GeR4wwFeBtxwGeBtwwJe2OYWAFLDmClcJSAVDE?HBEooRBKoAVBvCBAA9gBtFexDwwBtDexDQLQawwR4BeBPQL?wSQaxhDehWwSJezHYVAFLDmClcJSAVDEHBEooRBPoAVBqAA?AAvhAGDJ9gBtA8DegHhlQpBtDexwglRpwhwDBeA8xwg0Qpx?hDei0JeAgWAA',
                count: 1,
            },
            {
                callback: () => {
                    operations.mode.tools.backPage();
                    operations.mode.tools.convertToGray({ home: true });
                },
                fumen: 'v115@FhB8GeC8FeD8GeC8Je2OYWAFLDmClcJSAVDEHBEooR?BKoAVBvCBAA9gBtFeBAwwBtDeCAQawwR4BeCAgHQaxhDeiH?JezHYVAFLDmClcJSAVDEHBEooRBPoAVBqAAAAvhAGDJ9gBt?A8DegHhlQpBtDexwglRpwhwDBeA8xwg0QpxhDei0JeAgWAA',
                count: 1,
            },
        ];

        play('v115@9gBtHewwBtGexwR4FewwR4QeSSYWAFLDmClcJSAVDE?HBEooRBMoAVBv/AAAvhBzHJGDJ9gBtA8DegHhlQpBtDexwg?lRpwhwDBeA8xwg0QpxhDei0JeAgWAA', testCases);
    });

    it('Convert to gray', () => {
        const testCases = [
            {
                callback: () => {
                    operations.mode.tools.convertToGray({ home: true });
                },
                fumen: 'v115@pgB8HeB8HeD8DeF8CeG8BeH8CeK8AeA8AgH',
                count: 1,
            },
        ];

        play('v115@pgB8HeB8HeilwhDeR4glRpwhCeR4wwg0RpwhBeBtxw?i0whCeBtwwA8whglQpAtwwg0Q4AeA8AgH', testCases);
    });
});

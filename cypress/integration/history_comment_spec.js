import { datatest, Piece, Rotation } from '../support/common';
import { operations } from '../support/operations';
import { play } from '../support/history_play';

describe('History (comment)', () => {
    it('Quiz', () => {
        const testCases = [
            {
                callback: () => {
                    operations.mode.comment.open();
                    cy.get(datatest('text-comment')).type('#Q=[](I)OJLSTZ');
                },
                fumen: 'v115@vhAAgWaAFLDmClcJSAVDEHBEooRBJoAVBv/rtC0XBA?A',
                count: 1,
            },
            {
                callback: () => {
                    operations.mode.piece.place(Piece.O, Rotation.Spawn, 1, 0);
                },
                fumen: 'v115@vhAzJYaAFLDmClcJSAVDEHBEooRBJoAVBv/rtC0XBA?A',
                count: 1,
            },
            {
                callback: () => {
                    operations.mode.piece.place(Piece.J, Rotation.Right, 0, 1);
                },
                fumen: 'v115@vhAzJYaAFLDmClcJSAVDEHBEooRBJoAVBv/rtC0XBA?AShxwHexwQeOJYZAFLDmClcJSAVDVSAVG88AYP88AZyTxC6?AAAA',
                count: 1,
            },
            {
                callback: () => {
                    operations.mode.piece.place(Piece.I, Rotation.Spawn, 1, 3);
                },
                fumen: 'v115@vhAzJYaAFLDmClcJSAVDEHBEooRBJoAVBv/rtC0XBA?AShxwHexwQeOJYZAFLDmClcJSAVDVSAVG88AYP88AZyTxC6?AAAAHhhlHeglIeglSex/XYAFLDmClcJSAVDVSAVG88AYS88?A5MmFD',
                count: 1,
            },
            {
                callback: () => {
                    operations.mode.comment.open();
                    cy.get(datatest('text-comment')).clear().type('#Q=[](T)S');
                },
                fumen: 'v115@vhAzJYaAFLDmClcJSAVDEHBEooRBJoAVBv/rtC0XBA?AShxwHexwQeOJYZAFLDmClcJSAVDVSAVG88AYP88AZyTxC6?AAAAHhhlHeglIeglSex/XVAFLDmClcJSAVDEHBEooRBUoAV?BzAAAA',
                count: 1,
            },
            {
                callback: () => {
                    operations.mode.piece.place(Piece.T, Rotation.Left, 9, 1);
                },
                fumen: 'v115@vhAzJYaAFLDmClcJSAVDEHBEooRBJoAVBv/rtC0XBA?AShxwHexwQeOJYZAFLDmClcJSAVDVSAVG88AYP88AZyTxC6?AAAAHhhlHeglIeglSex/XVAFLDmClcJSAVDEHBEooRBUoAV?BzAAAA9gT4te9NYVAFLDmClcJSAVDEHBEooRBUoAVBzAAAA',
                count: 1,
            },
            {
                callback: () => {
                    operations.mode.piece.place(Piece.Z, Rotation.Spawn, 7, 0);
                },
                fumen: 'v115@vhAzJYaAFLDmClcJSAVDEHBEooRBJoAVBv/rtC0XBA?AShxwHexwQeOJYZAFLDmClcJSAVDVSAVG88AYP88AZyTxC6?AAAAHhhlHeglIeglSex/XVAFLDmClcJSAVDEHBEooRBUoAV?BzAAAA9gT4te9NYVAFLDmClcJSAVDEHBEooRBUoAVBzAAAA?QhQpHeRpIeQpJe0MYUAFLDmClcJSAVDEHBEooRBToAVB',
                count: 1,
            },
            {
                callback: () => {
                    operations.mode.piece.place(Piece.S, Rotation.Spawn, 8, 2);
                },
                fumen: 'v115@vhAzJYaAFLDmClcJSAVDEHBEooRBJoAVBv/rtC0XBA?AShxwHexwQeOJYZAFLDmClcJSAVDVSAVG88AYP88AZyTxC6?AAAAHhhlHeglIeglSex/XVAFLDmClcJSAVDEHBEooRBUoAV?BzAAAA9gT4te9NYVAFLDmClcJSAVDEHBEooRBUoAVBzAAAA?QhQpHeRpIeQpJe0MYUAFLDmClcJSAVDEHBEooRBToAVBXhB?tIeBtKeXDYUAFLDmClcJSAVDEHBEooRBToAVB',
                count: 1,
            },
            {
                callback: () => {
                    operations.mode.tools.nextPage();
                },
                fumen: 'v115@vhAzJYaAFLDmClcJSAVDEHBEooRBJoAVBv/rtC0XBA?AShxwHexwQeOJYZAFLDmClcJSAVDVSAVG88AYP88AZyTxC6?AAAAHhhlHeglIeglSex/XVAFLDmClcJSAVDEHBEooRBUoAV?BzAAAA9gT4te9NYVAFLDmClcJSAVDEHBEooRBUoAVBzAAAA?QhQpHeRpIeQpJe0MYUAFLDmClcJSAVDEHBEooRBToAVBXhB?tIeBtKeXDYUAFLDmClcJSAVDEHBEooRBToAVBvhAAgH',
                count: 1,
            },
            {
                callback: () => {
                    operations.mode.comment.open();
                    cy.get(datatest('text-comment')).clear().type('hello world');
                },
                fumen: 'v115@vhAzJYaAFLDmClcJSAVDEHBEooRBJoAVBv/rtC0XBA?AShxwHexwQeOJYZAFLDmClcJSAVDVSAVG88AYP88AZyTxC6?AAAAHhhlHeglIeglSex/XVAFLDmClcJSAVDEHBEooRBUoAV?BzAAAA9gT4te9NYVAFLDmClcJSAVDEHBEooRBUoAVBzAAAA?QhQpHeRpIeQpJe0MYUAFLDmClcJSAVDEHBEooRBToAVBXhB?tIeBtKeXDYUAFLDmClcJSAVDEHBEooRBToAVBvhAAgWNAoo?MDEvoo2A3XaDEEBAAA',
                count: 1,
            },
            {
                callback: () => {
                    operations.menu.firstPage();
                    operations.mode.tools.nextPage();
                    operations.mode.comment.open();
                    cy.get(datatest('text-comment')).clear().type('こんにちは');
                },
                fumen: 'v115@vhAzJYaAFLDmClcJSAVDEHBEooRBJoAVBv/rtC0XBA?AShxwHexwQeOJYeAlvs2A1sDfEToABBlvs2AWDEfET4J6Al?vs2AW5AAAHhhlHeglIeglSex/XVAFLDmClcJSAVDEHBEooR?BUoAVBzAAAA9gT4te9NYVAFLDmClcJSAVDEHBEooRBUoAVB?zAAAAQhQpHeRpIeQpJe0MYUAFLDmClcJSAVDEHBEooRBToA?VBXhBtIeBtKeXDYUAFLDmClcJSAVDEHBEooRBToAVBvhAAg?WNAooMDEvoo2A3XaDEEBAAA',
                count: 1,
            },
        ];

        play('v115@vhAAgH', testCases);
    });

    it('Comment', () => {
        const testCases = [
            {
                callback: () => {
                    operations.mode.comment.open();
                    cy.get(datatest('text-comment')).clear().type('test1');

                    operations.mode.tools.nextPage();
                    operations.mode.tools.nextPage();

                    cy.get(datatest('text-comment')).clear().type('test2');

                    operations.mode.tools.nextPage();
                    operations.mode.tools.nextPage();
                    operations.mode.tools.nextPage();
                    operations.mode.tools.nextPage();

                    cy.get(datatest('text-comment')).clear().type('test3');
                },
                fumen: 'v115@vhGAgWFA0YceERAAAAAgHAgWFA0YceESAAAAAgHAgH?AgHAgWFA0YceETAAAA',
                count: 9,
            },
            {
                callback: () => {
                    operations.mode.tools.backPage();
                    operations.mode.tools.backPage();
                    operations.mode.tools.backPage();
                    operations.mode.tools.backPage();

                    operations.mode.comment.open();
                    cy.get(datatest('text-comment')).clear().type('test1');

                    operations.mode.tools.backPage();

                    cy.get(datatest('text-comment')).clear().type('hello');
                },
                fumen: 'v115@vhGAgWFA0YceERAAAAAgWFAooMDEPBAAAAgHAgHAgH?AgHAgWFA0YceETAAAA',
                count: 2,
            },
            {
                callback: () => {
                    operations.mode.tools.nextPage();

                    operations.mode.comment.open();
                    cy.get(datatest('text-comment')).clear().type('#Q=[](O)LTS');

                    operations.mode.piece.place(Piece.O, Rotation.Spawn, 0, 0);

                    operations.mode.tools.nextPage();

                    operations.mode.piece.place(Piece.T, Rotation.Left, 9, 1);

                    operations.mode.tools.nextPage();

                    operations.mode.piece.place(Piece.S, Rotation.Spawn, 8, 2);
                },
                fumen: 'v115@vhCAgWFA0YceERAAAAAgWFAooMDEPBAAATJYXAFLDm?ClcJSAVDEHBEooRBPoAVBs+zBARhxSHexSRe9NJQhQLHeRL?IeQLJeXDJFhxDGexDeeAgHvhAAgWFA0YceETAAAA',
                count: 4,
            },
            {
                callback: () => {
                    operations.mode.comment.open();
                    cy.get(datatest('text-comment')).clear().type('#Q=[](I)SZO');
                },
                fumen: 'v115@vhCAgWFA0YceERAAAAAgWFAooMDEPBAAATJYXAFLDm?ClcJSAVDEHBEooRBPoAVBs+zBARhxSHexSRe9NJQhQLHeRL?IeQLJeXDYXAFLDmClcJSAVDEHBEooRBJoAVBzHrBAFhxDGe?xDeeAgHvhAAgWFA0YceETAAAA',
                count: 1,
            },
            {
                callback: () => {
                    operations.mode.comment.open();
                    cy.get(datatest('text-comment')).clear().type('#Q=[L](S)');
                },
                fumen: 'v115@vhCAgWFA0YceERAAAAAgWFAooMDEPBAAATJYXAFLDm?ClcJSAVDEHBEooRBPoAVBs+zBARhxSHexSRe9NJQhQLHeRL?IeQLJeXDJFhxDGexDeeAgHvhAAgWFA0YceETAAAA',
                count: 1,
            },
            {
                callback: () => {
                    operations.mode.tools.backPage();

                    operations.mode.comment.open();
                    cy.get(datatest('text-comment')).clear().type('world');
                },
                fumen: 'v115@vhCAgWFA0YceERAAAAAgWFAooMDEPBAAATJYXAFLDm?ClcJSAVDEHBEooRBPoAVBs+zBARhxSHexSRe9NYFA3XaDEE?BAAAQhQLHeRLIeQLJeXDJFhxDGexDeeAgHvhAAgWFA0YceE?TAAAA',
                count: 1,
            },
        ];

        // コメント確定・ページ追加・ミノ操作が混在して履歴数が可変になるため、
        // ケース全体の undo/redo 往復で検証する（count は前進時の記録用に維持）。
        play('v115@vhAAgH', testCases);
    });

    it('Append', () => {
        const testCases = [
            {
                callback: () => {
                    operations.menu.append();

                    cy.get(datatest('mdl-append-fumen')).should('be.visible')
                        .within(() => {
                            cy.get(datatest('input-fumen')).clear().type('v115@vhExOYZAFLDmClcJSAVjiSAVG88A4N88A5N1LCpAAA?AxpBTrBxxBxxB');
                            cy.get(datatest('btn-append-to-end')).click();
                        });

                    cy.wait(500);
                },
                fumen: 'v115@vhJ2OYYAFLDmClcJSAVzbSAVG88AYP88A5tSgCRqBT?sBTtBSwBxOYZAFLDmClcJSAVjiSAVG88A4N88A5N1LCpAAA?AxpBTrBxxBxxB',
                count: 1,
            },
            {
                callback: () => {
                    operations.menu.firstPage();
                    operations.mode.tools.nextPage();
                    operations.mode.tools.nextPage();

                    operations.menu.append();

                    cy.get(datatest('mdl-append-fumen')).should('be.visible')
                        .within(() => {
                            cy.get(datatest('input-fumen')).clear().type('v115@bhI8KeAgWFAooMDEPBAAARhI8UeAAAHhI8eeAAA');
                            cy.get(datatest('btn-append-to-next')).click();
                        });

                    cy.wait(500);
                },
                fumen: 'v115@vhC2OYYAFLDmClcJSAVzbSAVG88AYP88A5tSgCRqBT?sBRhgHTaAexSBeilC8xwA8KeAgWFAooMDEPBAAARhI8UeAA?AHhI8eeAAAHhIAAegWzDAARLAAAeiWCARLAAKeTNYVAFLDm?ClcJSAVzbSAVG88A4W88AZAAAAvhFSwBxOYZAFLDmClcJSA?VjiSAVG88A4N88A5N1LCpAAAAxpBTrBxxBxxB',
                count: 1,
            },
            {
                callback: () => {
                    operations.menu.firstPage();
                    operations.mode.tools.nextPage();
                    operations.mode.tools.nextPage();
                    operations.mode.tools.nextPage();
                    operations.mode.tools.nextPage();

                    operations.menu.append();

                    cy.get(datatest('mdl-append-fumen')).should('be.visible')
                        .within(() => {
                            cy.get(datatest('input-fumen')).clear().type('v115@zgwhIewhIewhIewhIewhSeAgH0gwhIewhIewhIewhI?ewhReAAA1gwhIewhIewhIewhIewhQeAAA');
                            cy.get(datatest('btn-append-to-next')).click();
                        });

                    cy.wait(500);
                },
                fumen: 'v115@vhC2OYYAFLDmClcJSAVzbSAVG88AYP88A5tSgCRqBT?sBRhgHTaAexSBeilC8xwA8KeAgWFAooMDEPBAAARhI8UeAA?AzgwhIewhIewhIewDHAAewDHAKeAgWAA0gwhIewhIewhIew?hIewhReAAA1gwhIewhIewhIewhIewhQeAAAzgSaGeSaGeS4?F8AeS4F8AeS4F8KeAgWFAooMDEPBAAAHhIAAegWzDAARLAA?AeiWCARLAAKeTNYVAFLDmClcJSAVzbSAVG88A4W88AZAAAA?vhFSwBxOYZAFLDmClcJSAVjiSAVG88A4N88A5N1LCpAAAAx?pBTrBxxBxxB',
                count: 1,
            },
        ];

        play('v115@vhE2OYYAFLDmClcJSAVzbSAVG88AYP88A5tSgCRqBT?sBTtBSwB', testCases);
    });

    it('Comment mode', () => {
        const testCases = [
            {
                callback: () => {
                    operations.mode.tools.nextPage();
                    operations.mode.tools.nextPage();
                    operations.mode.tools.nextPage();
                    operations.mode.tools.inheritComment({ home: true });
                },
                fumen: 'v115@vhFAgWFAooMDEPBAAAAgHAgHAgHAgHAgH',
                count: 1,
            },
            {
                callback: () => {
                    operations.mode.tools.backPage();
                    operations.mode.tools.blankComment({ home: true });
                },
                fumen: 'v115@vhFAgWFAooMDEPBAAAAgHAgWAAAgHAgHAgH',
                count: 1,
            },
        ];

        play('v115@vhFAgWFAooMDEPBAAAAgHAgHAgWFA3XaDEEBAAAAgH?AgH', testCases);
    });
});

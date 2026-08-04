import { block, Color, datatest, mino, Piece, Rotation, visit } from '../support/common';
import { operations } from '../support/operations';

const assertRailOrder = () => {
    const selectors = [
        'btn-editor-import',
        'btn-editor-export',
        'btn-insert-new-page',
        'btn-utils-mode',
        'btn-piece-mode',
        'btn-piece-i',
    ];
    cy.get(selectors.map(datatest).join(',')).then(elements => {
        const tops = selectors.map(selector => elements
            .filter(`[datatest="${selector}"]`)[0].getBoundingClientRect().top);
        expect(tops).to.deep.equal([...tops].sort((left, right) => left - right));
    });
};

const assertRailArrangement = () => {
    const selectors = ['btn-utils-mode', 'btn-piece-mode', 'btn-piece-layout', 'btn-cold-clear',
        'btn-select-mode', 'btn-paint-mode'];
    cy.get(selectors.map(datatest).join(',')).then(elements => {
        const rect = selector => elements.filter(datatest(selector))[0].getBoundingClientRect();
        const utilities = rect('btn-utils-mode');
        const piece = rect('btn-piece-mode');
        const play = rect('btn-piece-layout');
        const ai = rect('btn-cold-clear');
        const select = rect('btn-select-mode');
        const paint = rect('btn-paint-mode');
        // UTILSの直下に [PLAY|AI]、その下にPIECE・SELECT・PAINTの縦並びが続く
        expect(play.top - utilities.bottom).to.be.greaterThan(0);
        expect(play.top - utilities.bottom).to.be.lessThan(10);
        expect(Math.abs(play.top - ai.top)).to.be.lessThan(1);
        expect(play.left).to.be.lessThan(ai.left);
        expect(piece.top - play.bottom).to.be.greaterThan(0);
        expect(piece.top - play.bottom).to.be.lessThan(10);
        expect(piece.top).to.be.lessThan(select.top);
        expect(select.top).to.be.lessThan(paint.top);
        // PIECEはSELECT/PAINTと同じ全幅セル
        expect(piece.left).to.be.closeTo(select.left, 1);
        expect(piece.right).to.be.closeTo(select.right, 1);
    });
};

const assertPieceRailTwoColumns = () => {
    const rowPairs = [
        ['btn-piece-layout', 'btn-cold-clear'],
        ['btn-piece-i', 'btn-piece-l'],
        ['btn-piece-o', 'btn-piece-z'],
        ['btn-piece-t', 'btn-piece-j'],
        ['btn-piece-s', 'btn-piece-empty'],
        ['btn-piece-gray', 'btn-piece-palette-spacer'],
    ];
    const selectors = rowPairs.reduce((all, pair) => all.concat(pair), []);
    cy.get([datatest('editor-rail'), datatest('btn-piece-mode'), ...selectors.map(datatest)].join(','))
        .then(elements => {
            const rect = selector => elements.filter(datatest(selector))[0].getBoundingClientRect();
            const rail = rect('editor-rail');
            expect(rect('btn-piece-mode').top).to.be.at.least(rail.top - 1);
            rowPairs.forEach(([leftSelector, rightSelector]) => {
                const left = rect(leftSelector);
                const right = rect(rightSelector);
                expect(Math.abs(left.top - right.top)).to.be.lessThan(1);
                expect(left.right).to.be.at.most(right.left);
            });
            selectors.map(rect).forEach(cell => {
                expect(cell.left).to.be.at.least(rail.left);
                expect(cell.right).to.be.at.most(rail.right);
                expect(cell.width).to.be.at.least(28);
                expect(cell.height).to.be.at.least(18);
            });
        });
    cy.get(`${datatest('editor-rail')},${datatest('btn-piece-palette-spacer')}`).then(elements => {
        const rail = elements.filter(datatest('editor-rail'))[0].getBoundingClientRect();
        const lastCell = elements.filter(datatest('btn-piece-palette-spacer'))[0].getBoundingClientRect();
        expect(rail.bottom - lastCell.bottom).to.be.at.least(0);
    });
};

const assertPieceNormalModeRows = () => {
    cy.get([datatest('editor-rail'), datatest('btn-piece-mode'), datatest('btn-select-mode'),
        datatest('btn-paint-mode')].join(','))
        .then(elements => {
            const rect = selector => elements.filter(datatest(selector))[0].getBoundingClientRect();
            const rail = rect('editor-rail');
            const piece = rect('btn-piece-mode');
            const select = rect('btn-select-mode');
            const paint = rect('btn-paint-mode');
            // 編集モード3種はPIECE→SELECT→PAINTの縦並び
            expect(piece.top).to.be.lessThan(select.top);
            expect(select.top).to.be.lessThan(paint.top);
            [piece, select, paint].forEach(cell => {
                expect(cell.left).to.be.closeTo(rail.left, 1);
                expect(cell.right).to.be.closeTo(rail.right, 1);
            });
        });
};

const assertPlayRailArrangement = () => {
    const selectors = ['editor-rail', 'btn-cold-clear', 'btn-piece-mode', 'btn-piece-layout',
        'btn-paint-mode', 'btn-select-mode', 'btn-piece-reset'];
    cy.get(selectors.map(datatest).join(',')).then(elements => {
        const rect = selector => elements.filter(datatest(selector))[0].getBoundingClientRect();
        const rail = rect('editor-rail');
        const ai = rect('btn-cold-clear');
        const piece = rect('btn-piece-mode');
        const play = rect('btn-piece-layout');
        const paint = rect('btn-paint-mode');
        const select = rect('btn-select-mode');
        const reset = rect('btn-piece-reset');
        // [PLAY|AI] が最上段、その下にPIECEの全幅行が続く
        expect(play.top).to.be.closeTo(ai.top, 1);
        expect(play.left).to.be.lessThan(ai.left);
        expect(play.left).to.be.closeTo(rail.left, 1);
        expect(ai.right).to.be.closeTo(rail.right, 1);
        expect(piece.top).to.be.greaterThan(play.top);
        expect(piece.left).to.be.closeTo(rail.left, 1);
        expect(piece.right).to.be.closeTo(rail.right, 1);
        expect(paint.top).to.be.greaterThan(piece.top);
        expect(paint.top).to.be.closeTo(select.top, 1);
        expect(paint.left).to.be.lessThan(select.left);
        // スポーンミノ削除・リスポーンを畳んだ結果、最下段はRESETの全幅セルだけになる
        expect(reset.top).to.be.greaterThan(paint.top);
        expect(reset.left).to.be.closeTo(rail.left, 1);
        expect(reset.right).to.be.closeTo(rail.right, 1);
    });
    cy.get(datatest('btn-piece-reset')).should('contain.text', 'RESET');
    // Playの2分割セルは、ラベルが収まる幅のときだけアイコンの下に文字を出す
    [
        ['btn-piece-layout', 'INPUT'],
        ['btn-cold-clear', 'AI'],
        ['btn-paint-mode', 'PAINT'],
        ['btn-select-mode', 'SELECT'],
    ].forEach(([selector, label]) => {
        cy.get(datatest(selector)).then(([cell]) => {
            const button = cell.getBoundingClientRect();
            const content = cell.firstElementChild.getBoundingClientRect();
            expect(content.width).to.be.at.most(button.width);
            expect(content.height).to.be.at.most(button.height);
            if (button.width - 4 >= 32) {
                expect(cell.textContent).to.contain(label);
            } else {
                expect(cell.textContent).to.not.contain(label);
            }
        });
    });
};

const assertPieceRailSingleColumn = () => {
    const selectors = [
        'btn-piece-i',
        'btn-piece-l',
        'btn-piece-o',
        'btn-piece-z',
        'btn-piece-t',
        'btn-piece-j',
        'btn-piece-s',
        'btn-piece-empty',
        'btn-piece-gray',
        'btn-piece-palette-spacer',
    ];
    cy.get([datatest('editor-rail'), datatest('btn-piece-mode'), ...selectors.map(datatest)].join(','))
        .then(elements => {
            const rect = selector => elements.filter(datatest(selector))[0].getBoundingClientRect();
            const rail = rect('editor-rail');
            expect(rect('btn-piece-mode').top).to.be.at.least(rail.top - 1);
            const cells = selectors.map(rect);
            cells.forEach((cell, index) => {
                expect(cell.left).to.be.closeTo(cells[0].left, 1);
                expect(cell.width).to.be.closeTo(cells[0].width, 1);
                expect(cell.left).to.be.at.least(rail.left);
                expect(cell.right).to.be.at.most(rail.right);
                // PIECE通常はPAINT/SELECTと同じ10セル配置で、セル高も揃える
                expect(cell.height).to.be.at.least(20);
                if (index > 0) {
                    expect(cell.top).to.be.greaterThan(cells[index - 1].top);
                }
            });
            expect(cells[cells.length - 1].bottom).to.be.at.most(rail.bottom);
        });
};

const assertInfiniteToggleFits = () => {
    cy.get(datatest('piece-queue-infinite')).then(toggle => {
        const toggleRect = toggle[0].getBoundingClientRect();
        const checkboxRect = toggle.find(datatest('piece-queue-infinite-checkbox'))[0].getBoundingClientRect();
        const textRect = toggle.find(datatest('piece-queue-infinite-text'))[0].getBoundingClientRect();
        expect(checkboxRect.left).to.be.at.least(toggleRect.left);
        expect(textRect.right).to.be.at.most(toggleRect.right);
        expect(toggle[0].scrollWidth).to.be.at.most(Math.ceil(toggleRect.width));
    });
};

describe('Editor UI final concept', () => {
    beforeEach(() => cy.clearLocalStorage());

    [
        [320, 568, '1'],
        [375, 667, '1'],
        [390, 844, '1'],
        [844, 390, '2'],
    ].forEach(([width, height, railColumns]) => {
        it(`keeps the rail usable at ${width}x${height}`, () => {
            cy.viewport(width, height);
            visit({ mode: 'edit' });

            cy.get(datatest('editor-rail'))
                .should('be.visible')
                .and('have.attr', 'data-columns', railColumns);
            cy.get(`${datatest('editor-field-frame')},${datatest('editor-rail')}`).then(elements => {
                const field = elements.filter(datatest('editor-field-frame'))[0].getBoundingClientRect();
                const rail = elements.filter(datatest('editor-rail'))[0].getBoundingClientRect();
                expect(Math.abs(field.top - rail.top)).to.be.lessThan(1);
                expect(Math.abs(field.bottom - rail.bottom)).to.be.lessThan(1);
            });
            assertRailOrder();
            assertRailArrangement();
            if (width === 390 && height === 844) {
                cy.get(datatest('tray-context')).should('not.have.class', 'editor-context-tray--compact');
            }
            ['btn-paint-mode', 'btn-piece-mode', 'btn-select-mode'].forEach(selector => {
                cy.get(datatest(selector)).should('have.attr', 'aria-label').and('not.be.empty');
            });
            cy.get(datatest('btn-editor-import')).find('.material-icons').should('contain.text', 'file_download');
            cy.get(datatest('btn-editor-export')).find('.material-icons').should('contain.text', 'file_upload');
            cy.get([
                datatest('tools'),
                datatest('btn-editor-user-settings'),
                datatest('btn-open-menu'),
            ].join(',')).then(elements => {
                const tools = elements.filter(datatest('tools'))[0].getBoundingClientRect();
                const settings = elements.filter(datatest('btn-editor-user-settings'))[0].getBoundingClientRect();
                const menu = elements.filter(datatest('btn-open-menu'))[0].getBoundingClientRect();
                expect(settings.right).to.be.closeTo(menu.left, 1);
                expect(menu.right).to.be.closeTo(tools.right - 3, 1);
            });
            ['i', 'l', 'o', 'z', 't', 'j', 's', 'empty', 'gray', 'inference'].forEach(piece => {
                cy.get(datatest(`btn-piece-${piece}`)).should('be.visible');
            });
        });
    });

    [
        // 幅, 高さ, mobile, トレイ最小高, レール列数, NEXTミノ最小高, パレットにラベルが出るか
        [320, 568, true, 78, '1', 20, false],
        [375, 667, true, 78, '1', 20, true],
        [390, 844, true, 78, '1', 40, true],
        [844, 390, true, 44, '2', 20, false],
        [1024, 768, false, 66, '1', 40, true],
        [1920, 1080, false, 78, '1', 40, true],
    ].forEach(([width, height, mobile, minimumTrayHeight, paletteColumns, minimumNextMinoHeight]) => {
        it(`keeps the PIECE tray above the bottom bar at ${width}x${height}`, () => {
            cy.viewport(width, height);
            visit({ mode: 'edit', mobile });
            cy.get(datatest('btn-piece-mode')).click();

            // 選択重視（初期レイアウト）はPAINT/SELECTと同じボタン群を並べる
            cy.get(datatest('editor-rail')).should('have.attr', 'data-piece-layout', 'select');
            cy.get(datatest('editor-rail')).should('have.attr', 'data-columns', paletteColumns);
            if (paletteColumns === '1') {
                assertPieceRailSingleColumn();
                cy.get(datatest('btn-piece-gray')).should('contain.text', 'RESPAWN');
                cy.get(datatest('btn-piece-palette-spacer')).should('be.visible');
            } else {
                assertPieceRailTwoColumns();
            }
            assertPieceNormalModeRows();
            ['btn-editor-import', 'btn-editor-export', 'btn-insert-new-page', 'btn-utils-mode',
                'btn-cold-clear', 'btn-piece-layout'].forEach(selector => {
                cy.get(datatest(selector)).should('be.visible');
            });
            ['btn-piece-inference', 'btn-piece-reset'].forEach(selector => {
                cy.get(datatest(selector)).should('not.exist');
            });
            ['piece-queue-hold', 'piece-queue-next', 'piece-queue-infinite'].forEach(selector => {
                cy.get(datatest(selector)).should('not.exist');
            });

            // 操作重視はキュー枠を出し、ミノパレットを畳む
            operations.mode.piece.layout('play');
            cy.get(datatest('editor-rail')).should('have.attr', 'data-piece-layout', 'play');
            cy.get(datatest('piece-queue-infinite-checkbox')).should('be.visible');
            assertInfiniteToggleFits();
            assertPlayRailArrangement();
            ['btn-insert-new-page', 'btn-insert-from-clipboard', 'btn-copy-to-clipboard', 'btn-cut-page',
                'btn-editor-import', 'btn-editor-export', 'btn-utils-mode', 'btn-flags-mode',
                'btn-piece-inference', 'btn-piece-i', 'btn-piece-t',
                'btn-piece-empty', 'btn-piece-gray'].forEach(selector => {
                cy.get(datatest(selector)).should('not.exist');
            });
            cy.get(datatest('btn-editor-user-settings')).should('be.visible');
            cy.get([
                datatest('piece-queue-hold'),
                datatest('piece-queue-next'),
                datatest('editor-field-frame'),
                datatest('editor-rail'),
            ].join(',')).each(element => {
                const rect = element[0].getBoundingClientRect();
                expect(rect.left).to.be.at.least(0);
                expect(rect.right).to.be.at.most(width);
            });
            cy.get(`${datatest('editor-field-frame')},${datatest('piece-queue-hold')},`
                + `${datatest('piece-queue-next')}`).then(elements => {
                const field = elements.filter(datatest('editor-field-frame'))[0].getBoundingClientRect();
                [datatest('piece-queue-hold'), datatest('piece-queue-next')].forEach(selector => {
                    const column = elements.filter(selector)[0].getBoundingClientRect();
                    expect(column.width).to.be.at.least(66);
                    expect(column.width / field.width).to.be.at.least(0.28);
                });
            });
            cy.get(datatest('piece-queue-next-0')).then(nextRow => {
                expect(nextRow[0].getBoundingClientRect().height).to.be.at.least(minimumNextMinoHeight);
            });
            cy.get(datatest('tray-context')).then(tray => {
                expect(tray[0].getBoundingClientRect().height).to.be.at.least(minimumTrayHeight);
                cy.get(datatest('tools')).then(tools => {
                    expect(tray[0].getBoundingClientRect().bottom)
                        .to.be.at.most(tools[0].getBoundingClientRect().top);
                });
            });
            cy.get(`${datatest('editor-rail')},${datatest('tools')}`).then(elements => {
                const rail = elements.filter(datatest('editor-rail'))[0].getBoundingClientRect();
                const tools = elements.filter(datatest('tools'))[0].getBoundingClientRect();
                expect(rail.bottom).to.be.at.most(tools.top + 1);
            });
        });
    });

    it('aligns HOLD and NEXT with the 20-row ceiling', () => {
        cy.viewport(1024, 768);
        visit({ mode: 'edit', mobile: false });
        operations.mode.piece.openWithQueues();

        cy.get([
            datatest('editor-field-frame'),
            datatest('piece-queue-hold'),
            datatest('piece-queue-next'),
        ].join(',')).then(elements => {
            const rect = selector => elements.filter(datatest(selector))[0].getBoundingClientRect();
            const field = rect('editor-field-frame');
            const hold = rect('piece-queue-hold');
            const next = rect('piece-queue-next');
            const ceiling = field.top + ((field.height - 4.4) / 23.5) * 2.5 + 1;
            expect(hold.top).to.be.closeTo(ceiling, 2);
            expect(next.top).to.be.closeTo(ceiling, 2);
            expect(hold.top).to.be.closeTo(next.top, 1);
        });
    });

    it('keeps the field size stable across primary tools on a height-constrained desktop viewport', () => {
        cy.viewport(1024, 768);
        visit({ mode: 'edit', mobile: false });

        cy.get(datatest('editor-field-frame')).then(paintField => {
            const paint = paintField[0].getBoundingClientRect();
            cy.get(datatest('btn-piece-mode')).click();
            cy.get(datatest('editor-field-frame')).then(pieceField => {
                const piece = pieceField[0].getBoundingClientRect();
                ['width', 'height', 'top'].forEach(dimension => {
                    expect(piece[dimension]).to.be.closeTo(paint[dimension], 1);
                });
                cy.get(datatest('btn-select-mode')).click();
                cy.get(datatest('editor-field-frame')).then(selectField => {
                    const select = selectField[0].getBoundingClientRect();
                    ['width', 'height', 'top'].forEach(dimension => {
                        expect(select[dimension]).to.be.closeTo(paint[dimension], 1);
                    });
                });
            });
        });
    });

    it('keeps the production field size and text labels on a phone display', () => {
        cy.viewport(412, 844);
        visit({ mode: 'edit', flagsHidden: false });

        cy.get(datatest('editor-field-frame')).then(field => {
            expect(field[0].getBoundingClientRect().width).to.be.closeTo(307.66, 1);
        });
        [
            ['btn-insert-new-page', 'Add'],
            ['btn-insert-from-clipboard', 'Insert'],
            ['btn-copy-to-clipboard', 'Copy'],
            ['btn-cut-page', 'Cut'],
            ['btn-utils-mode', 'U'],
            ['btn-flags-mode', 'F'],
            ['btn-piece-mode', 'PIECE'],
            ['btn-piece-layout', 'INPUT'],
            ['btn-cold-clear', 'AI'],
            ['btn-select-mode', 'SELECT'],
            ['btn-paint-mode', 'PAINT'],
        ].forEach(([selector, label]) => {
            cy.get(datatest(selector)).should('contain.text', label);
        });
        // INPUTはキーボードアイコンとラベルを縦に積み、分割セルからはみ出さない
        cy.get(`${datatest('btn-piece-layout')} .material-icons`).should('have.text', 'keyboard');
        cy.get(datatest('btn-piece-layout')).then(([cell]) => {
            const content = cell.firstElementChild.getBoundingClientRect();
            const button = cell.getBoundingClientRect();
            expect(content.height).to.be.at.most(button.height);
            expect(content.width).to.be.at.most(button.width);
        });
    });

    it('shows SELECT and keeps spawn actions from appearing selected', () => {
        cy.viewport(1000, 800);
        visit({ mode: 'edit' });

        cy.get(datatest('btn-select-mode')).should('contain.text', 'SELECT');
        cy.get(datatest('btn-piece-mode')).click();
        cy.get(datatest('btn-piece-gray'))
            .should('have.attr', 'aria-label', 'RESPAWN')
            .and('have.attr', 'data-active', 'false');
        cy.get(datatest('btn-piece-empty')).should('have.attr', 'data-active', 'false');

        cy.get(datatest('btn-piece-gray')).click().should('have.attr', 'data-active', 'false');
        cy.get(datatest('btn-piece-empty')).click().should('have.attr', 'data-active', 'false');
    });

    it('distinguishes paint swatches from piece images and keeps select unchanged', () => {
        visit({ mode: 'edit' });

        const paletteFrames = `${datatest('editor-rail')} [datatest^="btn-piece-"]`
            + `:not(${datatest('btn-piece-mode')}):not(${datatest('btn-piece-layout')})`;
        cy.get(paletteFrames).should('have.length', 10);

        cy.get(datatest('btn-paint-mode'))
            .should('have.css', 'background-color', 'rgb(232, 241, 251)')
            .and('have.css', 'color', 'rgb(21, 101, 192)');
        cy.get(datatest('btn-piece-i'))
            .find('[data-palette-swatch="mino"]')
            .should('have.text', 'I');
        cy.get(datatest('btn-piece-i')).find('img').should('not.exist');
        cy.get(datatest('btn-piece-empty'))
            .find('[data-palette-swatch="empty"]')
            .should('have.text', '');
        cy.get(datatest('btn-piece-gray'))
            .find('[data-palette-swatch="gray"]')
            .should('have.text', '');
        cy.get(datatest('btn-piece-inference'))
            .find('[data-palette-swatch="comp"]')
            .should('contain', 'COMP');
        cy.get(datatest('btn-piece-inference'))
            .should('have.attr', 'aria-pressed', 'true')
            .and('have.css', 'box-shadow')
            .and('include', 'rgb(25, 118, 210)');

        cy.get(datatest('btn-piece-mode')).click();
        // PIECE通常は9機能セル＋空きセルの10個
        cy.get(paletteFrames).should('have.length', 10);
        cy.get(datatest('btn-piece-inference')).should('not.exist');
        cy.get(datatest('btn-piece-reset')).should('not.exist');
        cy.get(datatest('btn-piece-palette-spacer'))
            .should('be.visible')
            .and('have.attr', 'aria-hidden', 'true')
            .click({ force: true });
        cy.get(datatest('btn-piece-mode')).should('have.attr', 'aria-pressed', 'true');
        cy.get(datatest('btn-piece-i')).find('img').should('exist');

        cy.get(datatest('btn-select-mode')).click();
        cy.get(datatest('btn-piece-i')).find('img').should('not.exist');
        cy.get(datatest('btn-piece-i'))
            .find('[data-palette-swatch]')
            .should('not.exist');

        cy.get(datatest('btn-piece-i')).click()
            .should('have.css', 'background-color', 'rgb(244, 248, 253)')
            .and('have.css', 'color', 'rgb(51, 51, 51)');
    });

    it('replaces only the PAINT mino swatches when the mino design is enabled', () => {
        cy.clearLocalStorage();
        visit({ mode: 'edit' });
        operations.menu.setPaintPaletteMinoDesign(true);

        const minos = ['i', 'l', 'o', 'z', 't', 'j', 's'];
        minos.forEach((name) => {
            cy.get(datatest(`btn-piece-${name}`))
                .find('[data-palette-swatch="mino-image"]')
                .should('have.attr', 'alt', name.toUpperCase());
        });
        cy.get(datatest('btn-piece-i')).find('[data-palette-swatch="mino"]').should('not.exist');

        // Non-mino cells keep their current design.
        cy.get(datatest('btn-piece-empty')).find('[data-palette-swatch="empty"]').should('exist');
        cy.get(datatest('btn-piece-gray')).find('[data-palette-swatch="gray"]').should('exist');
        cy.get(datatest('btn-piece-inference')).find('[data-palette-swatch="comp"]').should('contain', 'COMP');

        // The image stays inside its cell.
        cy.get(datatest('btn-piece-i')).then((cell) => {
            const cellRect = cell[0].getBoundingClientRect();
            cy.get(datatest('btn-piece-i')).find('img').then((image) => {
                const imageRect = image[0].getBoundingClientRect();
                expect(imageRect.width).to.be.lessThan(cellRect.width + 1);
                expect(imageRect.height).to.be.lessThan(cellRect.height + 1);
            });
        });

        // Behaviour is unchanged: the cell still selects the I piece and draws it.
        cy.get(datatest('btn-piece-i')).click().should('have.attr', 'aria-pressed', 'true');
        cy.get(datatest('btn-piece-i')).should('have.attr', 'aria-label', 'I');
        operations.mode.block.click(1, 1);
        cy.get(block(1, 1)).should('have.attr', 'color', Color.I.Normal);

        // SELECT and PIECE palettes are untouched by the setting.
        cy.get(datatest('btn-select-mode')).click();
        cy.get(datatest('btn-piece-i')).find('[data-palette-swatch]').should('not.exist');
        cy.get(datatest('btn-piece-mode')).click();
        cy.get(datatest('btn-piece-i')).find('img').should('exist');
        cy.get(datatest('btn-piece-i')).find('[data-palette-swatch="mino-image"]').should('not.exist');
    });

    it('fits the PAINT mino images inside a two-column rail', () => {
        cy.viewport(844, 390);
        cy.clearLocalStorage();
        visit({ mode: 'edit' });
        operations.menu.setPaintPaletteMinoDesign(true);

        cy.get(datatest('editor-rail')).should('have.attr', 'data-columns', '2');
        cy.get(datatest('btn-piece-i')).then((cell) => {
            const cellRect = cell[0].getBoundingClientRect();
            cy.get(datatest('btn-piece-i')).find('img').then((image) => {
                const imageRect = image[0].getBoundingClientRect();
                expect(imageRect.width).to.be.greaterThan(0);
                expect(imageRect.width).to.be.lessThan(cellRect.width + 1);
                expect(imageRect.height).to.be.lessThan(cellRect.height + 1);
            });
        });
    });

    it('opens the PIECE tray instead of settings on a phone tap', () => {
        cy.viewport(375, 667);
        visit({ mode: 'edit' });

        cy.get(datatest('btn-piece-mode')).click();

        cy.get(datatest('btn-piece-mode')).should('have.attr', 'aria-pressed', 'true');
        cy.get(datatest('tray-piece-grid')).should('be.visible');
        cy.get(datatest('mdl-user-settings')).should('not.exist');
    });

    it('keeps the PAINT tray hidden when selecting another palette entry', () => {
        visit({ mode: 'edit' });

        cy.get(datatest('btn-paint-mode')).click();
        cy.get(datatest('tray-context')).should('not.exist');
        cy.get(datatest('btn-piece-t')).click();
        cy.get(datatest('tray-context')).should('not.exist');
    });

    it('keeps transformed select previews at normal brightness', () => {
        visit({ mode: 'edit' });

        cy.get(datatest('btn-piece-t')).click();
        operations.mode.block.click(1, 1);
        operations.mode.block.click(2, 1);
        cy.get(datatest('btn-select-mode')).click();
        operations.mode.block.drag({ x: 1, y: 1 }, { x: 2, y: 1 });

        cy.get(datatest('tray-select-rotate-left')).click();
        cy.get(block(1, 1)).should('have.attr', 'color', Color.T.Normal);
        cy.get(block(1, 2)).should('have.attr', 'color', Color.T.Normal);

        cy.get(datatest('tray-select-mirror')).click();
        cy.get(block(1, 1)).should('have.attr', 'color', Color.T.Normal);
        cy.get(block(1, 2)).should('have.attr', 'color', Color.T.Normal);
    });

    it('removes the bottom-bar home button while keeping the paint entry point', () => {
        visit({ mode: 'edit' });

        cy.get(datatest('btn-drawing-tool')).should('not.exist');
        cy.get(datatest('btn-paint-mode')).should('be.visible');
        cy.get(datatest('btn-piece-mode')).click();
        cy.get(datatest('btn-paint-mode')).click();
        cy.get(datatest('tray-paint-pen')).should('be.visible');
    });

    it('preserves the active tool while opening and closing inspectors', () => {
        visit({ mode: 'edit', flagsHidden: false });
        cy.get(datatest('btn-paint-mode')).should('have.attr', 'aria-pressed', 'true');

        cy.get(datatest('btn-utils-mode')).click();
        cy.get(datatest('overlay-utils')).should('be.visible');
        cy.get(datatest('btn-paint-mode')).should('have.attr', 'aria-pressed', 'true');
        cy.get(datatest('btn-inspector-close')).click();
        cy.get(datatest('btn-paint-mode')).should('have.attr', 'aria-pressed', 'true');
        cy.get(datatest('btn-utils-mode')).should('be.focused');

        cy.get(datatest('btn-flags-mode')).click();
        cy.get(datatest('overlay-flags')).should('be.visible');
        cy.get('body').type('{esc}');
        cy.get(datatest('overlay-flags')).should('not.exist');
        cy.get(datatest('btn-paint-mode')).should('have.attr', 'aria-pressed', 'true');
    });

    it('drags inspectors by their heading and shows flag checkboxes', () => {
        visit({ mode: 'edit', flagsHidden: false });

        cy.get(datatest('btn-utils-mode')).click();
        let beforeLeft;
        cy.get(datatest('overlay-utils')).then($overlay => {
            beforeLeft = $overlay[0].getBoundingClientRect().left;
            cy.get(datatest('overlay-heading')).then($heading => {
                const rect = $heading[0].getBoundingClientRect();
                const startX = rect.left + 20;
                const startY = rect.top + rect.height / 2;
                cy.get(datatest('overlay-heading')).trigger('pointerdown', {
                    button: 0, clientX: startX, clientY: startY, pointerId: 1, pointerType: 'mouse',
                });
                cy.document().trigger('pointermove', {
                    clientX: startX - 40, clientY: startY + 20, pointerId: 1, pointerType: 'mouse',
                });
                cy.document().trigger('pointerup', { clientX: startX - 40, clientY: startY + 20, pointerId: 1 });
            });
        });
        cy.get(datatest('overlay-utils')).then($overlay => {
            expect($overlay[0].getBoundingClientRect().left).to.be.lessThan(beforeLeft);
        });

        cy.get(datatest('overlay-utils')).find(datatest('btn-inspector-close')).click();
        cy.get(datatest('btn-flags-mode')).click();
        cy.get(datatest('overlay-flags')).find('button').not(datatest('btn-inspector-close')).each($button => {
            cy.wrap($button).find('[datatest$="-checkbox"]').should('have.length', 1);
        });
    });

    it('toggles the PAINT tray and keeps PIECE as a direct mode entry', () => {
        cy.viewport(320, 568);
        visit({ mode: 'edit' });

        // Default: paint mode active, context tray and the independent comment row are visible.
        cy.get(datatest('btn-paint-mode')).should('have.attr', 'aria-pressed', 'true');
        cy.get(datatest('tray-context')).should('be.visible');
        cy.get(datatest('tray-context')).should('have.class', 'editor-context-tray--compact');
        cy.get(datatest('text-comment')).should('be.visible');
        cy.get(datatest('field-bottom-tray')).then(tray => {
            const trayRect = tray[0].getBoundingClientRect();
            cy.get(datatest('editor-field-frame')).then(field => {
                const fieldRect = field[0].getBoundingClientRect();
                expect(Math.abs(fieldRect.bottom - trayRect.bottom)).to.be.at.most(3);
            });
        });

        // Pressing the already-active mode button again hides the tray (the rising row is shown instead).
        cy.get(datatest('btn-paint-mode')).click();
        cy.get(datatest('tray-context')).should('not.exist');
        cy.get(datatest('text-comment')).should('be.visible');

        // Selecting a different tool brings the tray back.
        cy.get(datatest('btn-piece-mode')).click();
        cy.get(datatest('tray-context')).should('be.visible');

        // PIECE is a direct entry: selecting it again keeps the normal PIECE layout open.
        cy.get(datatest('btn-piece-mode')).click();
        cy.get(datatest('btn-paint-mode')).should('have.attr', 'aria-pressed', 'false');
        cy.get(datatest('btn-piece-mode')).should('have.attr', 'aria-pressed', 'true');
        cy.get(datatest('tray-context')).should('be.visible');

        // PAINT is the explicit exit from PIECE/Play.
        cy.get(datatest('btn-paint-mode')).click();
        cy.get(datatest('btn-paint-mode')).should('have.attr', 'aria-pressed', 'true');
        cy.get(datatest('tray-context')).should('be.visible');
    });

    it('keeps PAINT and SELECT at one tray layout without covering COMP', () => {
        cy.viewport(320, 568);
        visit({ mode: 'edit' });

        const readGeometry = () => cy.get(`${datatest('editor-field-frame')},${datatest('editor-rail')}`)
            .then(elements => {
                const rect = selector => elements.filter(datatest(selector))[0].getBoundingClientRect();
                const copyRect = value => ({ bottom: value.bottom, height: value.height,
                    left: value.left, right: value.right, top: value.top, width: value.width });
                return { field: copyRect(rect('editor-field-frame')), rail: copyRect(rect('editor-rail')) };
            });
        const assertSameGeometry = (expected, actual) => {
            ['field', 'rail'].forEach(area => {
                ['bottom', 'height', 'left', 'right', 'top', 'width'].forEach(property => {
                    expect(actual[area][property]).to.be.closeTo(expected[area][property], 0.5);
                });
            });
        };
        const assertCommentDoesNotCoverComp = () => cy.get(`${datatest('text-comment')},${datatest('btn-piece-inference')}`)
            .then(elements => {
                const comment = elements.filter(datatest('text-comment'))[0].getBoundingClientRect();
                const compElement = elements.filter(datatest('btn-piece-inference'))[0];
                const comp = compElement.getBoundingClientRect();
                expect(comp.bottom).to.be.at.most(comment.top);
                // Cypress runs the spec in a separate document from the app under test.
                // Hit-test the AUT document so this checks the actual COMP button layer.
                const hit = compElement.ownerDocument.elementFromPoint(
                    comp.left + comp.width / 2, comp.bottom - 1,
                );
                expect(hit === compElement || compElement.contains(hit)).to.equal(true);
            });
        const assertCommentIsBelowTray = () => cy.get(`${datatest('text-comment')},${datatest('field-bottom-tray')}`)
            .then(elements => {
                const comment = elements.filter(datatest('text-comment'))[0].getBoundingClientRect();
                const tray = elements.filter(datatest('field-bottom-tray'))[0].getBoundingClientRect();
                expect(comment.top).to.be.at.least(tray.bottom - 1);
            });

        let trayGeometry;
        readGeometry().then(geometry => {
            trayGeometry = geometry;
        });
        cy.get(datatest('text-comment')).should('be.visible');
        assertCommentDoesNotCoverComp();
        assertCommentIsBelowTray();
        cy.get(datatest('btn-paint-mode')).click();
        cy.get(datatest('text-comment')).should('be.visible');
        readGeometry().then(geometry => {
            assertSameGeometry(trayGeometry, geometry);
        });
        assertCommentDoesNotCoverComp();

        cy.get(datatest('btn-select-mode')).click();
        cy.get(datatest('tray-context')).should('be.visible');
        cy.get(datatest('text-comment')).should('be.visible');
        readGeometry().then(geometry => {
            assertSameGeometry(trayGeometry, geometry);
        });
        assertCommentDoesNotCoverComp();
        assertCommentIsBelowTray();
        cy.get(datatest('btn-select-mode')).click();
        cy.get(datatest('text-comment')).should('be.visible');
        readGeometry().then(geometry => {
            assertSameGeometry(trayGeometry, geometry);
        });
        assertCommentDoesNotCoverComp();
    });

    it('spawns from PIECE palette clicks and keeps PIECE active for reset/delete', () => {
        visit({ mode: 'edit' });
        cy.get(datatest('btn-piece-mode')).click();
        cy.get(datatest('btn-piece-t')).find('img').should('exist');
        cy.get(datatest('btn-piece-empty')).find('img').should('not.exist');
        cy.get(datatest('btn-piece-t')).click();
        cy.get(datatest('btn-piece-mode')).should('have.attr', 'aria-pressed', 'true');
        cy.get(datatest('tray-piece-harddrop')).should('not.be.disabled');
        mino(Piece.T, Rotation.Spawn)(4, 20).forEach(selector => {
            cy.get(selector).should('have.attr', 'color', Color.T.Highlight2);
        });

        cy.get(datatest('btn-piece-empty')).click();
        cy.get(datatest('btn-piece-mode')).should('have.attr', 'aria-pressed', 'true');
        cy.get(datatest('tray-piece-harddrop')).should('be.disabled');
        cy.get(datatest('btn-piece-gray')).click();
        cy.get(datatest('tray-piece-harddrop')).should('not.be.disabled');
        mino(Piece.T, Rotation.Spawn)(4, 20).forEach(selector => {
            cy.get(selector).should('have.attr', 'color', Color.T.Highlight2);
        });
    });

    it('drags the spawn mino from PAINT without painting over it', () => {
        visit({ mode: 'edit' });
        operations.mode.piece.open();
        operations.mode.piece.spawn.T();
        operations.mode.tools.home();
        operations.mode.block.I();

        operations.mode.block.click(4, 20);

        cy.get(datatest('btn-paint-mode')).should('have.attr', 'aria-pressed', 'true');
        mino(Piece.T, Rotation.Spawn)(4, 20).forEach(selector => {
            cy.get(selector).should('have.attr', 'color', Color.T.Highlight2);
        });
    });

    it('restores the previous PAINT color after switching from eraser to pen', () => {
        visit({ mode: 'edit' });
        cy.get(datatest('btn-piece-i')).click();
        cy.get(datatest('tray-paint-erase')).click();
        cy.get(datatest('tray-paint-pen')).click();

        cy.get(datatest('btn-piece-i')).should('have.attr', 'aria-pressed', 'true');
    });

    it('deletes the spawn mino when PAINT eraser is used on it', () => {
        visit({ mode: 'edit' });
        operations.mode.piece.open();
        operations.mode.piece.spawn.T();
        operations.mode.tools.home();
        cy.get(datatest('btn-piece-empty')).click();
        cy.get(datatest('tray-paint-erase')).should('have.attr', 'aria-pressed', 'true');

        operations.mode.block.click(4, 20);

        mino(Piece.T, Rotation.Spawn)(4, 20).forEach(selector => {
            cy.get(selector).should('not.have.attr', 'color', Color.T.Highlight2);
        });
    });

    it('deletes the spawn mino when PAINT eraser drag reaches it', () => {
        visit({ mode: 'edit' });
        operations.mode.piece.open();
        operations.mode.piece.spawn.T();
        operations.mode.tools.home();
        cy.get(datatest('btn-piece-empty')).click();

        operations.mode.block.drag({ x: 0, y: 0 }, { x: 4, y: 20 });

        mino(Piece.T, Rotation.Spawn)(4, 20).forEach(selector => {
            cy.get(selector).should('not.have.attr', 'color', Color.T.Highlight2);
        });
    });

    it('deletes the spawn mino when empty fill drag reaches it', () => {
        visit({ mode: 'edit' });
        operations.mode.piece.open();
        operations.mode.piece.spawn.T();
        operations.mode.fill.open();
        cy.get(datatest('btn-piece-empty')).click();

        operations.mode.block.drag({ x: 0, y: 0 }, { x: 4, y: 20 });

        mino(Piece.T, Rotation.Spawn)(4, 20).forEach(selector => {
            cy.get(selector).should('not.have.attr', 'color', Color.T.Highlight2);
        });
    });

    it('selects, copies, and spawns a rectangular part from a paint slot', () => {
        visit({ mode: 'edit' });
        cy.get(datatest('btn-piece-t')).click();
        operations.mode.block.click(1, 1);
        operations.mode.block.click(2, 1);

        cy.get(datatest('btn-select-mode')).click();
        operations.mode.block.drag({ x: 1, y: 1 }, { x: 2, y: 1 });
        cy.get(datatest('tray-selection-summary')).should('contain', '2×1');
        cy.get(datatest('tray-select-copy')).click();
        cy.get('[datatest^="tray-part-"]').should('not.exist');
        cy.get(datatest('btn-piece-i-pin'))
            .should('have.css', 'color', 'rgb(117, 117, 117)')
            .and('have.css', 'opacity', '0.45')
            .and('have.css', 'border-top-width', '0px');
        cy.get(datatest('btn-piece-i-pin')).click();
        cy.get(datatest('btn-piece-gray-pin')).should('have.attr', 'aria-label', 'Unpin');
        cy.get(datatest('tray-select-part-pin')).should('not.exist');
        cy.get(datatest('tray-select-rotate-left')).should('be.visible');
        cy.get(datatest('tray-select-rotate-right')).should('be.visible');
        cy.get(datatest('btn-piece-inference')).click();
        cy.get(datatest('btn-piece-inference')).should('have.attr', 'aria-pressed', 'false');
        cy.get(datatest('btn-piece-gray')).click();
        // 占有列(x=4..5)は空なので、着地面 y=0 の3マス上に出る。
        cy.get(block(4, 3)).should('have.attr', 'color', Color.T.Normal);
        cy.get(datatest('btn-piece-gray')).click();
        cy.get(block(4, 3)).should('have.attr', 'color', Color.T.Normal);
        // プレビュー内から掴んで運ぶ。掴んだセルとパーツのセルの相対位置は保たれる。
        operations.mode.block.drag({ x: 4, y: 3 }, { x: 5, y: 5 });
        cy.get(block(5, 5)).should('have.attr', 'color', Color.T.Normal);
        // 移動したプレビューは「外側クリック」で初めてフィールドへ確定される仕様のため、
        // 範囲外をクリックしてコミットしてから undo で取り消せることを確認する。
        operations.mode.block.click(0, 10);
        cy.get('[datatest^="tray-part-"]').should('not.exist');
        cy.get(block(5, 5)).should('have.attr', 'color', Color.T.Normal);
        cy.get(block(6, 5)).should('have.attr', 'color', Color.T.Normal);
        cy.get(datatest('btn-undo')).click();
        cy.get(block(5, 5)).should('not.have.attr', 'color', Color.T.Normal);
        cy.get(block(6, 5)).should('not.have.attr', 'color', Color.T.Normal);
    });

    it('keeps the grabbed cell of a SELECT part under the pointer', () => {
        visit({ mode: 'edit' });
        cy.get(datatest('btn-piece-t')).click();
        operations.mode.block.click(1, 1);
        cy.get(datatest('btn-piece-l')).click();
        operations.mode.block.click(2, 1);
        cy.get(datatest('btn-piece-i')).click();
        operations.mode.block.click(1, 2);
        cy.get(datatest('btn-piece-z')).click();
        operations.mode.block.click(2, 2);

        cy.get(datatest('btn-select-mode')).click();
        operations.mode.block.drag({ x: 1, y: 1 }, { x: 2, y: 2 });
        cy.get(datatest('tray-selection-summary')).should('contain', '2×2');
        cy.get(datatest('tray-select-copy')).click();
        cy.get(datatest('btn-piece-i')).click();
        // 2×2 のパーツは占有列(x=4..5)の着地面 y=0 の3マス上、x=4..5, y=3..4 に表示される。
        cy.get(block(4, 3)).should('have.attr', 'color', Color.T.Normal);
        cy.get(block(5, 4)).should('have.attr', 'color', Color.Z.Normal);

        // 画面上の右上セル（配列では x=5, y=4）を掴んで運ぶ。
        operations.mode.block.drag({ x: 5, y: 4 }, { x: 7, y: 10 });

        cy.get(block(6, 9)).should('have.attr', 'color', Color.T.Normal);
        cy.get(block(7, 9)).should('have.attr', 'color', Color.L.Normal);
        cy.get(block(6, 10)).should('have.attr', 'color', Color.I.Normal);
        cy.get(block(7, 10)).should('have.attr', 'color', Color.Z.Normal);
        // 旧実装では掴んだセルが左下へ寄り、パーツはここに現れていた。
        cy.get(block(8, 11)).should('not.have.attr', 'color', Color.Z.Normal);
        cy.get(block(7, 11)).should('not.have.attr', 'color', Color.T.Normal);

        operations.mode.block.click(0, 0);
        cy.get(block(6, 9)).should('have.attr', 'color', Color.T.Normal);
        cy.get(block(7, 10)).should('have.attr', 'color', Color.Z.Normal);
    });

    it('settles a SELECT part in place when the first tap starts outside the preview', () => {
        visit({ mode: 'edit' });
        cy.get(datatest('btn-piece-t')).click();
        operations.mode.block.click(1, 1);

        cy.get(datatest('btn-select-mode')).click();
        operations.mode.block.drag({ x: 1, y: 1 }, { x: 1, y: 1 });
        cy.get(datatest('tray-select-copy')).click();
        cy.get(datatest('btn-piece-i')).click();
        cy.get(block(4, 3)).should('have.attr', 'color', Color.T.Normal);

        // プレビュー外の初回タップは現在位置で確定し、同じタッチで矩形選択を始める。
        operations.mode.block.drag({ x: 3, y: 5 }, { x: 5, y: 7 });

        cy.get(block(4, 3)).should('have.attr', 'color', Color.T.Normal);
        cy.get(block(3, 5)).should('not.have.attr', 'color', Color.T.Normal);
        cy.get(datatest('tray-selection-summary')).should('contain', '3×3');

        cy.get(datatest('btn-undo')).click();
        cy.get(block(4, 3)).should('not.have.attr', 'color', Color.T.Normal);
    });

    it('spawns a SELECT part three rows above the landing surface', () => {
        visit({ mode: 'edit' });
        cy.get(datatest('btn-piece-t')).click();
        operations.mode.block.click(1, 1);

        cy.get(datatest('btn-select-mode')).click();
        operations.mode.block.drag({ x: 1, y: 1 }, { x: 1, y: 1 });
        cy.get(datatest('tray-select-copy')).click();
        cy.get(datatest('btn-piece-i')).click();
        // 1×1 のパーツの占有列は x=4。空なので着地面 y=0 の3マス上に出る。
        cy.get(block(4, 3)).should('have.attr', 'color', Color.T.Normal);

        // 占有列に3段、占有列の外(x=0)にはより高い地形を作る。
        cy.get(datatest('btn-paint-mode')).click();
        cy.get(datatest('btn-piece-gray')).click();
        operations.mode.block.dragToUp(4, { from: 0, to: 2 });
        operations.mode.block.dragToUp(0, { from: 0, to: 8 });

        cy.get(datatest('btn-select-mode')).click();
        cy.get(datatest('btn-piece-i')).click();
        // 着地面 y=3 の3マス上。占有列の外の高さは影響しない。
        cy.get(block(4, 6)).should('have.attr', 'color', Color.T.Normal);
        cy.get(block(4, 2)).should('have.attr', 'color', Color.Gray.Normal);

        // 天井付近では従来と同じ最上段に収まる。
        cy.get(datatest('btn-paint-mode')).click();
        cy.get(datatest('btn-piece-gray')).click();
        operations.mode.block.dragToUp(4, { from: 3, to: 21 });

        cy.get(datatest('btn-select-mode')).click();
        cy.get(datatest('btn-piece-i')).click();
        cy.get(block(4, 22)).should('have.attr', 'color', Color.T.Normal);
    });

    it('uses SELECT stock long press to toggle clipping without changing transparency', () => {
        visit({ mode: 'edit' });
        cy.get(datatest('btn-piece-t')).click();
        operations.mode.block.click(1, 1);

        cy.get(datatest('btn-select-mode')).click();
        operations.mode.block.drag({ x: 1, y: 1 }, { x: 1, y: 1 });
        cy.get(datatest('tray-select-copy')).click();
        cy.get(datatest('btn-piece-inference')).should('have.attr', 'data-active', 'true');
        cy.get(datatest('btn-piece-i-pin')).should('have.attr', 'aria-label', 'Pin');

        cy.get(datatest('btn-piece-i')).trigger('pointerdown', { pointerId: 1, button: 0 });
        cy.wait(600);
        cy.get(datatest('btn-piece-i')).trigger('pointerup', { pointerId: 1, button: 0 });

        cy.get(datatest('btn-piece-gray-pin')).should('have.attr', 'aria-label', 'Unpin');
        cy.get(datatest('btn-piece-inference')).should('have.attr', 'data-active', 'true');
        cy.get(datatest('btn-select-mode')).should('have.attr', 'data-active', 'true');
    });

    it('uses the configured DAS for PIECE tray end movement', () => {
        visit({ mode: 'edit' });
        operations.mode.piece.open();
        operations.mode.piece.spawn.T();
        operations.mode.piece.moveToRightEndByTrayLongPress();

        mino(Piece.T, Rotation.Spawn)(8, 20).forEach(selector => {
            cy.get(selector).should('have.attr', 'color', Color.T.Highlight2);
        });
    });

    it('keeps the context tray in the bottom slot on wide PC layouts', () => {
        cy.viewport(1024, 768);
        visit({ mode: 'edit', mobile: false });
        cy.get(datatest('editor-context-inspector')).should('not.exist');

        cy.viewport(1920, 1080);
        cy.reload();
        cy.get(datatest('editor-context-inspector')).should('not.exist');
        cy.get(datatest('tray-context')).should('be.visible');
        cy.get(datatest('tray-context')).should('have.class', 'editor-context-tray');
        cy.get(datatest('tray-context')).then(tray => {
            cy.get(datatest('tools')).then(tools => {
                expect(tray[0].getBoundingClientRect().bottom)
                    .to.be.at.most(tools[0].getBoundingClientRect().top);
            });
        });
        cy.get(datatest('btn-select-mode')).click();
        cy.get(datatest('tray-select-copy')).should('be.visible');
        cy.get(datatest('tray-select-part-pin')).should('not.exist');
    });
});

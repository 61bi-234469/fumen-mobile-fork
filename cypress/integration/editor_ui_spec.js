import { block, Color, datatest, mino, Piece, Rotation, visit } from '../support/common';
import { operations } from '../support/operations';

const assertRailOrder = () => {
    const selectors = [
        'btn-editor-share',
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
    const selectors = ['btn-utils-mode', 'btn-piece-mode', 'btn-cold-clear', 'btn-select-mode', 'btn-paint-mode'];
    cy.get(selectors.map(datatest).join(',')).then(elements => {
        const rect = selector => elements.filter(datatest(selector))[0].getBoundingClientRect();
        const utilities = rect('btn-utils-mode');
        const piece = rect('btn-piece-mode');
        const ai = rect('btn-cold-clear');
        const select = rect('btn-select-mode');
        const paint = rect('btn-paint-mode');
        expect(piece.top - utilities.bottom).to.be.greaterThan(0);
        expect(piece.top - utilities.bottom).to.be.lessThan(10);
        expect(Math.abs(piece.top - ai.top)).to.be.lessThan(1);
        expect(piece.left).to.be.lessThan(ai.left);
        expect(select.top).to.be.lessThan(paint.top);
    });
};

const assertPieceRailSingleColumn = () => {
    const selectors = ['btn-editor-share', 'btn-editor-user-settings', 'btn-piece-mode', 'btn-cold-clear'];
    cy.get(selectors.map(datatest).join(',')).then(elements => {
        const rect = selector => elements.filter(datatest(selector))[0].getBoundingClientRect();
        const cells = selectors.map(rect);
        cells.slice(1).forEach(cell => {
            expect(Math.abs(cell.left - cells[0].left)).to.be.lessThan(1);
            expect(Math.abs(cell.right - cells[0].right)).to.be.lessThan(1);
        });
        expect(rect('btn-editor-share').bottom).to.be.at.most(rect('btn-editor-user-settings').top);
        expect(rect('btn-piece-mode').bottom).to.be.at.most(rect('btn-cold-clear').top);
    });
    cy.get(`${datatest('editor-rail')} button`).then(buttons => {
        const cells = Array.from(buttons).map(button => button.getBoundingClientRect());
        cells.slice(1).forEach(cell => {
            expect(Math.abs(cell.left - cells[0].left)).to.be.lessThan(1);
            expect(Math.abs(cell.right - cells[0].right)).to.be.lessThan(1);
        });
    });
    cy.get(`${datatest('editor-rail')},${datatest('btn-piece-gray')}`).then(elements => {
        const rail = elements.filter(datatest('editor-rail'))[0].getBoundingClientRect();
        const lastCell = elements.filter(datatest('btn-piece-gray'))[0].getBoundingClientRect();
        expect(rail.bottom - lastCell.bottom).to.be.at.least(3);
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
            ['i', 'l', 'o', 'z', 't', 'j', 's', 'empty', 'gray', 'inference'].forEach(piece => {
                cy.get(datatest(`btn-piece-${piece}`)).should('be.visible');
            });
        });
    });

    [
        [320, 568, true],
        [375, 667, true],
        [390, 844, true],
        [844, 390, true],
        [1024, 768, false],
        [1920, 1080, false],
    ].forEach(([width, height, mobile]) => {
        it(`keeps the PIECE tray above the bottom bar at ${width}x${height}`, () => {
            cy.viewport(width, height);
            visit({ mode: 'edit', mobile });
            cy.get(datatest('btn-piece-mode')).click();

            cy.get(datatest('editor-rail')).should('have.attr', 'data-columns', '1');
            cy.get(datatest('piece-queue-infinite-checkbox')).should('be.visible');
            assertPieceRailSingleColumn();
            assertInfiniteToggleFits();
            ['btn-insert-new-page', 'btn-insert-from-clipboard', 'btn-copy-to-clipboard', 'btn-cut-page',
                'btn-utils-mode', 'btn-flags-mode', 'btn-piece-inference'].forEach(selector => {
                cy.get(datatest(selector)).should('not.exist');
            });
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
            cy.get(datatest('tray-context')).then(tray => {
                cy.get(datatest('tools')).then(tools => {
                    expect(tray[0].getBoundingClientRect().bottom)
                        .to.be.at.most(tools[0].getBoundingClientRect().top);
                });
            });
        });
    });

    it('keeps the production field size and text labels on a phone display', () => {
        cy.viewport(412, 844);
        visit({ mode: 'edit' });

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
            ['btn-piece-mode', 'P'],
            ['btn-cold-clear', 'AI'],
            ['btn-select-mode', 'SELECT'],
            ['btn-paint-mode', 'PAINT'],
        ].forEach(([selector, label]) => {
            cy.get(datatest(selector)).should('contain.text', label);
        });
    });

    it('shows SELECT and keeps spawn actions from appearing selected', () => {
        cy.viewport(1000, 800);
        visit({ mode: 'edit' });

        cy.get(datatest('btn-select-mode')).should('contain.text', 'SELECT');
        cy.get(datatest('btn-piece-mode')).click();
        cy.get(datatest('btn-piece-gray'))
            .should('contain.text', 'RESPAWN')
            .and('have.attr', 'data-active', 'false');
        cy.get(datatest('btn-piece-empty')).should('have.attr', 'data-active', 'false');

        cy.get(datatest('btn-piece-gray')).click().should('have.attr', 'data-active', 'false');
        cy.get(datatest('btn-piece-empty')).click().should('have.attr', 'data-active', 'false');
    });

    it('distinguishes paint swatches from piece images and keeps select unchanged', () => {
        visit({ mode: 'edit' });

        const paletteFrames = `${datatest('editor-rail')} [datatest^="btn-piece-"]:not(${datatest('btn-piece-mode')})`;
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

        cy.get(datatest('btn-piece-mode')).click();
        cy.get(paletteFrames).should('have.length', 9);
        cy.get(datatest('piece-palette-empty')).should('be.visible');
        cy.get(`${paletteFrames},${datatest('piece-palette-empty')}`)
            .should('have.length', 10);
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
        visit({ mode: 'edit' });
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
        visit({ mode: 'edit' });

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

    it('toggles the context tray for PAINT and toggles PIECE mode separately', () => {
        cy.viewport(320, 568);
        visit({ mode: 'edit' });

        // Default: paint mode active, context tray occupies the bottom band, comment is hidden.
        cy.get(datatest('btn-paint-mode')).should('have.attr', 'aria-pressed', 'true');
        cy.get(datatest('tray-context')).should('be.visible');
        cy.get(datatest('tray-context')).should('have.class', 'editor-context-tray--compact');
        cy.get(datatest('text-comment')).should('not.exist');
        cy.get(datatest('field-bottom-tray')).then(tray => {
            const trayRect = tray[0].getBoundingClientRect();
            cy.get(datatest('editor-field-frame')).then(field => {
                const fieldRect = field[0].getBoundingClientRect();
                expect(Math.abs(fieldRect.bottom - trayRect.bottom)).to.be.at.most(3);
            });
        });

        // Pressing the already-active mode button again hides the tray (rising row shown instead).
        cy.get(datatest('btn-paint-mode')).click();
        cy.get(datatest('tray-context')).should('not.exist');
        cy.get(datatest('text-comment')).should('exist');

        // Selecting a different tool brings the tray back.
        cy.get(datatest('btn-piece-mode')).click();
        cy.get(datatest('tray-context')).should('be.visible');

        // Pressing Piece again returns to the previous Paint mode without closing the tray.
        cy.get(datatest('btn-piece-mode')).click();
        cy.get(datatest('btn-paint-mode')).should('have.attr', 'aria-pressed', 'true');
        cy.get(datatest('btn-piece-mode')).should('have.attr', 'aria-pressed', 'false');
        cy.get(datatest('tray-context')).should('be.visible');

        // Piece can be enabled again without changing tray visibility.
        cy.get(datatest('btn-piece-mode')).click();
        cy.get(datatest('btn-piece-mode')).should('have.attr', 'aria-pressed', 'true');
        cy.get(datatest('tray-context')).should('be.visible');
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
        cy.get(block(4, 22)).should('have.attr', 'color', Color.T.Normal);
        cy.get(datatest('btn-piece-gray')).click();
        cy.get(block(4, 22)).should('have.attr', 'color', Color.T.Normal);
        operations.mode.block.click(5, 5);
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

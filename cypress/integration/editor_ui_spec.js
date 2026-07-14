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
            ['btn-paint-mode', 'btn-piece-mode', 'btn-select-mode'].forEach(selector => {
                cy.get(datatest(selector)).should('have.attr', 'aria-label').and('not.be.empty');
            });
            ['i', 'l', 'o', 'z', 't', 'j', 's', 'empty', 'gray', 'inference'].forEach(piece => {
                cy.get(datatest(`btn-piece-${piece}`)).should('be.visible');
            });
        });
    });

    it('distinguishes paint swatches from piece images and keeps select unchanged', () => {
        visit({ mode: 'edit' });

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
        cy.get(datatest('btn-piece-i')).find('img').should('exist');

        cy.get(datatest('btn-select-mode')).click();
        cy.get(datatest('btn-piece-i')).find('img').should('not.exist');
        cy.get(datatest('btn-piece-i'))
            .find('[data-palette-swatch="mino"]')
            .should('have.text', 'I');

        cy.get(datatest('btn-piece-i')).click()
            .should('have.css', 'background-color', 'rgb(244, 248, 253)')
            .and('have.css', 'color', 'rgb(51, 51, 51)');
    });

    it('preserves the active tool while opening and closing inspectors', () => {
        visit({ mode: 'edit' });
        cy.get(datatest('btn-piece-mode')).click().should('have.attr', 'aria-pressed', 'true');

        cy.get(datatest('btn-utils-mode')).click();
        cy.get(datatest('overlay-utils')).should('be.visible');
        cy.get(datatest('btn-piece-mode')).should('have.attr', 'aria-pressed', 'true');
        cy.get(datatest('btn-inspector-close')).click();
        cy.get(datatest('btn-piece-mode')).should('have.attr', 'aria-pressed', 'true');
        cy.get(datatest('btn-utils-mode')).should('be.focused');

        cy.get(datatest('btn-flags-mode')).click();
        cy.get(datatest('overlay-flags')).should('be.visible');
        cy.get('body').type('{esc}');
        cy.get(datatest('overlay-flags')).should('not.exist');
        cy.get(datatest('btn-piece-mode')).should('have.attr', 'aria-pressed', 'true');
    });

    it('toggles the context tray by pressing the active mode button again', () => {
        cy.viewport(320, 568);
        visit({ mode: 'edit' });

        // Default: paint mode active, context tray occupies the bottom band, comment stays visible.
        cy.get(datatest('btn-paint-mode')).should('have.attr', 'aria-pressed', 'true');
        cy.get(datatest('tray-context')).should('be.visible');
        cy.get(datatest('text-comment')).should('exist');

        // Pressing the already-active mode button again hides the tray (rising row shown instead).
        cy.get(datatest('btn-paint-mode')).click();
        cy.get(datatest('tray-context')).should('not.exist');
        cy.get(datatest('text-comment')).should('exist');

        // Selecting a different tool brings the tray back.
        cy.get(datatest('btn-piece-mode')).click();
        cy.get(datatest('tray-context')).should('be.visible');

        // Pressing that same (now active) mode button again toggles the tray off.
        cy.get(datatest('btn-piece-mode')).click();
        cy.get(datatest('tray-context')).should('not.exist');

        // Pressing it once more toggles the tray back on.
        cy.get(datatest('btn-piece-mode')).click();
        cy.get(datatest('tray-context')).should('be.visible');
    });

    it('spawns lastMino from PIECE and keeps it through non-mino palette choices', () => {
        visit({ mode: 'edit' });
        cy.get(datatest('btn-piece-mode')).click();
        cy.get(datatest('btn-piece-t')).find('img').should('exist');
        cy.get(datatest('btn-piece-empty')).find('img').should('not.exist');
        operations.mode.block.click(5, 5);
        cy.get(datatest('tray-piece-drag')).should('have.attr', 'aria-pressed', 'true');
        mino(Piece.T, Rotation.Spawn)(4, 20).forEach(selector => {
            cy.get(selector).should('have.attr', 'color', Color.T.Highlight2);
        });

        cy.get(datatest('btn-piece-mode')).trigger('pointerdown', { pointerId: 1, button: 0 });
        cy.wait(550);
        cy.get(datatest('btn-piece-mode')).trigger('pointerup', { pointerId: 1, button: 0 });
        cy.get(datatest('tray-piece-drop')).should('be.disabled');

        cy.get(datatest('btn-piece-empty')).click();
        cy.get(datatest('btn-paint-mode')).should('have.attr', 'aria-pressed', 'true');
        cy.get(datatest('btn-piece-mode')).click();
        operations.mode.block.click(5, 5);
        mino(Piece.T, Rotation.Spawn)(4, 20).forEach(selector => {
            cy.get(selector).should('have.attr', 'color', Color.T.Highlight2);
        });
    });

    it('selects, copies, and stamps a rectangular part from the SELECT tray', () => {
        visit({ mode: 'edit' });
        cy.get(datatest('btn-piece-t')).click();
        operations.mode.block.click(1, 1);
        operations.mode.block.click(2, 1);

        cy.get(datatest('btn-select-mode')).click();
        operations.mode.block.drag({ x: 1, y: 1 }, { x: 2, y: 1 });
        cy.get(datatest('tray-selection-summary')).should('contain', '2×1');
        cy.get(datatest('tray-select-copy')).click();
        cy.get('[datatest^="tray-part-"]').should('have.length', 1);
        cy.get(datatest('tray-select-stamp')).click();
        cy.get(datatest('tray-select-stamp-rotate')).should('be.visible');
        cy.get(datatest('tray-select-black-transparent')).click();
        operations.mode.block.click(5, 5);
        cy.get('[datatest^="tray-part-"]').should('have.length', 1);
        cy.get(block(5, 5)).should('have.attr', 'color', Color.T.Normal);
        cy.get(block(6, 5)).should('have.attr', 'color', Color.T.Normal);
        cy.get(datatest('btn-undo')).click();
        cy.get(block(5, 5)).should('not.have.attr', 'color', Color.T.Normal);
        cy.get(block(6, 5)).should('not.have.attr', 'color', Color.T.Normal);
    });

    it('shows the desktop context inspector only on wide PC layouts', () => {
        cy.viewport(1024, 768);
        visit({ mode: 'edit', mobile: false });
        cy.get(datatest('editor-context-inspector')).should('not.exist');

        cy.viewport(1920, 1080);
        cy.reload();
        cy.get(datatest('editor-context-inspector')).should('be.visible');
        cy.get(datatest('tray-context')).should('be.visible');
    });
});

import { block, Color, expectFumen, visit } from '../support/common';
import { operations } from "../support/operations";

describe('Slide', () => {
    it('Up/Down', () => {
        visit({
            fumen: 'v115@bhE8AeI8AeD8AgH',
            mode: 'edit',
        });

        operations.mode.slide.open();
        operations.mode.slide.up();

        expectFumen('v115@RhE8AeD8JeE8AeD8AgH')

        operations.mode.slide.down();

        expectFumen('v115@bhE8AeI8AeD8AgH')
    });

    it('moves the whole field by dragging while keeping the UTIL slide tray', () => {
        visit({ fumen: 'v115@vhAAgH', mode: 'edit' });
        cy.get('[datatest="btn-piece-t"]').click();
        operations.mode.block.click(0, 0);

        operations.mode.slide.open();
        cy.get('[datatest="btn-slide-to-right"]').should('be.visible');
        operations.mode.block.drag({ x: 0, y: 0 }, { x: 1, y: 0 });

        cy.get(block(0, 0)).should('not.have.attr', 'color', Color.T.Normal);
        cy.get(block(1, 0)).should('have.attr', 'color', Color.T.Normal);
    });
});

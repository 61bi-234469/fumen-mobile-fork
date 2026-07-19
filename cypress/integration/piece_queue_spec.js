import { datatest, visit } from '../support/common';
import { operations } from '../support/operations';

describe('PIECE queues', () => {
    beforeEach(() => cy.clearLocalStorage());

    it('shows Hold and nearest-first NEXT only in PIECE mode', () => {
        cy.viewport(375, 667);
        visit({ mode: 'edit' });

        cy.get(datatest('piece-queue-hold')).should('not.exist');
        cy.get(datatest('piece-queue-next')).should('not.exist');
        cy.get(datatest('piece-queue-infinite')).should('not.exist');

        cy.get(datatest('btn-paint-mode')).click();
        cy.get(datatest('text-comment')).clear().type('T:IOTLJ').blur();
        cy.get(datatest('btn-piece-mode')).click();

        cy.get(datatest('piece-queue-hold'))
            .should('be.visible')
            .and('have.attr', 'data-piece', 'T');
        ['I', 'O', 'T', 'L', 'J'].forEach((piece, index) => {
            cy.get(datatest(`piece-queue-next-${index}`))
                .should('be.visible')
                .and('have.attr', 'data-piece', piece);
        });
        cy.get(datatest('piece-queue-infinite')).should('be.visible').and('contain.text', '∞ 7bag');
        cy.get(datatest('piece-queue-infinite-checkbox')).should('not.be.checked');
        cy.get(datatest('piece-queue-infinite')).then(toggle => {
            const toggleRect = toggle[0].getBoundingClientRect();
            const checkboxRect = toggle.find(datatest('piece-queue-infinite-checkbox'))[0].getBoundingClientRect();
            const textRect = toggle.find(datatest('piece-queue-infinite-text'))[0].getBoundingClientRect();
            expect(Math.abs((checkboxRect.top + checkboxRect.bottom) / 2
                - (textRect.top + textRect.bottom) / 2)).to.be.lessThan(2);
            expect(textRect.right).to.be.at.most(toggleRect.right);
            expect(toggle[0].scrollWidth).to.be.at.most(Math.ceil(toggleRect.width));
        });
        cy.get(datatest('editor-rail')).should('have.attr', 'data-columns', '1');
        ['btn-insert-new-page', 'btn-insert-from-clipboard', 'btn-copy-to-clipboard', 'btn-cut-page',
            'btn-utils-mode', 'btn-flags-mode', 'btn-piece-inference'].forEach(selector => {
            cy.get(datatest(selector)).should('not.exist');
        });
    });

    it('toggles infinite 7bag separately from the NEXT settings button', () => {
        visit({ mode: 'edit' });
        cy.get(datatest('btn-paint-mode')).click();
        cy.get(datatest('text-comment')).clear().type('#Q=[](T)IOLJSZ').blur();
        operations.mode.piece.open();

        operations.mode.piece.toggleInfiniteQueue();
        cy.get(datatest('piece-queue-infinite-checkbox')).should('be.checked');
        cy.get(datatest('mdl-piece-queue')).should('not.exist');

        operations.mode.piece.toggleInfiniteQueue();
        cy.get(datatest('piece-queue-infinite-checkbox')).should('not.be.checked');
        cy.get(datatest('piece-queue-next-0')).should('have.attr', 'data-piece', 'I');
    });

    it('hides the comment input while the context tray is shown and restores its value', () => {
        visit({ mode: 'edit' });
        cy.get(datatest('btn-paint-mode')).click();
        cy.get(datatest('text-comment')).clear().type('kept comment').blur();
        cy.get(datatest('btn-piece-mode')).click();

        cy.get(datatest('tray-context')).should('be.visible');
        cy.get(datatest('text-comment')).should('not.exist');

        cy.get(datatest('btn-piece-mode')).click();
        cy.get(datatest('btn-paint-mode')).click();
        cy.get(datatest('tray-context')).should('not.exist');
        cy.get(datatest('text-comment')).should('have.value', 'kept comment');
    });

    it('opens the queue modal and commits edits to the page comment', () => {
        visit({ mode: 'edit' });
        cy.get(datatest('btn-paint-mode')).click();
        cy.get(datatest('text-comment')).clear().type('T:IO').blur();
        cy.get(datatest('btn-piece-mode')).click();

        cy.get(datatest('piece-queue-next')).click();
        cy.get(datatest('mdl-piece-queue')).should('be.visible');
        cy.get(datatest('btn-piece-queue-add-Z')).click();
        cy.get(datatest('btn-piece-queue-close')).click();

        cy.get(datatest('piece-queue-next-2')).should('have.attr', 'data-piece', 'Z');
        operations.mode.comment.open();
        cy.get(datatest('text-comment')).should('have.value', '#Q=[T]()IOZ');
    });

    it('focuses the modal section matching the tapped queue panel', () => {
        visit({ mode: 'edit' });
        cy.get(datatest('btn-paint-mode')).click();
        cy.get(datatest('text-comment')).clear().type('T:IO').blur();
        cy.get(datatest('btn-piece-mode')).click();

        cy.get(datatest('piece-queue-hold')).click();
        cy.get(datatest('input-piece-queue-hold')).should('be.focused');
        cy.get(datatest('pane-piece-queue-hold')).should('have.css', 'border-top-color', 'rgb(25, 118, 210)');
        cy.get(datatest('btn-piece-queue-close')).click();

        cy.get(datatest('piece-queue-next')).click();
        cy.get(datatest('input-piece-queue-next')).should('be.focused');
        cy.get(datatest('pane-piece-queue-next')).should('have.css', 'border-top-color', 'rgb(25, 118, 210)');
        cy.get(datatest('btn-piece-queue-close')).click();
    });

    it('edits the current piece from the modal', () => {
        visit({ mode: 'edit' });
        cy.get(datatest('btn-paint-mode')).click();
        cy.get(datatest('text-comment')).clear().type('#Q=[T]()IO').blur();
        cy.get(datatest('btn-piece-mode')).click();

        cy.get(datatest('piece-queue-next')).click();
        cy.get(datatest('mdl-piece-queue')).should('be.visible');

        cy.get(datatest('pane-piece-queue-current')).click();
        cy.get(datatest('input-piece-queue-current')).should('be.focused');
        cy.get(datatest('btn-piece-queue-add-S')).click();
        cy.get(datatest('btn-piece-queue-close')).click();

        operations.mode.comment.open();
        cy.get(datatest('text-comment')).should('have.value', '#Q=[T](S)IO');
    });

    it('respawns the edited current piece and undoes queue and spawn together', () => {
        visit({ mode: 'edit' });
        cy.get(datatest('btn-paint-mode')).click();
        cy.get(datatest('text-comment')).clear().type('#Q=[Z](S)L').blur();
        operations.mode.piece.open();
        operations.mode.piece.spawn.S();

        cy.get(datatest('piece-queue-next')).click();
        cy.get(datatest('pane-piece-queue-current')).click();
        cy.get(datatest('btn-piece-queue-add-O')).click();
        cy.get(datatest('btn-piece-queue-close')).click();
        operations.mode.comment.open();
        cy.get(datatest('text-comment')).should('have.value', '#Q=[Z](O)L');

        operations.mode.tools.undo();
        cy.get(datatest('text-comment')).should('have.value', '#Q=[Z](S)L');
        operations.mode.piece.open();
        operations.mode.piece.harddrop();
        operations.mode.comment.open();
        cy.get(datatest('text-comment')).should('have.value', '#Q=[Z](L)');
    });
});

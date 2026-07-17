import { datatest, visit } from '../support/common';
import { operations } from '../support/operations';

describe('PIECE queues', () => {
    beforeEach(() => cy.clearLocalStorage());

    it('shows Hold and nearest-first NEXT only in PIECE mode', () => {
        cy.viewport(375, 667);
        visit({ mode: 'edit' });

        cy.get(datatest('piece-queue-hold')).should('not.exist');
        cy.get(datatest('piece-queue-next')).should('not.exist');

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
    });

    it('opens the queue modal and commits edits to the page comment', () => {
        visit({ mode: 'edit' });
        cy.get(datatest('text-comment')).clear().type('T:IO').blur();
        cy.get(datatest('btn-piece-mode')).click();

        cy.get(datatest('piece-queue-next')).click();
        cy.get(datatest('mdl-piece-queue')).should('be.visible');
        cy.get(datatest('btn-piece-queue-add-Z')).click();
        cy.get(datatest('btn-piece-queue-close')).click();

        cy.get(datatest('text-comment')).should('have.value', '#Q=[T]()IOZ');
        cy.get(datatest('piece-queue-next-2')).should('have.attr', 'data-piece', 'Z');
    });

    it('focuses the modal section matching the tapped queue panel', () => {
        visit({ mode: 'edit' });
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
        cy.get(datatest('text-comment')).clear().type('#Q=[T]()IO').blur();
        cy.get(datatest('btn-piece-mode')).click();

        cy.get(datatest('piece-queue-next')).click();
        cy.get(datatest('mdl-piece-queue')).should('be.visible');

        cy.get(datatest('pane-piece-queue-current')).click();
        cy.get(datatest('input-piece-queue-current')).should('be.focused');
        cy.get(datatest('btn-piece-queue-add-S')).click();
        cy.get(datatest('btn-piece-queue-close')).click();

        cy.get(datatest('text-comment')).should('have.value', '#Q=[T](S)IO');
    });

    it('respawns the edited current piece and undoes queue and spawn together', () => {
        visit({ mode: 'edit' });
        cy.get(datatest('text-comment')).clear().type('#Q=[Z](S)L').blur();
        operations.mode.piece.open();
        operations.mode.piece.spawn.S();

        cy.get(datatest('piece-queue-next')).click();
        cy.get(datatest('pane-piece-queue-current')).click();
        cy.get(datatest('btn-piece-queue-add-O')).click();
        cy.get(datatest('btn-piece-queue-close')).click();
        cy.get(datatest('text-comment')).should('have.value', '#Q=[Z](O)L');

        operations.mode.tools.undo();
        cy.get(datatest('text-comment')).should('have.value', '#Q=[Z](S)L');
        operations.mode.piece.harddrop();
        cy.get(datatest('text-comment')).should('have.value', '#Q=[Z](L)');
    });
});

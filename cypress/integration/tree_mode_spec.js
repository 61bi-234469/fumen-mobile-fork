import { datatest, visit } from '../support/common';

describe('Tree mode in list view', () => {
    it('disables list reordering and confirms before deleting the tree structure', () => {
        visit({ mode: 'edit', fumen: 'v115@vhAAgH', lng: 'en' });

        cy.get(datatest('btn-list-view')).click();
        cy.get('[title="Enable tree mode"]').click();

        cy.get(datatest('list-view-item-0')).should('have.prop', 'draggable', false);

        cy.get('[title="Disable tree mode"]').click();
        cy.get(datatest('mdl-tree-disable-confirm')).should('be.visible');
        cy.get(datatest('btn-tree-disable-cancel')).click();
        cy.get(datatest('mdl-tree-disable-confirm')).should('not.exist');
        cy.get('[title="Disable tree mode"]').should('be.visible');

        cy.get('[title="Disable tree mode"]').click();
        cy.get(datatest('btn-tree-disable-confirm')).click();
        cy.get('[title="Enable tree mode"]').should('be.visible');
    });
});

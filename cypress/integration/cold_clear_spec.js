import { datatest, visit } from '../support/common';
import { operations } from '../support/operations';

const ensureTreeGraphView = () => {
    cy.get(datatest('btn-list-view')).click();

    cy.get('body').then(($body) => {
        if ($body.find('[title="Enable tree mode"]').length > 0) {
            cy.get('[title="Enable tree mode"]').click();
        }
    });

    cy.get('[title="Show pages in tree graph view"]').should('be.visible').click();
    cy.get(datatest('btn-tree-ai-menu')).should('be.visible');
};

describe('Cold Clear menu', () => {
    it('adds a top-level node from ghost add button in tree view', () => {
        visit({ mode: 'edit', lng: 'en' });
        ensureTreeGraphView();

        cy.get(datatest('text-page-count')).should('contain', '1 pages');
        cy.get(datatest('btn-tree-root-add-ghost')).should('be.visible').click();
        cy.get(datatest('text-page-count')).should('contain', '2 pages');
        cy.get(datatest('btn-tree-ai-menu')).should('be.visible');
    });

    it('shows the primary search actions and enabled placed-score action', () => {
        visit({ mode: 'edit', lng: 'en' });
        ensureTreeGraphView();

        cy.get(datatest('btn-tree-ai-menu')).click();
        cy.get(datatest('mdl-cold-clear-menu')).should('be.visible');

        cy.get(datatest('btn-cold-clear-sequence-search')).should('be.visible');
        cy.get(datatest('btn-cold-clear-top-branches-search')).should('be.visible');
        cy.get(datatest('btn-cold-clear-append-one-bag')).scrollIntoView().should('be.visible');

        cy.get(datatest('btn-cold-clear-evaluate-placed-spawn-score')).should('not.be.disabled');
    });

    it('fails fast with toast when no placed piece exists', () => {
        visit({ mode: 'edit', lng: 'en' });

        cy.get(datatest('text-comment')).clear().type('TIOLJSZ');
        ensureTreeGraphView();

        cy.get(datatest('btn-tree-ai-menu')).click();
        cy.get(datatest('btn-cold-clear-evaluate-placed-spawn-score')).click();

        cy.contains('.toast', 'AI: Place a piece before running this action').should('be.visible');
        cy.get(datatest('mdl-cold-clear-menu')).should('be.visible');
    });

    it('closes modal after placed-score evaluation completes', () => {
        visit({ mode: 'edit', lng: 'en' });

        cy.get(datatest('text-comment')).clear().type('TIOLJSZ');
        operations.mode.piece.open();
        operations.mode.piece.spawn.T();
        operations.mode.piece.harddrop();

        ensureTreeGraphView();
        cy.get(datatest('btn-tree-ai-menu')).click();
        cy.get(datatest('mdl-cold-clear-menu')).should('be.visible');

        cy.get(datatest('btn-cold-clear-evaluate-placed-spawn-score')).click();

        cy.get(datatest('mdl-cold-clear-menu')).should('not.exist');
        cy.get(datatest('btn-tree-ai-menu')).should('be.visible');
    });

    it('allows editing top branch count and disables it while search runs', () => {
        visit({ mode: 'edit', lng: 'en' });

        cy.get(datatest('text-comment')).clear().type('TIOLJSZ');
        ensureTreeGraphView();

        cy.get(datatest('btn-tree-ai-menu')).click();
        cy.get(datatest('input-cold-clear-top-branch-count')).scrollIntoView()
            .should('be.visible').and('not.be.disabled');

        cy.get(datatest('input-cold-clear-top-branch-count')).clear().type('7').blur();
        cy.get(datatest('input-cold-clear-top-branch-count')).should('have.value', '7');
        cy.get(datatest('btn-cold-clear-top-branches-search')).click();

        cy.get(datatest('input-cold-clear-top-branch-count')).should('be.disabled');
    });
});

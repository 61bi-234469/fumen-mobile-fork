import { datatest, visit } from '../support/common';
import { operations } from '../support/operations';

const ensureTreeGraphView = () => {
    cy.get(datatest('btn-list-view')).click();

    cy.get('body').then(($body) => {
        if ($body.find('[title="Enable tree mode"]').length > 0) {
            cy.get('[title="Enable tree mode"]').click();
        }
    });

    cy.get('[title="Show pages in tree view"]').should('be.visible').click();
    cy.get(datatest('btn-tree-ai-menu')).should('be.visible');
};

describe('Cold Clear menu', () => {
    it('adds a top-level node from ghost add button in tree view', () => {
        visit({ mode: 'edit', lng: 'en' });
        ensureTreeGraphView();

        cy.get('[datatest^="tree-node-"]').should('have.length', 1);
        cy.get(datatest('btn-tree-root-add-ghost')).should('be.visible').click();
        cy.get('[datatest^="tree-node-"]').should('have.length', 2);
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
        // ハードドロップは次ページを自動挿入してそちらへ移動するため、
        // 設置済みピースのあるページへ戻ってから配置スコアを評価する。
        operations.mode.tools.backPage();

        ensureTreeGraphView();
        cy.get(datatest('btn-tree-ai-menu')).click();
        cy.get(datatest('mdl-cold-clear-menu')).should('be.visible');

        cy.get(datatest('btn-cold-clear-evaluate-placed-spawn-score')).click();

        // Observe the persistent tree control's running state before waiting
        // for the modal component to be removed.
        cy.get(datatest('btn-tree-ai-menu'), { timeout: 15000 })
            .should('have.attr', 'data-cold-clear-running', '1');
        cy.get(datatest('btn-tree-ai-menu'), { timeout: 15000 })
            .should('have.attr', 'data-cold-clear-running', '0');
        cy.get(datatest('mdl-cold-clear-menu'), { timeout: 15000 }).should('not.exist');
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

    it('respawns the current piece edited in the AI menu', () => {
        visit({ mode: 'edit', lng: 'en' });
        cy.get(datatest('text-comment')).clear().type('#Q=[Z](S)L').blur();
        operations.mode.piece.open();
        operations.mode.piece.spawn.S();

        cy.get(datatest('btn-cold-clear')).click();
        cy.get(datatest('pane-cold-clear-current')).click();
        cy.get(datatest('btn-cold-clear-queue-add-O')).click();
        cy.get(datatest('btn-cold-clear-menu-close')).click();
        cy.get(datatest('text-comment')).should('have.value', '#Q=[Z](O)L');

        operations.mode.tools.undo();
        cy.get(datatest('text-comment')).should('have.value', '#Q=[Z](S)L');
        operations.mode.piece.harddrop();
        cy.get(datatest('text-comment')).should('have.value', '#Q=[Z](L)');
    });
});

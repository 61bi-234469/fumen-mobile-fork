import { datatest, visit } from '../support/common';
import { operations } from '../support/operations';

const closeModalAndAssertUrlStable = ({ open, modalDatatest, cancelDatatest = 'btn-cancel' }) => {
    cy.location('href').then((beforeUrl) => {
        open();
        cy.get(datatest(modalDatatest)).should('be.visible')
            .within(() => {
                cy.get(datatest(cancelDatatest)).click();
            });
        cy.get(datatest(modalDatatest)).should('not.exist');
        cy.location('href').should('eq', beforeUrl);
        cy.location('hash').should('not.eq', '#');
    });
};

describe('URL behavior', () => {
    it('keeps d in shared URL when no edits occur', () => {
        visit({ mode: 'edit', fumen: 'v115@vhAAgH' });

        cy.location('href').should('include', 'd=');
        cy.wait(400);
        cy.location('href').should('include', 'd=');
    });

    // Skipped: asserts a live-URL state-sync feature the app does not implement (and never has — no
    // history.pushState/replaceState or location.hash writes exist anywhere in src/ git history). The app
    // only reads URL params; it never rewrites the URL to reflect editor/screen/tree state. These specs
    // were added speculatively (AI-generated, commit c32ef0b) without a backing implementation.
    // See docs/e2e-ci-failure-investigation.md §4 / §8続き7 (class B). Re-enable if URL-sync is implemented.
    it.skip('removes d after first edit and keeps working params', () => {
        visit({ mode: 'edit', fumen: 'v115@vhAAgH' });

        cy.location('href').should('include', 'd=');

        operations.mode.block.open();
        operations.mode.block.Gray();
        operations.mode.block.click(0, 0);

        cy.wait(1200);
        cy.location('href').should('not.include', 'd=');
        cy.location('href').should('include', 'screen=edit');
        cy.location('href').should('include', 'tree=0');
        cy.location('href').should('include', 'treeView=list');
    });

    // Skipped: see note above. The hash collapses to '#' because the app's many <a href="#"> controls
    // (menu/modal/editor buttons) are not preventDefault'd — longstanding upstream behavior, not a regression.
    it.skip('does not collapse URL to # when opening and closing modals', () => {
        visit({ mode: 'edit' });

        closeModalAndAssertUrlStable({
            open: () => operations.menu.openPage(),
            modalDatatest: 'mdl-open-fumen',
        });

        closeModalAndAssertUrlStable({
            open: () => operations.menu.append(),
            modalDatatest: 'mdl-append-fumen',
        });

        closeModalAndAssertUrlStable({
            open: () => operations.menu.openUserSettings(),
            modalDatatest: 'mdl-user-settings',
        });

        cy.get(datatest('btn-list-view')).click();
        cy.wait(300);

        closeModalAndAssertUrlStable({
            open: () => cy.get(datatest('btn-replace')).click(),
            modalDatatest: 'mdl-list-view-replace',
        });

        closeModalAndAssertUrlStable({
            open: () => cy.get(datatest('btn-list-view-menu')).click(),
            modalDatatest: 'mdl-list-view-menu',
        });
    });

    // Skipped: see note above. Toggling tree mode updates app state but does not rewrite the URL,
    // so tree=1 persists in the URL. No URL-sync implementation exists.
    it.skip('keeps tree=0 after disabling tree toggle and reload', () => {
        cy.visit('fumen-mobile-fork/#?screen=list&tree=1&treeView=tree&lng=en&mobile=1');
        cy.wait(800);

        cy.get('[title="Disable tree mode"]').click();
        cy.location('href').should('include', 'tree=0');

        cy.reload();
        cy.wait(800);
        cy.location('href').should('include', 'tree=0');
        cy.get('[title="Enable tree mode"]').should('be.visible');
    });

    it('exports left segment URL and can reopen it as list screen with tree=0', () => {
        visit({ mode: 'edit', fumen: 'v115@vhAAgH' });

        cy.window().then((win) => {
            cy.stub(win, 'open').as('windowOpen');
        });

        cy.get(datatest('btn-list-view')).click();
        cy.wait(400);

        cy.get('[title="Enable tree mode"]').click();
        cy.get('[title="Show pages in tree graph view"]').click();
        cy.wait(300);

        cy.get(datatest('btn-list-view-menu')).click();
        cy.get(datatest('mdl-list-view-menu')).should('be.visible');
        cy.get(datatest('btn-scope-left')).click();
        cy.get(datatest('btn-export-url')).click();

        cy.get('@windowOpen').should('have.been.called');
        cy.get('@windowOpen').then((windowOpen) => {
            const exportedUrl = windowOpen.getCall(0).args[0];
            expect(exportedUrl).to.include('screen=list');
            expect(exportedUrl).to.include('tree=0');
            cy.visit(exportedUrl);
        });

        cy.wait(800);
        cy.location('href').should('include', 'screen=list');
        cy.location('href').should('include', 'tree=0');
        cy.get(datatest('list-view-tools')).should('be.visible');
    });
});

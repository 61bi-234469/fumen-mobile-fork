import { datatest, expectFumen, visit } from '../support/common';
import { operations } from '../support/operations';

describe('Utils', () => {
    it('keeps paint tools in PAINT options instead of UTIL', () => {
        visit({ mode: 'edit' });

        cy.get(datatest('btn-utils-mode')).click();
        cy.get(datatest('overlay-utils')).should('be.visible');
        cy.get(datatest('overlay-utils')).find(datatest('btn-fill-mode')).should('not.exist');
        cy.get(datatest('overlay-utils')).find(datatest('btn-fill-row-mode')).should('not.exist');
        cy.get(datatest('btn-inspector-close')).click();

        cy.get(datatest('btn-paint-mode')).click();
        cy.get(datatest('tray-paint-fill')).should('be.visible');
        cy.get(datatest('tray-paint-fill-row')).should('be.visible');
    });

    it('groups utilities by page scope and keeps editing modes separate', () => {
        visit({ mode: 'edit' });

        cy.get(datatest('btn-utils-mode')).click();
        cy.get(datatest('overlay-utils')).should('be.visible');

        cy.get(datatest('utils-scope-current-page')).within(() => {
            cy.get(datatest('btn-mirror')).should('exist');
            cy.get(datatest('btn-convert-to-gray')).should('exist');
            cy.get(datatest('btn-clear-field')).should('exist');
            cy.get(datatest('btn-all-mirror')).should('not.exist');
        });

        cy.get(datatest('utils-scope-all-pages')).within(() => {
            cy.get(datatest('btn-all-mirror')).should('exist');
            cy.get(datatest('btn-replace')).should('exist');
            cy.get(datatest('btn-mirror')).should('not.exist');
        });

        cy.get(datatest('utils-scope-editing-modes')).within(() => {
            cy.get(datatest('btn-slide-mode')).should('exist');
            cy.get(datatest('btn-comment-mode')).should('exist');
            cy.get(datatest('btn-clear-field')).should('not.exist');
        });
    });

    it('Mirror', () => {
        visit({
            fumen: 'v115@vhGBPJcJJTFJi/IvLJGBJNMJ',
            mode: 'edit',
        });

        operations.mode.tools.mirror({ home: true });

        expectFumen('v115@vhGBRJvNJTHJGDJcLJiBJ9KJ')

        operations.mode.utils.close();
        operations.mode.tools.mirror({ home: true });

        expectFumen('v115@vhGBPJcJJTFJi/IvLJGBJNMJ')
    });
});

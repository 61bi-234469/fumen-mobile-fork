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

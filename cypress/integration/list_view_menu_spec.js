import { datatest, visit } from '../support/common';
import { operations } from '../support/operations';

describe('Unified import/export menu', () => {
    const screens = [
        { name: 'Editor', mode: 'edit' },
        { name: 'Reader', mode: 'readonly' },
    ];

    screens.forEach(({ name, mode }) => {
        describe(`from ${name} menu`, () => {
            beforeEach(() => {
                visit({ mode, fumen: 'v115@vhAAgH' });
                cy.wait(300);
            });

            it('shows the Import / Export button and no legacy Export List', () => {
                operations.menu.open();
                cy.get(datatest('btn-list-menu')).should('be.visible');
                cy.get(datatest('btn-external-site')).should('not.exist');
            });

            it('opens the unified modal and closes/destroys via Cancel', () => {
                operations.menu.importExport();
                cy.get(datatest('mdl-list-view-menu')).should('be.visible');
                cy.get(datatest('mdl-list-view-menu')).within(() => {
                    cy.get(datatest('btn-cancel')).click();
                });
                cy.get(datatest('mdl-list-view-menu')).should('not.exist');
            });

            it('closes the unified modal via ESC', () => {
                operations.menu.importExport();
                cy.get(datatest('mdl-list-view-menu')).should('be.visible');
                cy.get('body').type('{esc}');
                cy.get(datatest('mdl-list-view-menu')).should('not.exist');
            });
        });
    });

    it('opens fumen.zui.jp (LIST) from the unified modal', () => {
        visit({ mode: 'edit', fumen: 'v115@vhAAgH' });
        cy.wait(300);

        cy.window().then((win) => {
            cy.stub(win, 'open').as('windowOpen');
        });

        operations.menu.importExport();
        cy.get(datatest('mdl-list-view-menu')).should('be.visible');
        cy.get(datatest('btn-export-external-site')).click();

        cy.get('@windowOpen').should('have.been.called');
        cy.get('@windowOpen').then((windowOpen) => {
            const url = windowOpen.getCall(0).args[0];
            expect(url).to.include('https://fumen.zui.jp/?D115@');
        });
        cy.get(datatest('mdl-list-view-menu')).should('not.exist');
    });
});

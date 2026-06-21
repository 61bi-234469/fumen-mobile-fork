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

            it('shows the Import/Export button and no legacy Export List', () => {
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

    it('opens fumen.zui.jp with a v115 payload from the unified modal', () => {
        visit({ mode: 'edit', fumen: 'v115@vhAAgH' });
        cy.wait(300);

        cy.window().then((win) => {
            cy.stub(win, 'open').as('windowOpen');
        });

        operations.menu.importExport();
        cy.get(datatest('btn-export-fumen-zui')).click();

        cy.get('@windowOpen').then((windowOpen) => {
            const url = windowOpen.getCall(0).args[0];
            expect(url).to.include('https://fumen.zui.jp/?v115@');
        });
    });

    it('opens Fumen for mobile with a v115 payload from the unified modal', () => {
        visit({ mode: 'edit', fumen: 'v115@vhAAgH' });
        cy.wait(300);

        cy.window().then((win) => {
            cy.stub(win, 'open').as('windowOpen');
        });

        operations.menu.importExport();
        cy.get(datatest('btn-export-fumen-for-mobile')).click();

        cy.get('@windowOpen').then((windowOpen) => {
            const url = windowOpen.getCall(0).args[0];
            expect(url).to.include('https://knewjade.github.io/fumen-for-mobile/#?d=v115@');
        });
    });

    it('uses clipboard labels and icons for import/export options', () => {
        visit({ mode: 'edit', fumen: 'v115@vhAAgH', lng: 'ja' });
        cy.wait(300);

        operations.menu.importExport();
        [
            ['btn-import', 'クリップボードから読み込む', 'move_to_inbox'],
            ['btn-add', 'クリップボードから挿入', 'add'],
            ['btn-export-image', 'PNG', 'image'],
            ['btn-export-gif', 'GIF', 'gif'],
            ['btn-export-fumen', 'FUMENをコピー', 'content_copy'],
            ['btn-copy-url', '共有URLをコピー', 'content_copy'],
            ['btn-export-url', '共有URLを開く', 'link'],
            ['btn-export-fumen-zui', '連続テト譜エディタで開く', 'open_in_new'],
            ['btn-export-fumen-for-mobile', 'Fumen for mobileで開く', 'open_in_new'],
            ['btn-export-external-site', '連続テト譜エディタ(LIST)で開く', 'open_in_new'],
        ].forEach(([button, label, icon]) => {
            cy.get(datatest(button)).should('contain.text', label);
            cy.get(datatest(button)).find('.material-icons').should('contain.text', icon);
        });
        ['btn-export-url', 'btn-export-fumen-zui', 'btn-export-fumen-for-mobile', 'btn-export-external-site']
            .forEach(button => {
            cy.get(datatest(button)).should('not.have.class', 'btn');
        });
        cy.get(datatest('btn-copy-url')).should('have.class', 'btn');
        cy.get(datatest('input-gif-frame-delay')).should('have.value', '500');
    });
});

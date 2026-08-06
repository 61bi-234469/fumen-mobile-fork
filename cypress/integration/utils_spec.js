import { block, Color, datatest, expectFumen, visit } from '../support/common';
import { operations } from '../support/operations';

describe('Utils', () => {
    it('keeps paint tools in PAINT options instead of UTIL', () => {
        visit({ mode: 'edit' });

        cy.get(datatest('btn-utils-mode')).click();
        cy.get(datatest('overlay-utils')).should('be.visible');
        cy.get(datatest('overlay-utils')).find(datatest('btn-fill-mode')).should('not.exist');
        cy.get(datatest('overlay-utils')).find(datatest('btn-fill-row-mode')).should('not.exist');
        cy.get(datatest('btn-inspector-close')).click();

        operations.mode.tools.home();
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
            cy.get(datatest('btn-convert-to-black')).should('exist');
            cy.get(datatest('btn-clear-field')).should('exist');
            cy.get(datatest('btn-all-mirror')).should('not.exist');
        });

        cy.get(datatest('utils-scope-all-pages')).within(() => {
            cy.get(datatest('btn-all-mirror')).should('exist');
            cy.get(datatest('btn-replace')).should('exist');
            cy.get(datatest('btn-reset-all-comments')).should('exist');
            cy.get(datatest('btn-mirror')).should('not.exist');
        });

        cy.get(datatest('utils-scope-editing-modes')).within(() => {
            cy.get(datatest('btn-slide-mode')).should('exist');
            cy.get(datatest('btn-comment-mode')).should('exist');
            cy.get(datatest('btn-clear-field')).should('not.exist');
        });
    });

    it('closes the floating menu after a utility is selected', () => {
        cy.clearLocalStorage();

        visit({ mode: 'edit' });

        cy.get(datatest('overlay-backdrop-modal')).should('not.exist');
        operations.mode.utils.open();
        cy.get(datatest('overlay-backdrop-modal')).should('exist');
        cy.get(datatest('btn-convert-to-gray')).click();
        cy.get(datatest('overlay-utils')).should('not.exist');
    });

    it('keeps the floating menu open and the field usable when pinning is enabled', () => {
        cy.clearLocalStorage();

        visit({ mode: 'edit' });
        operations.menu.setUtilsMenuPinned(true);

        operations.mode.utils.open();
        cy.get(datatest('overlay-backdrop-pinned')).should('exist');
        cy.get(datatest('btn-convert-to-gray')).click();
        cy.get(datatest('overlay-utils')).should('be.visible');

        // 暗転レイヤーがクリックを奪わないので、メニューを開いたままレールと盤面を操作できる
        operations.mode.block.Gray();
        operations.mode.block.click(0, 0);
        cy.get(block(0, 0)).should('have.attr', 'color', Color.Gray.Normal);
        cy.get(datatest('overlay-utils')).should('be.visible');

        cy.get(datatest('btn-inspector-close')).click();
        cy.get(datatest('overlay-utils')).should('not.exist');
    });

    it('Mirror', () => {
        visit({
            fumen: 'v115@vhGBPJcJJTFJi/IvLJGBJNMJ',
            mode: 'edit',
        });

        operations.mode.tools.mirror({ home: true });

        expectFumen('v115@vhGBRJvNJTHJGDJcLJiBJ9KJ')

        operations.mode.tools.mirror({ home: true });

        expectFumen('v115@vhGBPJcJJTFJi/IvLJGBJNMJ')
    });

    it('deletes every non-gray block on the current page', () => {
        visit({ mode: 'edit' });

        operations.mode.block.open();
        operations.mode.block.Gray();
        operations.mode.block.click(0, 0);
        operations.mode.block.S();
        operations.mode.block.click(1, 0);

        cy.get(block(0, 0)).should('have.attr', 'color', Color.Gray.Normal);
        cy.get(block(1, 0)).should('have.attr', 'color', Color.S.Normal);

        operations.mode.utils.open();
        cy.get(datatest('btn-convert-to-black')).click();
        cy.get(datatest('overlay-utils')).should('not.exist');

        cy.get(block(0, 0)).should('have.attr', 'color', Color.Gray.Normal);
        cy.get(block(1, 0)).should('have.attr', 'color', Color.Empty.Normal);
    });

    it('resets the comments of every page', () => {
        visit({ mode: 'edit' });

        operations.mode.comment.open();
        cy.get(datatest('text-comment')).type('first').blur();

        operations.mode.tools.nextPage();
        cy.get(datatest('text-comment')).type('second').blur();

        operations.mode.utils.open();
        cy.get(datatest('btn-reset-all-comments')).click();
        cy.get(datatest('overlay-utils')).should('not.exist');

        cy.get(datatest('text-comment')).should('have.value', '');
        operations.mode.tools.backPage();
        cy.get(datatest('text-comment')).should('have.value', '');
    });
});

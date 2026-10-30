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

        cy.get(datatest('utils-scope-pages')).within(() => {
            cy.get(datatest('btn-clear-past')).should('exist');
            cy.get(datatest('btn-clear-to-end')).should('exist');
            cy.get(datatest('btn-clear-others')).should('exist');
            cy.get(datatest('btn-reset-all-pages')).should('exist');
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

        // ピンはUTILSの窓のヘッダーで切り替え、その場で暗転が外れる
        operations.mode.utils.open();
        cy.get(datatest('overlay-backdrop-modal')).should('exist');
        cy.get(datatest('btn-utils-pin')).should('have.attr', 'aria-pressed', 'false').click();
        cy.get(datatest('btn-utils-pin')).should('have.attr', 'aria-pressed', 'true');
        cy.get(datatest('overlay-backdrop-pinned')).should('exist');
        cy.get(datatest('btn-convert-to-gray')).click();
        cy.get(datatest('overlay-utils')).should('be.visible');

        // 暗転レイヤーがクリックを奪わないので、メニューを開いたままレールと盤面を操作できる
        operations.mode.block.Gray();
        operations.mode.block.click(0, 0);
        cy.get(block(0, 0)).should('have.attr', 'color', Color.Gray.Normal);
        cy.get(datatest('overlay-utils')).should('be.visible');

        // ピン留め中もレールのUTILSボタンで開閉できる
        cy.get(datatest('btn-utils-mode')).click();
        cy.get(datatest('overlay-utils')).should('not.exist');
        cy.get(datatest('btn-utils-mode')).click();
        cy.get(datatest('overlay-utils')).should('be.visible');

        cy.get(datatest('btn-inspector-close')).click();
        cy.get(datatest('overlay-utils')).should('not.exist');

        // ピンは保存され、再読み込み後も有効。外すと元の閉じ方に戻る
        cy.reload();
        operations.mode.utils.open();
        cy.get(datatest('btn-utils-pin')).should('have.attr', 'aria-pressed', 'true');
        cy.get(datatest('overlay-backdrop-pinned')).should('exist');
        cy.get(datatest('btn-utils-pin')).click();
        cy.get(datatest('btn-utils-pin')).should('have.attr', 'aria-pressed', 'false');
        cy.get(datatest('btn-convert-to-gray')).click();
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

    it('deletes every page except the current one and restores them with one undo', () => {
        visit({ mode: 'edit' });

        operations.mode.block.open();
        operations.mode.block.Gray();
        operations.mode.block.click(0, 0);
        operations.mode.tools.nextPage();
        operations.mode.block.click(1, 0);
        operations.mode.tools.nextPage();
        operations.mode.block.click(2, 0);
        operations.mode.tools.backPage();

        operations.mode.utils.open();
        cy.get(datatest('btn-clear-others')).click();
        cy.get(datatest('overlay-utils')).should('not.exist');

        cy.get(datatest('text-pages')).should('have.text', '1 / 1');
        cy.get(block(0, 0)).should('have.attr', 'color', Color.Gray.Normal);
        cy.get(block(1, 0)).should('have.attr', 'color', Color.Gray.Normal);
        cy.get(block(2, 0)).should('have.attr', 'color', Color.Empty.Normal);

        operations.mode.utils.open();
        cy.get(datatest('btn-clear-others')).should('be.disabled');
        cy.get(datatest('btn-inspector-close')).click();

        // 前後の削除は1回のUndoでまとめて戻り、Redoでまとめてやり直せる
        operations.mode.tools.undo();
        cy.get(datatest('text-pages')).should('have.text', '2 / 3');
        cy.get(block(1, 0)).should('have.attr', 'color', Color.Gray.Normal);
        operations.mode.tools.nextPage();
        cy.get(block(2, 0)).should('have.attr', 'color', Color.Gray.Normal);
        operations.mode.tools.backPage();
        operations.mode.tools.backPage();
        cy.get(block(1, 0)).should('have.attr', 'color', Color.Empty.Normal);

        operations.mode.tools.redo();
        cy.get(datatest('text-pages')).should('have.text', '1 / 1');
        cy.get(block(1, 0)).should('have.attr', 'color', Color.Gray.Normal);
    });

    it('resets every page like New in the menu', () => {
        visit({ mode: 'edit' });

        operations.mode.block.open();
        operations.mode.block.Gray();
        operations.mode.block.click(0, 0);
        operations.mode.tools.nextPage();
        operations.mode.block.click(1, 0);

        operations.mode.utils.open();
        cy.get(datatest('btn-reset-all-pages')).click();
        cy.get(datatest('overlay-utils')).should('not.exist');

        expectFumen('v115@vhAAgH');
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

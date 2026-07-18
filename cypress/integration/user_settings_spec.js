import { Color, datatest, leftTap, mino, Piece, rightTap, Rotation, visit } from '../support/common';
import { operations } from '../support/operations';

describe('User settings', () => {
    it('separates soft and hard drop shortcuts and configures DAS/ARR in frames', () => {
        cy.clearLocalStorage();
        visit({ mode: 'edit' });

        cy.get(datatest('btn-editor-user-settings')).click();
        cy.get(datatest('tab-user-settings-shortcuts')).click();
        cy.get(datatest('input-piece-shortcut-SoftDrop')).should('have.value', '↓');
        cy.get(datatest('input-piece-shortcut-HardDrop')).should('have.value', 'Space');
        cy.get(datatest('input-piece-shortcut-Hold')).should('have.value', 'C');
        cy.get(datatest('input-piece-das')).should('have.value', '10').clear().type('5').blur();
        cy.get(datatest('input-piece-arr')).should('have.value', '1');
        cy.get(datatest('btn-save')).click();

        cy.get('body').trigger('keydown', { code: 'Space', key: ' ' });
        cy.get('body').trigger('keyup', { code: 'Space', key: ' ' });
        cy.get(datatest('text-pages')).should('contain', '2 / 2');

        operations.mode.piece.open();
        operations.mode.piece.spawn.T();
        cy.get(datatest('tray-piece-harddrop')).should('not.be.disabled');
        operations.mode.piece.harddrop();
        cy.get(datatest('text-pages')).should('contain', '3 / 3');
    });

    it('Ghost visible', () => {
        cy.clearLocalStorage();

        visit({});

        // visible -> hidden
        operations.menu.openUserSettings();
        cy.get(datatest('switch-ghost-visible')).should('be.checked');
        cy.get(datatest('switch-ghost-visible')).uncheck({ force: true });
        cy.get(datatest('btn-save')).click();

        // cancel
        operations.menu.openUserSettings();
        cy.get(datatest('switch-ghost-visible')).should('not.be.checked');
        cy.get(datatest('switch-ghost-visible')).check({ force: true });
        cy.get(datatest('btn-cancel')).click();

        // reload
        operations.menu.openUserSettings();
        cy.get(datatest('switch-ghost-visible')).should('not.be.checked');
        cy.get(datatest('switch-ghost-visible')).check({ force: true });

        visit({ reload: true });

        // hidden -> visible
        operations.menu.openUserSettings();
        cy.get(datatest('switch-ghost-visible')).should('not.be.checked');
        cy.get(datatest('switch-ghost-visible')).check({ force: true });
        cy.get(datatest('btn-save')).click();

        // verify
        operations.menu.openUserSettings();
        cy.get(datatest('switch-ghost-visible')).should('be.checked');
    });

    it('Spawn mino deletion while paint dragging', () => {
        cy.clearLocalStorage();
        visit({ mode: 'edit' });

        operations.menu.openUserSettings();
        cy.get(datatest('switch-delete-spawn-mino-on-paint-drag')).should('be.checked');
        cy.get(datatest('switch-delete-spawn-mino-on-paint-drag')).uncheck({ force: true });
        cy.get(datatest('btn-save')).click();

        operations.mode.piece.open();
        operations.mode.piece.spawn.T();
        operations.mode.tools.home();
        cy.get(datatest('btn-piece-empty')).click();
        operations.mode.block.drag({ x: 0, y: 0 }, { x: 4, y: 20 });

        mino(Piece.T, Rotation.Spawn)(4, 20).forEach(selector => {
            cy.get(selector).should('have.attr', 'color', Color.T.Highlight2);
        });

        operations.menu.openUserSettings();
        cy.get(datatest('switch-delete-spawn-mino-on-paint-drag')).should('not.be.checked');
    });

    it('Loop: reader', () => {
        cy.clearLocalStorage();

        visit({ fumen: 'v115@vhF0MJ9NJXDJ2OJzEJi/I' });

        // 移動しないことの確認
        cy.get(datatest('tools')).find(datatest('text-pages')).should('have.text', '1 / 6');
        leftTap();
        cy.get(datatest('tools')).find(datatest('text-pages')).should('have.text', '1 / 6');
        operations.menu.lastPage();
        rightTap();
        cy.get(datatest('tools')).find(datatest('text-pages')).should('have.text', '6 / 6');

        // disable -> enable
        operations.menu.openUserSettings();
        operations.menu.selectUserSettingsTab('misc');
        cy.get(datatest('switch-loop')).should('not.be.checked');
        cy.get(datatest('switch-loop')).check({ force: true });
        cy.get(datatest('btn-save')).click();

        // cancel
        operations.menu.openUserSettings();
        operations.menu.selectUserSettingsTab('misc');
        cy.get(datatest('switch-loop')).should('be.checked');
        cy.get(datatest('switch-loop')).uncheck({ force: true });
        cy.get(datatest('btn-cancel')).click();

        // reload
        operations.menu.openUserSettings();
        operations.menu.selectUserSettingsTab('misc');
        cy.get(datatest('switch-loop')).should('be.checked');
        cy.get(datatest('switch-loop')).uncheck({ force: true });

        visit({ reload: true });

        // 移動することの確認
        cy.get(datatest('tools')).find(datatest('text-pages')).should('have.text', '1 / 6');
        leftTap();
        cy.get(datatest('tools')).find(datatest('text-pages')).should('have.text', '6 / 6');
        rightTap();
        cy.get(datatest('tools')).find(datatest('text-pages')).should('have.text', '1 / 6');

        // enable -> disable
        operations.menu.openUserSettings();
        operations.menu.selectUserSettingsTab('misc');
        cy.get(datatest('switch-loop')).should('be.checked');
        cy.get(datatest('switch-loop')).uncheck({ force: true });
        cy.get(datatest('btn-save')).click();

        // verify
        operations.menu.openUserSettings();
        operations.menu.selectUserSettingsTab('misc');
        cy.get(datatest('switch-loop')).should('not.be.checked');
    });

    it('Loop: editor', () => {
        cy.clearLocalStorage();

        visit({ fumen: 'v115@vhF0MJ9NJXDJ2OJzEJi/I', mode: 'edit' });

        // 移動しないことの確認
        cy.get(datatest('tools')).find(datatest('text-pages')).should('have.text', '1 / 6');
        cy.get(datatest('btn-back-page')).click();
        cy.get(datatest('tools')).find(datatest('text-pages')).should('have.text', '1 / 6');

        operations.menu.loopOn();

        // 移動しないことの確認
        cy.get(datatest('tools')).find(datatest('text-pages')).should('have.text', '1 / 6');
        cy.get(datatest('btn-back-page')).click();
        cy.get(datatest('tools')).find(datatest('text-pages')).should('have.text', '1 / 6');
    });

    it('Open settings directly from editor and list view', () => {
        cy.clearLocalStorage();

        visit({ mode: 'edit' });

        // エディタのツール列から直接開く(フィールドタブが初期表示)
        // パネルは縦に長くCypressの可視判定が中心点基準で誤るため、displayスタイルで判定する
        cy.get(datatest('btn-editor-user-settings')).click();
        cy.get(datatest('mdl-user-settings')).should('be.visible');
        cy.get(datatest('panel-user-settings-field')).should('have.css', 'display', 'block');
        cy.get(datatest('panel-user-settings-view')).should('have.css', 'display', 'none');

        // タブ切替
        cy.get(datatest('tab-user-settings-misc')).click();
        cy.get(datatest('panel-user-settings-misc')).should('have.css', 'display', 'block');
        cy.get(datatest('panel-user-settings-field')).should('have.css', 'display', 'none');

        cy.get(datatest('btn-cancel')).click();
        cy.get(datatest('mdl-user-settings')).should('not.exist');

        // エディタの共有ボタンからImport/Exportモーダルを直接開く
        cy.get(datatest('btn-editor-share')).click();
        cy.get(datatest('mdl-list-view-menu')).should('be.visible');
        cy.get(datatest('btn-cancel')).click();
        cy.get(datatest('mdl-list-view-menu')).should('not.exist');

        // リストビューの右上から開く(リスト/ツリービュータブが初期表示)
        cy.get(datatest('btn-list-view')).click();
        cy.get(datatest('btn-list-view-user-settings')).click();
        cy.get(datatest('mdl-user-settings')).should('be.visible');
        cy.get(datatest('panel-user-settings-view')).should('have.css', 'display', 'block');
        cy.get(datatest('panel-user-settings-field')).should('have.css', 'display', 'none');
        cy.get(datatest('btn-cancel')).click();
        cy.get(datatest('mdl-user-settings')).should('not.exist');
    });

    it('Gray after line clear: tabs stay in sync and setting persists', () => {
        cy.clearLocalStorage();

        visit({ mode: 'edit' });

        cy.get(datatest('btn-editor-user-settings')).click();
        cy.get(datatest('switch-gray-after-line-clear-field')).should('not.be.checked');
        cy.get(datatest('switch-gray-after-line-clear-field')).check({ force: true });

        // 同一設定なのでリスト/ツリービュータブ側も連動する
        cy.get(datatest('switch-gray-after-line-clear-view')).should('be.checked');
        cy.get(datatest('btn-save')).click();

        // 保存後に開き直しても有効のまま
        cy.get(datatest('btn-editor-user-settings')).click();
        cy.get(datatest('switch-gray-after-line-clear-field')).should('be.checked');

        // キャンセルで閉じても保存値は変わらない
        cy.get(datatest('switch-gray-after-line-clear-field')).uncheck({ force: true });
        cy.get(datatest('btn-cancel')).click();
        cy.get(datatest('btn-editor-user-settings')).click();
        cy.get(datatest('switch-gray-after-line-clear-field')).should('be.checked');
        cy.get(datatest('btn-cancel')).click();
    });
});


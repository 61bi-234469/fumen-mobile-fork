import { Color, datatest, leftTap, mino, Piece, rightTap, Rotation, visit } from '../support/common';
import { operations } from '../support/operations';

const initialScreenRadio = (value) => datatest(`radio-initial-screen-${value}`);

describe('User settings', () => {
    it('separates soft and hard drop shortcuts and configures DAS/ARR in frames', () => {
        cy.clearLocalStorage();
        visit({ mode: 'edit' });

        cy.get(datatest('btn-editor-user-settings')).click();
        cy.get(datatest('tab-user-settings-input')).click();
        cy.get(datatest('panel-user-settings-input')).then(panel => {
            const expectedOrder = [
                'input-piece-shortcut-Hold',
                'input-piece-shortcut-Reset',
                'switch-ghost-visible',
                'radio-rotation-system-classic',
                'input-piece-arr',
                'input-piece-das',
                'input-piece-sdf',
                'switch-piece-softdrop-priority',
            ];
            const datatests = Array.from(panel[0].querySelectorAll('[datatest]'));
            const indexes = expectedOrder.map(value => datatests.findIndex(element =>
                element.getAttribute('datatest') === value));
            expect(indexes).to.deep.equal([...indexes].sort((left, right) => left - right));
        });
        cy.get(datatest('input-piece-shortcut-SoftDrop')).should('have.value', '↓');
        cy.get(datatest('input-piece-shortcut-HardDrop')).should('have.value', 'Space');
        cy.get(datatest('input-piece-shortcut-Hold')).should('have.value', 'C');
        cy.get(datatest('input-piece-shortcut-Reset')).prev().should('have.text', 'RESET');
        cy.get(datatest('input-piece-das')).should('have.value', '10').clear().type('5.5').blur();
        cy.get(datatest('input-piece-arr')).should('have.value', '1').clear().type('1.5').blur();
        cy.get(datatest('unit-piece-das')).should('have.text', 'F');
        cy.get(datatest('unit-piece-arr')).should('have.text', 'F');
        cy.get(datatest('label-piece-das')).should('have.text', 'DAS');
        cy.get(datatest('label-piece-arr')).should('have.text', 'ARR');
        cy.get(datatest('label-piece-sdf')).should('have.text', 'SDF');
        // Must stay a visible native select: Materialize FormSelect rewrites the DOM
        // and breaks Hyperapp patching (settings modal fails to close).
        cy.get(datatest('input-piece-sdf')).should('be.visible')
            .and('have.value', 'Infinity').select('10');
        cy.get(datatest('switch-piece-softdrop-priority')).should('not.be.checked')
            .check({ force: true });
        cy.get(datatest('btn-save')).click();

        cy.get(datatest('btn-editor-user-settings')).click();
        cy.get(datatest('tab-user-settings-input')).click();
        cy.get(datatest('input-piece-das')).should('have.value', '5.5');
        cy.get(datatest('input-piece-arr')).should('have.value', '1.5');
        cy.get(datatest('input-piece-sdf')).should('have.value', '10');
        cy.get(datatest('switch-piece-softdrop-priority')).should('be.checked');
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

    it('collapses gradient options by default and expands them on demand', () => {
        cy.clearLocalStorage();
        visit({ mode: 'edit' });

        cy.get(datatest('btn-editor-user-settings')).click();
        cy.get(datatest('details-user-settings-gradient')).should('not.have.attr', 'open');
        cy.get(datatest('gradient-piece-options')).should('not.be.visible');
        cy.get(datatest('summary-user-settings-gradient')).click();
        cy.get(datatest('details-user-settings-gradient')).should('have.attr', 'open');
        // The expanded panel can extend below the fixed modal viewport at the
        // default mobile size. Its display state is the behavior under test;
        // force the radio interaction after that structural assertion.
        cy.get(datatest('gradient-piece-options')).should('have.css', 'display', 'block')
            .find('input[type="radio"]').eq(1).check({ force: true }).should('be.checked');
        cy.get(datatest('btn-cancel')).click();
    });

    it('Ghost visible', () => {
        cy.clearLocalStorage();

        visit({});

        // visible -> hidden
        operations.menu.openUserSettings();
        operations.menu.selectUserSettingsTab('input');
        cy.get(datatest('switch-ghost-visible')).should('be.checked');
        cy.get(datatest('switch-ghost-visible')).uncheck({ force: true });
        cy.get(datatest('btn-save')).click();

        // cancel
        operations.menu.openUserSettings();
        operations.menu.selectUserSettingsTab('input');
        cy.get(datatest('switch-ghost-visible')).should('not.be.checked');
        cy.get(datatest('switch-ghost-visible')).check({ force: true });
        cy.get(datatest('btn-cancel')).click();

        // reload
        operations.menu.openUserSettings();
        operations.menu.selectUserSettingsTab('input');
        cy.get(datatest('switch-ghost-visible')).should('not.be.checked');
        cy.get(datatest('switch-ghost-visible')).check({ force: true });

        visit({ reload: true });

        // hidden -> visible
        operations.menu.openUserSettings();
        operations.menu.selectUserSettingsTab('input');
        cy.get(datatest('switch-ghost-visible')).should('not.be.checked');
        cy.get(datatest('switch-ghost-visible')).check({ force: true });
        cy.get(datatest('btn-save')).click();

        // verify
        operations.menu.openUserSettings();
        operations.menu.selectUserSettingsTab('input');
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
        operations.menu.selectUserSettingsTab('general');
        cy.get(datatest('switch-loop')).parents('.switch').should('not.contain', '[Reader]');
        cy.get(datatest('switch-loop')).should('not.be.checked');
        cy.get(datatest('switch-loop')).check({ force: true });
        cy.get(datatest('btn-save')).click();

        // cancel
        operations.menu.openUserSettings();
        operations.menu.selectUserSettingsTab('general');
        cy.get(datatest('switch-loop')).should('be.checked');
        cy.get(datatest('switch-loop')).uncheck({ force: true });
        cy.get(datatest('btn-cancel')).click();

        // reload
        operations.menu.openUserSettings();
        operations.menu.selectUserSettingsTab('general');
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
        operations.menu.selectUserSettingsTab('general');
        cy.get(datatest('switch-loop')).should('be.checked');
        cy.get(datatest('switch-loop')).uncheck({ force: true });
        cy.get(datatest('btn-save')).click();

        // verify
        operations.menu.openUserSettings();
        operations.menu.selectUserSettingsTab('general');
        cy.get(datatest('switch-loop')).should('not.be.checked');
    });

    it('Loop: editor', () => {
        cy.clearLocalStorage();

        visit({ fumen: 'v115@vhF0MJ9NJXDJ2OJzEJi/I', mode: 'edit' });

        // ループ無効時は端で停止
        cy.get(datatest('tools')).find(datatest('text-pages')).should('have.text', '1 / 6');
        cy.get(datatest('btn-back-page')).click();
        cy.get(datatest('tools')).find(datatest('text-pages')).should('have.text', '1 / 6');

        operations.menu.loopOn();

        // ループ有効時はボタンとショートカットの両方で端から端へ移動
        cy.get(datatest('btn-back-page')).click();
        cy.get(datatest('tools')).find(datatest('text-pages')).should('have.text', '6 / 6');
        cy.get(datatest('btn-next-page')).click();
        cy.get(datatest('tools')).find(datatest('text-pages')).should('have.text', '1 / 6');

        cy.get('body').trigger('keydown', { code: 'Digit1', key: '1' });
        cy.get('body').trigger('keyup', { code: 'Digit1', key: '1' });
        cy.get(datatest('tools')).find(datatest('text-pages')).should('have.text', '6 / 6');
        cy.get('body').trigger('keydown', { code: 'Digit2', key: '2' });
        cy.get('body').trigger('keyup', { code: 'Digit2', key: '2' });
        cy.get(datatest('tools')).find(datatest('text-pages')).should('have.text', '1 / 6');
    });

    it('Open settings directly from editor and list view', () => {
        cy.clearLocalStorage();

        visit({ mode: 'edit' });

        // エディタのツール列から直接開く(フィールドタブが初期表示)
        // パネルは縦に長くCypressの可視判定が中心点基準で誤るため、displayスタイルで判定する
        cy.get(datatest('editor-rail')).find(datatest('btn-editor-user-settings')).should('not.exist');
        cy.get(datatest('tools')).find(datatest('btn-editor-user-settings')).should('be.visible');
        cy.get(datatest('btn-editor-user-settings')).click();
        cy.get(datatest('mdl-user-settings')).should('be.visible');
        cy.get(datatest('switch-delete-spawn-mino-on-paint-drag')).should('be.checked');
        cy.get(datatest('panel-user-settings-edit')).should('have.css', 'display', 'block');
        cy.get(datatest('panel-user-settings-view')).should('have.css', 'display', 'none');
        cy.get(datatest('panel-user-settings-input')).should('have.css', 'display', 'none');

        // タブ切替
        cy.get(datatest('tab-user-settings-input')).click();
        cy.get(datatest('panel-user-settings-input')).should('have.css', 'display', 'block');
        cy.get(datatest('panel-user-settings-edit')).should('have.css', 'display', 'none');

        cy.get(datatest('btn-cancel')).click();
        cy.get(datatest('mdl-user-settings')).should('not.exist');

        // エディタの書き出しボタンからImport/Exportモーダルを直接開く
        cy.get(datatest('btn-editor-export')).click();
        cy.get(datatest('mdl-list-view-menu')).should('be.visible');
        cy.get(datatest('tab-list-view-menu-export')).should('have.attr', 'aria-selected', 'true');
        cy.get(datatest('btn-cancel')).click();
        cy.get(datatest('mdl-list-view-menu')).should('not.exist');

        // リストビューの右上から開く(リスト/ツリービュータブが初期表示)
        cy.get(datatest('btn-list-view')).click();
        cy.get(datatest('btn-list-view-user-settings')).click();
        cy.get(datatest('mdl-user-settings')).should('be.visible');
        cy.get(datatest('panel-user-settings-view')).should('have.css', 'display', 'block');
        cy.get(datatest('panel-user-settings-edit')).should('have.css', 'display', 'none');
        cy.get(datatest('btn-cancel')).click();
        cy.get(datatest('mdl-user-settings')).should('not.exist');
    });

    it('Initial screen: setting persists and controls startup screen', () => {
        cy.clearLocalStorage();

        visit({});

        // デフォルトはReader画面
        cy.get(datatest('btn-writable-in-reader')).should('be.visible');

        operations.menu.openUserSettings();
        operations.menu.selectUserSettingsTab('general');
        cy.get(initialScreenRadio('reader')).should('be.checked');
        cy.get(initialScreenRadio('editor')).check({ force: true });
        cy.get(datatest('btn-save')).click();

        visit({ reload: true });

        // Editor画面で起動する
        cy.get(datatest('btn-editor-user-settings')).should('be.visible');

        operations.menu.openUserSettings();
        operations.menu.selectUserSettingsTab('general');
        cy.get(initialScreenRadio('editor')).should('be.checked');
        cy.get(initialScreenRadio('list')).check({ force: true });
        cy.get(datatest('btn-save')).click();

        // List/Tree画面起動時はKonvaキャンバスを描画しないため、block-0-0を待つ共通visit()は使えない
        cy.reload();

        // List画面で起動する
        cy.get(datatest('list-view-tools')).should('be.visible');
    });

    it('Gray after line clear: tabs stay in sync and setting persists', () => {
        cy.clearLocalStorage();

        visit({ mode: 'edit' });

        cy.get(datatest('btn-editor-user-settings')).click();
        cy.get(datatest('switch-gray-after-line-clear-edit')).should('not.be.checked');
        cy.get(datatest('switch-gray-after-line-clear-edit')).check({ force: true });

        // 同一設定なのでリスト/ツリービュータブ側も連動する
        cy.get(datatest('switch-gray-after-line-clear-view')).should('be.checked');
        cy.get(datatest('btn-save')).click();

        // 保存後に開き直しても有効のまま
        cy.get(datatest('btn-editor-user-settings')).click();
        cy.get(datatest('switch-gray-after-line-clear-edit')).should('be.checked');

        // キャンセルで閉じても保存値は変わらない
        cy.get(datatest('switch-gray-after-line-clear-edit')).uncheck({ force: true });
        cy.get(datatest('btn-cancel')).click();
        cy.get(datatest('btn-editor-user-settings')).click();
        cy.get(datatest('switch-gray-after-line-clear-edit')).should('be.checked');
        cy.get(datatest('btn-cancel')).click();
    });

    it('shows FLAGS setting defaults off and persists the field setting', () => {
        cy.clearLocalStorage();
        visit({ mode: 'edit' });

        cy.get(datatest('btn-flags-mode')).should('not.exist');
        cy.get(datatest('btn-utils-mode'))
            .should('contain.text', 'UTILS')
            .and('have.attr', 'aria-label', 'UTILS');

        cy.get(datatest('btn-editor-user-settings')).click();
        cy.get(datatest('switch-flags-hidden')).should('not.be.checked').check({ force: true });
        cy.get(datatest('btn-save')).click();

        cy.get(datatest('btn-flags-mode')).should('be.visible');
        // 2分割セルは名前を上下に積む。入らないフォントでは両方アイコンだけになる
        cy.get(`${datatest('btn-utils-mode')},${datatest('btn-flags-mode')}`).should((cells) => {
            const utils = cells.filter(datatest('btn-utils-mode'))[0];
            const flags = cells.filter(datatest('btn-flags-mode'))[0];
            expect(flags.textContent.includes('FLAGS')).to.equal(utils.textContent.includes('UTILS'));
            expect(utils.getAttribute('aria-label')).to.equal('Utilities');
            expect(flags.getAttribute('aria-label')).to.equal('Flags');
        });

        // Cancel does not roll back a previously saved value or change the rail.
        cy.get(datatest('btn-editor-user-settings')).click();
        cy.get(datatest('switch-flags-hidden')).should('be.checked').uncheck({ force: true });
        cy.get(datatest('btn-cancel')).click();
        cy.get(datatest('btn-flags-mode')).should('be.visible');

        // Reload restores the saved visible state.
        visit({ mode: 'edit', reload: true });
        cy.get(datatest('btn-flags-mode')).should('be.visible');

        cy.get(datatest('btn-editor-user-settings')).click();
        cy.get(datatest('switch-flags-hidden')).should('be.checked').uncheck({ force: true });
        cy.get(datatest('btn-save')).click();
        cy.get(datatest('btn-flags-mode')).should('not.exist');
    });

    it('shows the PAINT mino design setting defaults off and persists it', () => {
        cy.clearLocalStorage();
        visit({ mode: 'edit' });

        cy.get(datatest('btn-piece-i')).find('[data-palette-swatch="mino"]').should('have.text', 'I');
        cy.get(datatest('btn-piece-i')).find('img').should('not.exist');

        cy.get(datatest('btn-editor-user-settings')).click();
        cy.get(datatest('switch-paint-palette-mino-design')).should('not.be.checked').check({ force: true });
        cy.get(datatest('btn-save')).click();

        cy.get(datatest('btn-piece-i')).find('[data-palette-swatch="mino-image"]').should('exist');
        cy.get(datatest('btn-piece-i')).find('[data-palette-swatch="mino"]').should('not.exist');

        // Cancel does not roll back a previously saved value or change the palette.
        cy.get(datatest('btn-editor-user-settings')).click();
        cy.get(datatest('switch-paint-palette-mino-design')).should('be.checked').uncheck({ force: true });
        cy.get(datatest('btn-cancel')).click();
        cy.get(datatest('btn-piece-i')).find('[data-palette-swatch="mino-image"]').should('exist');

        // Reload restores the saved mino design.
        visit({ mode: 'edit', reload: true });
        cy.get(datatest('btn-piece-i')).find('[data-palette-swatch="mino-image"]').should('exist');

        cy.get(datatest('btn-editor-user-settings')).click();
        cy.get(datatest('switch-paint-palette-mino-design')).should('be.checked').uncheck({ force: true });
        cy.get(datatest('btn-save')).click();
        cy.get(datatest('btn-piece-i')).find('img').should('not.exist');
        cy.get(datatest('btn-piece-i')).find('[data-palette-swatch="mino"]').should('have.text', 'I');
    });

    it('defaults page rotation to no limit and persists the page count', () => {
        cy.clearLocalStorage();
        visit({ mode: 'edit' });

        cy.get(datatest('btn-editor-user-settings')).click();
        cy.get(datatest('tab-user-settings-general')).click();
        // 「ページローテーション」→説明文→ページ数の順に並べ、トグルは持たない
        cy.get(datatest('panel-user-settings-general')).then(panel => {
            const order = ['label-page-rotation-limit', 'input-page-rotation-limit'];
            const datatests = Array.from(panel[0].querySelectorAll('[datatest]'));
            const indexes = order.map(value => datatests.findIndex(element =>
                element.getAttribute('datatest') === value));
            expect(indexes.every(index => index >= 0)).to.equal(true);
            expect(indexes).to.deep.equal([...indexes].sort((left, right) => left - right));
            expect(panel[0].querySelectorAll('input[type="checkbox"][datatest*="page-rotation"]')).to.have.length(0);
        });
        cy.get(datatest('input-page-rotation-limit')).should('have.value', '0');
        cy.get(datatest('unit-page-rotation-limit')).should('not.be.empty');

        // 上限を超える値は保持可能な最大値まで引き下げる
        cy.get(datatest('input-page-rotation-limit')).clear().type('5000').blur();
        cy.get(datatest('btn-save')).click();

        cy.get(datatest('btn-editor-user-settings')).click();
        cy.get(datatest('tab-user-settings-general')).click();
        cy.get(datatest('input-page-rotation-limit')).should('have.value', '999').clear().type('25').blur();
        cy.get(datatest('btn-save')).click();

        // Reload restores the saved value.
        visit({ mode: 'edit', reload: true });
        cy.get(datatest('btn-editor-user-settings')).click();
        cy.get(datatest('tab-user-settings-general')).click();
        cy.get(datatest('input-page-rotation-limit')).should('have.value', '25');

        // Cancel does not roll back a previously saved value.
        cy.get(datatest('input-page-rotation-limit')).clear().type('7').blur();
        cy.get(datatest('btn-cancel')).click();
        cy.get(datatest('btn-editor-user-settings')).click();
        cy.get(datatest('tab-user-settings-general')).click();
        cy.get(datatest('input-page-rotation-limit')).should('have.value', '25');
        cy.get(datatest('btn-cancel')).click();
    });
});


describe('User settings appearance', () => {
    const BLUE = 'rgb(25, 118, 210)';
    const pseudo = (element, name, property) => getComputedStyle(element, name).getPropertyValue(property);

    // :hover と :active は合成イベントでは付かないため、CDP で実際のマウスを動かす。
    // 座標はランナーの画面基準なので、AUT の iframe の位置と縮小率で変換する
    const dispatchMouse = (type, x, y) => Cypress.automation('remote:debugger:protocol', {
        command: 'Input.dispatchMouseEvent',
        params: {
            type,
            x,
            y,
            button: type === 'mouseMoved' ? 'none' : 'left',
            clickCount: type === 'mouseMoved' ? 0 : 1,
        },
    });

    // 押下の確認に失敗しても、左ボタンが押されたまま次のテストに残らないよう記録しておく
    let pressedAt = null;

    const realMouse = (selector, type) => cy.get(selector).scrollIntoView().then(([element]) => {
        const frame = window.top.document.querySelector('iframe.aut-iframe');
        const frameRect = frame.getBoundingClientRect();
        const scale = frameRect.width / frame.clientWidth;
        const rect = element.getBoundingClientRect();
        const x = frameRect.left + (rect.left + rect.width / 2) * scale;
        const y = frameRect.top + (rect.top + rect.height / 2) * scale;
        pressedAt = type === 'mousePressed' ? { x, y } : type === 'mouseReleased' ? null : pressedAt;
        return dispatchMouse(type, x, y);
    });

    afterEach(() => {
        if (pressedAt !== null) {
            const { x, y } = pressedAt;
            pressedAt = null;
            cy.wrap(dispatchMouse('mouseReleased', x, y));
        }
    });

    beforeEach(() => cy.clearLocalStorage());

    it('opens on the View tab from the Reader gear', () => {
        visit({});
        cy.get(datatest('tools')).find(datatest('btn-reader-user-settings')).click();
        cy.get(datatest('mdl-user-settings')).should('be.visible');
        cy.get(datatest('panel-user-settings-view')).should('have.css', 'display', 'block');
        cy.get(datatest('panel-user-settings-edit')).should('have.css', 'display', 'none');
        cy.get(datatest('btn-cancel')).click();
        cy.get(datatest('mdl-user-settings')).should('not.exist');
    });

    it('lays out switches as single rows with one blue accent', () => {
        cy.viewport(375, 667);
        visit({ lng: 'ja' });
        cy.get(datatest('btn-reader-user-settings')).click();
        cy.get(datatest('mdl-user-settings')).should('be.visible');

        // タブ名が切れず、ヘッダーに横スクロールが出ない
        cy.get(datatest('tab-user-settings-keys')).should('have.text', 'キー設定')
            .parent().should(([header]) => {
                expect(header.scrollWidth).to.be.at.most(header.clientWidth);
            });

        // 見出しは小さく、注意書きはモーダルの一番下
        cy.get(datatest('mdl-user-settings')).find('.modal-content').should(([content]) => {
            expect(getComputedStyle(content.firstElementChild).fontSize).to.equal('20px');
            expect(content.lastElementChild.getAttribute('datatest')).to.equal('user-settings-notice');
            expect(getComputedStyle(content.lastElementChild).fontSize).to.equal('12px');
        });

        // 「無効／有効」はどのスイッチにも出さず、ソフトドロップ優先だけ左右の名前を残す
        cy.get(datatest('mdl-user-settings')).find('.switch input[type=checkbox]').should('have.length.greaterThan', 5)
            .each(([input]) => {
                const text = input.closest('label').textContent.trim();
                if (input.getAttribute('datatest') === 'switch-piece-softdrop-priority') {
                    expect(text).to.contain('横移動優先').and.contain('ソフトドロップ優先');
                } else {
                    expect(text, input.getAttribute('datatest')).to.equal('');
                }
            });

        // 名前を押しても切り替わる
        cy.get(datatest('tab-user-settings-general')).click();
        cy.get(datatest('switch-loop')).should('not.be.checked');
        cy.get('label[for="user-settings-switch-loop"]').click();
        cy.get(datatest('switch-loop')).should('be.checked');

        // 強調色は青に揃え、チェックなし・無効のスイッチは Materialize の色のまま
        cy.get(datatest('switch-loop')).siblings('.lever').should(([lever]) => {
            expect(getComputedStyle(lever).backgroundColor).to.equal('rgb(144, 202, 249)');
            expect(pseudo(lever, '::after', 'background-color')).to.equal(BLUE);
        });
        cy.get(datatest('tab-user-settings-general')).should(([tab]) => {
            expect(getComputedStyle(tab).color).to.equal(BLUE);
            expect(getComputedStyle(tab).borderBottomColor).to.equal(BLUE);
        });
        cy.get(datatest('btn-save')).should('not.have.class', 'red')
            .and('have.css', 'background-color', BLUE);
        realMouse(datatest('btn-save'), 'mouseMoved');
        cy.get(datatest('btn-save')).should('have.css', 'background-color', 'rgb(21, 101, 192)');
        realMouse(datatest('tab-user-settings-general'), 'mouseMoved');
        cy.get(datatest('btn-save')).should('have.css', 'background-color', BLUE);
        cy.get(datatest('btn-save')).focus().should('have.css', 'background-color', 'rgb(21, 101, 192)');
        cy.get(datatest('btn-save')).blur();

        // 操作中（押している間）とキーボードでのフォーカス時の波紋も青
        realMouse(`${datatest('switch-loop')} ~ .lever`, 'mousePressed');
        cy.get(datatest('switch-loop')).siblings('.lever').should(([lever]) => {
            expect(pseudo(lever, '::before', 'background-color')).to.equal('rgba(25, 118, 210, 0.15)');
        });
        realMouse(`${datatest('switch-loop')} ~ .lever`, 'mouseReleased');
        cy.get(datatest('switch-loop')).check({ force: true });
        cy.get(datatest('switch-loop')).then(([input]) => {
            input.classList.add('tabbed');
            input.focus();
        });
        cy.get(datatest('switch-loop')).siblings('.lever').should(([lever]) => {
            expect(pseudo(lever, '::before', 'background-color')).to.equal('rgba(25, 118, 210, 0.15)');
        });
        cy.get(datatest('switch-loop')).blur();

        cy.get(datatest('switch-loop')).uncheck({ force: true });
        cy.get(datatest('switch-loop')).siblings('.lever').should(([lever]) => {
            expect(getComputedStyle(lever).backgroundColor).to.equal('rgba(0, 0, 0, 0.38)');
            expect(pseudo(lever, '::after', 'background-color')).to.equal('rgb(241, 241, 241)');
        });
        cy.get(datatest('switch-loop')).check({ force: true }).invoke('prop', 'disabled', true);
        cy.get(datatest('switch-loop')).siblings('.lever').should(([lever]) => {
            expect(getComputedStyle(lever).backgroundColor).to.equal('rgb(132, 199, 193)');
            expect(pseudo(lever, '::after', 'background-color')).to.equal('rgb(148, 148, 148)');
        });

        cy.get(datatest('btn-cancel')).click();
        cy.get(datatest('mdl-user-settings')).should('not.exist');
    });
});

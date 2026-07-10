import { datatest, visit } from '../support/common';
import { operations } from '../support/operations';

// エディットモード左サイドパネル（リスト/ツリー）
// デフォルトの viewport はモバイル相当 (375x667) のため、PC 相当に広げてから検証する。
describe('Editor side panel', () => {
    it('resizes from the divider, persists the width, and resets to automatic width', () => {
        cy.viewport(1280, 800);
        cy.clearLocalStorage();
        visit({ mode: 'edit', mobile: false });
        operations.editorPanel.enable();

        cy.get(datatest('editor-side-panel')).then(($panel) => {
            const automaticWidth = $panel[0].getBoundingClientRect().width;
            const dividerX = $panel[0].getBoundingClientRect().right;
            const resizedWidth = automaticWidth - 180;

            cy.get(datatest('editor-side-panel-resize-handle'))
                .trigger('mousedown', { button: 0, clientX: dividerX, force: true });
            cy.document().trigger('mousemove', { clientX: dividerX - 180, force: true });
            cy.document().trigger('mouseup', { clientX: dividerX - 180, force: true });

            cy.get(datatest('editor-side-panel')).should(($resizedPanel) => {
                expect($resizedPanel[0].getBoundingClientRect().width).to.be.closeTo(resizedWidth, 1);
            });

            visit({ mode: 'edit', mobile: false, reload: true });
            cy.get(datatest('editor-side-panel')).should(($persistedPanel) => {
                expect($persistedPanel[0].getBoundingClientRect().width).to.be.closeTo(resizedWidth, 1);
            });

            cy.get(datatest('editor-side-panel-resize-handle')).dblclick({ force: true });
            cy.get(datatest('editor-side-panel')).should(($resetPanel) => {
                expect($resetPanel[0].getBoundingClientRect().width).to.be.closeTo(automaticWidth, 1);
            });
        });
    });

    it('is hidden by default, toggles via user settings, persists, and auto-hides on narrow widths', () => {
        cy.viewport(1280, 800);
        cy.clearLocalStorage();
        visit({ mode: 'edit', mobile: false });

        // デフォルト OFF: パネルは存在しない
        cy.get(datatest('editor-side-panel')).should('not.exist');

        // ユーザー設定 View タブで ON にするとパネルが表示される
        operations.editorPanel.enable();
        cy.get(datatest('editor-side-panel')).should('be.visible');
        cy.get(datatest('editor-panel-tab-list')).should('be.visible');
        cy.get(datatest('editor-panel-tab-tree')).should('be.visible');

        // リロード後も ON が維持される (localStorage)
        visit({ mode: 'edit', mobile: false, reload: true });
        cy.get(datatest('editor-side-panel')).should('be.visible');

        // 幅が閾値 (1024px) 未満になると自動非表示、戻すと再表示
        cy.viewport(900, 700);
        cy.get(datatest('editor-side-panel')).should('not.exist');
        cy.viewport(1280, 800);
        cy.get(datatest('editor-side-panel')).should('be.visible');

        // OFF に戻すとパネルが消える
        operations.editorPanel.disable();
        cy.get(datatest('editor-side-panel')).should('not.exist');
    });

    it('list tab: jumps to the clicked page, syncs comment edits, and reorders by drag & drop', () => {
        cy.viewport(1280, 800);
        cy.clearLocalStorage();
        visit({ mode: 'edit', mobile: false, fumen: 'v115@vhF0MJ9NJXDJ2OJzEJi/I' });

        operations.editorPanel.enable();
        cy.get(datatest('editor-side-panel')).should('be.visible');

        // パネルが広いときも通常のリストビューと同じ最大160pxのカードを
        // 折り返して並べ、2列へ引き伸ばさない。
        cy.get(datatest('list-view-item-0')).then(($first) => {
            const firstRect = $first[0].getBoundingClientRect();
            expect(firstRect.width).to.be.closeTo(160, 1);
            cy.get(datatest('list-view-item-2')).should(($third) => {
                expect($third[0].getBoundingClientRect().top).to.be.closeTo(firstRect.top, 1);
            });
        });

        // 現在ページのハイライトが表示される (初期は 1 ページ目)
        cy.get(datatest('list-view-item-0'))
            .should('have.css', 'border-top-color', 'rgb(37, 99, 235)');

        // ページ番号クリックで盤面がジャンプする（画面遷移しない）
        cy.get(datatest('list-view-item-2')).contains('#3').click();
        cy.get(datatest('tools')).find(datatest('text-pages')).should('have.text', '3 / 6');
        cy.get(datatest('editor-side-panel')).should('be.visible');
        cy.get(datatest('list-view-item-2'))
            .should('have.css', 'border-top-color', 'rgb(37, 99, 235)');

        // 現在ページのコメント編集がエディタ下部のコメント欄に反映される
        cy.get(datatest('list-view-item-2')).find('textarea').type('hello', { force: true });
        cy.get(datatest('text-comment')).should('have.value', 'hello');

        // D&D 並べ替え: 1 ページ目を 3 ページ目の後ろへ移動
        // (各 trigger 後は再レンダリング済みの UI を should で待ってから次へ進める)
        const dataTransfer = new DataTransfer();
        cy.get(datatest('list-view-item-0')).trigger('dragstart', { dataTransfer, force: true });
        cy.get(datatest('list-view-item-0')).should('have.css', 'opacity', '0.5');
        cy.get(datatest('list-view-item-2')).trigger('dragover', 'right', { dataTransfer, force: true });
        cy.get(datatest('list-view-item-3')).find(datatest('drop-indicator-left')).should('exist');
        cy.get(datatest('list-view-item-2')).trigger('drop', { dataTransfer, force: true });
        cy.get(datatest('list-view-item-0')).trigger('dragend', { force: true });

        // 移動先 (index 2) が現在ページになる
        cy.get(datatest('tools')).find(datatest('text-pages')).should('have.text', '3 / 6');
        // 元の 1 ページ目 (コメントなし) が 3 番目に移動し、'hello' は 2 番目に繰り上がる
        cy.get(datatest('list-view-item-1')).find('textarea').should('have.value', 'hello');
        cy.get(datatest('list-view-item-2')).find('textarea').should('have.value', '');
    });

    it('tree tab: enables tree mode, inserts/deletes nodes with undo toast, and jumps by node click', () => {
        cy.viewport(1280, 800);
        cy.clearLocalStorage();
        visit({ mode: 'edit', mobile: false, fumen: 'v115@vhAAgH' });

        operations.editorPanel.enable();
        operations.editorPanel.selectTab('tree');

        // ツリーモード無効時は有効化ボタンが表示される
        cy.get(datatest('editor-panel-enable-tree')).click();
        cy.get('[datatest^="tree-node-"]').should('have.length', 1);

        // INSERT ボタンでノードを 2 つ追加
        cy.get('svg circle[fill="#10B981"]').last().click({ force: true });
        cy.get('[datatest^="tree-node-"]').should('have.length', 2);
        cy.get('svg circle[fill="#10B981"]').last().click({ force: true });
        cy.get('[datatest^="tree-node-"]').should('have.length', 3);
        cy.get(datatest('tools')).find(datatest('text-pages')).should('have.text', '3 / 3');

        // ノードのページ番号クリックで盤面がジャンプする（画面遷移しない）
        cy.get('[datatest^="tree-page-link-"]').first().click({ force: true });
        cy.get(datatest('tools')).find(datatest('text-pages')).should('have.text', '1 / 3');
        cy.get(datatest('editor-side-panel')).should('be.visible');

        // 削除 + Undo トースト
        cy.get('[datatest^="btn-tree-node-delete-"]').last().click({ force: true });
        cy.get('[datatest^="tree-node-"]').should('have.length', 2);
        cy.get('[datatest="btn-tree-delete-undo"]').click();
        cy.get('[datatest^="tree-node-"]').should('have.length', 3);

        // ズームコントロールが表示され、スケール表示が変わる
        cy.get(datatest('btn-tree-zoom-reset')).should('have.text', '100%');
        cy.get(datatest('btn-tree-zoom-in')).click();
        cy.get(datatest('btn-tree-zoom-reset')).should('have.text', '120%');
        cy.get(datatest('btn-tree-zoom-reset')).click();
        cy.get(datatest('btn-tree-zoom-reset')).should('have.text', '100%');

        // リストタブへ戻ると、ツリーモード中は並べ替え不可のままリストが表示される
        operations.editorPanel.selectTab('list');
        cy.get(datatest('list-view-item-0')).should('exist');
    });
});

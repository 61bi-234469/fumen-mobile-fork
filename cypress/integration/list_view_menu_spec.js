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

            it('shows split Import and Export buttons and no legacy combined button', () => {
                operations.menu.open();
                cy.get(datatest('btn-list-menu-import')).should('be.visible')
                    .find('.material-icons').should('contain.text', 'file_download');
                cy.get(datatest('btn-list-menu-export')).should('be.visible')
                    .find('.material-icons').should('contain.text', 'file_upload');
                cy.get(datatest('btn-list-menu')).should('not.exist');
                cy.get(datatest('btn-external-site')).should('not.exist');
            });

            it('opens the matching window directly from the Menu buttons', () => {
                operations.menu.import();
                cy.get(datatest('mdl-list-view-menu')).should('have.attr', 'data-menu', 'import');
                cy.get(datatest('btn-cancel')).click();

                operations.menu.export();
                cy.get(datatest('mdl-list-view-menu')).should('have.attr', 'data-menu', 'export');
                cy.get(datatest('btn-cancel')).click();
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
        operations.listView.expandOtherSites();
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
        operations.listView.expandOtherSites();
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
        operations.listView.expandOtherSites();
        cy.get(datatest('btn-export-fumen-for-mobile')).click();

        cy.get('@windowOpen').then((windowOpen) => {
            const url = windowOpen.getCall(0).args[0];
            expect(url).to.include('https://knewjade.github.io/fumen-for-mobile/#?d=v115@');
        });
    });

    it('opens tetgram with a percent-encoded v115 payload', () => {
        visit({ mode: 'edit', fumen: 'v115@vhAAgH' });
        cy.wait(300);

        cy.window().then((win) => {
            cy.stub(win, 'open').as('windowOpen');
        });

        operations.menu.importExport();
        operations.listView.expandOtherSites();
        cy.get(datatest('btn-export-tetgram-url')).click();

        cy.get('@windowOpen').then((windowOpen) => {
            const url = windowOpen.getCall(0).args[0];
            expect(url).to.include('https://tetristemplate.info/tetgram/?d=v115%40');
        });
    });

    it('opens the matching window directly from split import/export buttons', () => {
        visit({ mode: 'edit', fumen: 'v115@vhAAgH' });
        cy.wait(300);

        cy.get(datatest('btn-editor-import')).click();
        cy.get(datatest('mdl-list-view-menu')).should('have.attr', 'data-menu', 'import');
        cy.get(datatest('btn-import')).should('be.visible');
        cy.get(datatest('btn-cancel')).click();

        cy.get(datatest('btn-editor-export')).click();
        cy.get(datatest('mdl-list-view-menu')).should('have.attr', 'data-menu', 'export');
        cy.get(datatest('btn-export-image')).should('be.visible');
        cy.get(datatest('btn-cancel')).click();

        cy.get(datatest('btn-list-view')).click();
        operations.listView.openImport();
        cy.get(datatest('mdl-list-view-menu')).should('have.attr', 'data-menu', 'import');
        cy.get(datatest('btn-import')).should('be.visible');
    });

    it('copies tetgram RawData with the page shape and layout fields', () => {
        visit({ mode: 'edit', fumen: 'v115@vhAAgH' });
        cy.wait(300);

        operations.menu.importExport();
        operations.listView.expandOtherSites();
        cy.get(datatest('btn-export-tetgram')).click();
        cy.get(datatest('copied-tetgram-raw')).should('have.attr', 'data').then((data) => {
            const raw = JSON.parse(data);
            expect(raw.pages).to.have.length(1);
            expect(raw.pages[0]).to.have.length(22);
            expect(raw.pages[0][0]).to.have.length(10);
            expect(raw.listLayout).to.deep.equal({ perPage: {}, cols: 5 });
        });
    });

    it('shows export and import as separate windows without tabs', () => {
        visit({ mode: 'edit', fumen: 'v115@vhAAgH', lng: 'ja' });
        cy.wait(300);

        operations.menu.export();
        cy.get(datatest('mdl-list-view-menu')).should('have.attr', 'data-menu', 'export');
        cy.get(datatest('mdl-list-view-menu')).find('[role="tab"]').should('not.exist');
        cy.get(datatest('list-view-menu-title')).should('have.text', '書き出し');
        // ツリーが無効なときは範囲を選べないので、題名の右にページ数だけを出す
        cy.get(datatest('scope-summary-all')).should('have.text', '全1ページ');
        cy.get(datatest('export-scope')).should('not.exist');
        cy.get(datatest('btn-import')).should('not.exist');

        // 共有・画像・他のサイトの順。塗りボタンは「URLをコピー」だけ
        cy.get(datatest('section-export')).should('contain.text', '共有');
        cy.get(datatest('btn-copy-url')).should('contain.text', 'URLをコピー').and('have.class', 'btn');
        cy.get(datatest('btn-export-fumen')).should('contain.text', 'テト譜をコピー').and('not.have.class', 'btn');
        cy.get(datatest('section-image')).should('contain.text', '画像');
        ['btn-export-image', 'btn-export-gif'].forEach((button) => {
            cy.get(datatest(button)).should('be.visible').and('not.have.class', 'btn');
        });
        cy.get(datatest('mdl-list-view-menu')).find('.btn.red').should('have.length', 1);

        // 細かい設定とほかのサイトは折りたたみで、初めは閉じている
        cy.get(datatest('image-display-options')).should('not.have.attr', 'open');
        cy.get(datatest('toggle-export-page-numbers')).should('not.be.visible');
        cy.get(datatest('section-external')).should('not.have.attr', 'open');
        cy.get(datatest('btn-export-fumen-zui')).should('not.be.visible');
        cy.get(datatest('other-sites-summary')).should('have.text', '他のサイトで開く');

        operations.listView.expandImageOptions();
        cy.get(datatest('toggle-export-page-numbers')).should('be.checked')
            .next('span').should('contain.text', 'ページ番号を表示');
        cy.get(datatest('toggle-export-comments')).should('be.checked')
            .next('span').should('contain.text', 'コメントを表示');
        cy.get(datatest('input-gif-frame-delay')).should('have.value', '500')
            .parent().should('contain.text', 'GIFの間隔').and('contain.text', 'ms/ページ');

        operations.listView.expandOtherSites();
        [
            ['btn-export-url', '共有URL', 'link'],
            ['btn-export-fumen-zui', '連続テト譜エディタ', 'open_in_new'],
            ['btn-export-external-site', '連続テト譜エディタ (LIST)', 'open_in_new'],
            ['btn-export-fumen-for-mobile', 'Fumen for mobile', 'open_in_new'],
            ['btn-export-tetgram-url', 'tetgram', 'open_in_new'],
        ].forEach(([button, label, icon]) => {
            cy.get(datatest(button)).should('be.visible').and('contain.text', label);
            cy.get(datatest(button)).find('.material-icons').should('contain.text', icon);
        });
        // tetgram の raw コピーは tetgram の行に並ぶ
        cy.get(datatest('btn-export-tetgram-url')).parent().find(datatest('btn-export-tetgram'))
            .should('contain.text', 'rawをコピー');
        cy.get(datatest('hint-tetgram-url')).should('not.exist');
        cy.get(datatest('badge-tetgram-raw-tree')).should('not.exist');
        cy.get(datatest('switch-shorten-urls')).should('not.be.checked')
            .next('span').should('contain.text', 'TinyURLで短縮する');

        cy.get(datatest('mdl-list-view-menu')).then(($modal) => {
            const ids = Array.from($modal[0].querySelectorAll('[datatest]'))
                .map(element => element.getAttribute('datatest'));
            expect(ids.indexOf('section-export')).to.be.lessThan(ids.indexOf('section-image'));
            expect(ids.indexOf('section-image')).to.be.lessThan(ids.indexOf('section-external'));
            expect(ids.indexOf('btn-export-tetgram-url')).to.be.lessThan(ids.indexOf('btn-export-tetgram'));
            expect(ids.indexOf('btn-export-tetgram')).to.be.lessThan(ids.indexOf('switch-shorten-urls'));
        });

        // 折りたたみの開閉は次に開いたときも保つ
        cy.get(datatest('btn-cancel')).click();
        cy.reload();
        operations.menu.export();
        cy.get(datatest('image-display-options')).should('have.attr', 'open');
        cy.get(datatest('section-external')).should('have.attr', 'open');
        cy.get(datatest('btn-cancel')).click();

        operations.menu.import();
        cy.get(datatest('mdl-list-view-menu')).should('have.attr', 'data-menu', 'import');
        cy.get(datatest('list-view-menu-title')).should('have.text', '取り込み');
        cy.get(datatest('btn-export-image')).should('not.exist');
        cy.get(datatest('scope-summary-all')).should('not.exist');
        cy.get(datatest('section-read')).should('contain.text', 'クリップボードから');
        cy.get(datatest('btn-import'))
            .should('contain.text', '置き換え')
            .and('have.class', 'btn')
            .find('.material-icons').should('contain.text', 'move_to_inbox');
        cy.get(datatest('btn-add'))
            .should('contain.text', '末尾に追加')
            .and('not.have.class', 'btn')
            .find('.material-icons').should('contain.text', 'add');
    });

    it('persists image metadata visibility and exposes it in tree export', () => {
        visit({ mode: 'edit', fumen: 'v115@vhAAgH', lng: 'ja' });
        operations.menu.export();
        operations.listView.setExportMetadata({ pageNumbers: false, comments: false });
        cy.get(datatest('btn-cancel')).click();

        cy.reload();
        cy.get(datatest('btn-list-view')).click();
        cy.get('[title="Enable tree mode"], [title="ツリーモードを有効にする"]').click();
        cy.get('[title="Show pages in tree view"], [title="ページをTree表示に切り替え"]').click();
        operations.listView.openExport();

        operations.listView.expandImageOptions();
        cy.get(datatest('toggle-export-page-numbers')).should('not.be.checked');
        cy.get(datatest('toggle-export-comments')).should('not.be.checked');
    });

    it('shows accurate page counts for the tree export scope', () => {
        visit({ mode: 'edit', fumen: 'v115@vhAAgH', lng: 'ja' });
        cy.get(datatest('btn-list-view')).click();
        cy.get('[title="Enable tree mode"], [title="ツリーモードを有効にする"]').click();
        cy.get('[title="Show pages in tree view"], [title="ページをTree表示に切り替え"]').click();

        cy.get('svg circle[fill="#10B981"]').last().click({ force: true });
        cy.get('[datatest^="tree-node-"]').should('have.length', 2);
        cy.get('svg circle[fill="#10B981"]').last().click({ force: true });
        cy.get('[datatest^="tree-node-"]').should('have.length', 3);

        operations.listView.openExport();
        // ツリー有効時は題名の右に小さな範囲の切り替えを出し、ページ数は各選択肢に含める。
        // 下の操作ボタンと見分けられるよう、横いっぱいには広げない
        cy.get(datatest('scope-summary-all')).should('not.exist');
        cy.get(datatest('export-scope')).should('have.attr', 'aria-label', '書き出すページ')
            .and('have.attr', 'role', 'radiogroup');
        cy.get(datatest('list-view-menu-title')).then(($title) => {
            const title = $title[0].getBoundingClientRect();
            cy.get(datatest('export-scope')).should(($scope) => {
                const scope = $scope[0].getBoundingClientRect();
                expect(scope.left).to.be.greaterThan(title.right);
                expect(scope.top).to.be.lessThan(title.bottom);
            });
        });
        cy.get(datatest('export-scope')).then(($scope) => {
            cy.get(datatest('btn-copy-url')).parent().should(($row) => {
                expect($scope[0].getBoundingClientRect().width).to.be.lessThan($row[0].getBoundingClientRect().width);
            });
        });
        cy.get(datatest('btn-scope-all')).should('contain.text', 'すべて（3）');
        cy.get(datatest('btn-scope-left'))
            .should('contain.text', '選択まで（3）')
            .click();
        cy.get(datatest('mdl-list-view-menu')).should('be.visible');
        cy.get(datatest('btn-scope-left')).should('have.attr', 'aria-checked', 'true')
            .and('have.css', 'background-color', 'rgb(255, 255, 255)');
        cy.get(datatest('btn-scope-all')).should('have.attr', 'aria-checked', 'false');
    });

    it('shows the tree notes on the tetgram buttons only while tree mode is enabled', () => {
        visit({ mode: 'edit', fumen: 'v115@vhAAgH', lng: 'ja' });
        cy.get(datatest('btn-list-view')).click();
        cy.get('[title="Enable tree mode"], [title="ツリーモードを有効にする"]').click();
        cy.get('[title="Show pages in tree view"], [title="ページをTree表示に切り替え"]').click();

        operations.listView.openExport();
        operations.listView.expandOtherSites();
        cy.get(datatest('btn-export-tetgram'))
            .find(datatest('badge-tetgram-raw-tree'))
            .should('contain.text', 'ツリー構造を含む');
        cy.get(datatest('hint-tetgram-url')).scrollIntoView()
            .should('be.visible')
            .and('contain.text', 'ツリー構造は含まれません');
    });

    it('imports tetgram RawData through the existing clipboard button', () => {
        const emptyPage = () => Array.from({ length: 22 }, () => Array(10).fill(0));
        const rawData = JSON.stringify({
            pages: [emptyPage()],
            comments: ['imported from tetgram'],
            actions: [null],
            listLayout: { perPage: { 0: { row: 'A', col: '1' } }, cols: 1 },
        });

        visit({ mode: 'edit', fumen: 'v115@vhAAgH' });
        cy.wait(300);
        cy.window().then((win) => {
            Object.defineProperty(win.navigator, 'clipboard', {
                configurable: true,
                value: { readText: () => Promise.resolve(rawData) },
            });
        });

        operations.menu.import();
        cy.get(datatest('btn-import')).click();
        cy.get('[title="Disable tree mode"]').should('be.visible');
        cy.get('[datatest^="tree-node-"]').should('have.length', 1);
    });

    it('uses the modal tetgram RawData flows for short and long Ctrl+V', () => {
        const emptyPage = () => Array.from({ length: 22 }, () => Array(10).fill(0));
        const rawData = JSON.stringify({
            pages: [emptyPage()],
            comments: ['imported by shortcut'],
            actions: [null],
            listLayout: { perPage: {}, cols: 5 },
        });

        visit({ mode: 'edit', fumen: 'v115@vhAAgH' });
        cy.window().then((win) => {
            Object.defineProperty(win.navigator, 'clipboard', {
                configurable: true,
                value: { readText: () => Promise.resolve(rawData) },
            });
        });

        cy.get('body')
            .trigger('keydown', { code: 'KeyV', ctrlKey: true, key: 'v' })
            .trigger('keyup', { code: 'KeyV', ctrlKey: true, key: 'v' });
        cy.get(datatest('text-pages')).should('have.text', '2 / 2');

        cy.get('body').trigger('keydown', { code: 'KeyV', ctrlKey: true, key: 'v' });
        cy.wait(550);
        cy.get('body').trigger('keyup', { code: 'KeyV', ctrlKey: true, key: 'v' });
        cy.get(datatest('text-pages')).should('have.text', '1 / 1');
    });

    it('keeps the editor usable when a tetgram URL contains out-of-range field diffs', () => {
        const tetgramUrl = 'https://tetristemplate.info/tetgram/?d=v115%40A8uhAglA8uhAgl';

        visit({ mode: 'edit', fumen: 'v115@vhAAgH' });
        cy.window().then((win) => {
            Object.defineProperty(win.navigator, 'clipboard', {
                configurable: true,
                value: { readText: () => Promise.resolve(tetgramUrl) },
            });
        });

        operations.menu.import();
        cy.get(datatest('btn-import')).click();
        cy.get(datatest('text-pages')).should('have.text', '1 / 2');
        cy.get(datatest('btn-next-page')).click();
        cy.get(datatest('text-pages')).should('have.text', '2 / 2');

        operations.mode.block.Gray();
        operations.mode.block.click(0, 0);
        cy.get(datatest('btn-list-view')).click();
        cy.get(datatest('btn-list-view-export')).should('be.visible');
    });
});

describe('Menu sheet', () => {
    const sectionOrder = ['menu-section-mode', 'menu-section-page', 'menu-section-general', 'menu-section-view'];

    // Open のモーダルも mdl-open-fumen を使うので、確認は .bottom-sheet の中に限る
    const assertMenuSheet = ({ image, comments }) => {
        operations.menu.open();
        cy.get('.bottom-sheet').should('be.visible').within(() => {
            cy.get('.modal-content').children().first()
                .should('have.text', 'Menu')
                .and('not.contain.text', '[build');
            cy.get('.modal-content').children().last()
                .should('have.attr', 'datatest', 'menu-build')
                .and('contain.text', 'build')
                .and('have.css', 'font-size', '12px');
            cy.get('.modal-content').children('[datatest]').then((children) => {
                const sections = children.toArray().map(child => child.getAttribute('datatest'))
                    .filter(name => sectionOrder.includes(name));
                expect(sections).to.deep.equal(sectionOrder);
            });
            // モード切替は見出しを持たず、その他の見出しはシート名と重ならない「Tools」にする
            cy.get(datatest('menu-section-mode-heading')).should('not.exist');
            cy.get(datatest('menu-section-general-heading')).should('have.text', 'Tools');
            ['btn-new-fumen', 'btn-copy-fumen', 'btn-open-fumen', 'btn-append-fumen'].forEach((name) => {
                cy.get(datatest('menu-section-page')).find(datatest(name)).should('exist');
            });
            ['btn-first-page', 'btn-last-page', 'btn-page-slider'].forEach((name) => {
                cy.get(datatest('menu-section-view')).find(datatest(name)).should('exist');
            });
            cy.get(datatest('menu-section-general')).find(datatest('btn-save-playfield-to-image'))
                .should(image ? 'exist' : 'not.exist');
            comments.forEach(([name, visible]) => {
                cy.get(datatest('menu-section-view')).find(datatest(name)).should(visible ? 'exist' : 'not.exist');
            });
            cy.get(datatest('btn-new-fumen')).should('not.have.class', 'z-depth-1')
                .and('have.css', 'border-top-left-radius', '4px');
        });
        cy.get('.modal-overlay').last().click({ force: true });
        cy.get('.bottom-sheet').should('not.exist');
    };

    it('groups the buttons into mode, page, general and view sections on every screen', () => {
        visit({ reload: true, mode: 'edit', fumen: 'v115@vhAAgH' });
        assertMenuSheet({
            image: true,
            comments: [['btn-show-comment', false], ['btn-comment-writable', false], ['btn-comment-readonly', true]],
        });

        visit({ reload: true, fumen: 'v115@vhAAgH' });
        assertMenuSheet({
            image: true,
            comments: [['btn-show-comment', false], ['btn-comment-writable', false], ['btn-comment-readonly', false]],
        });

        visit({ reload: true, mode: 'edit', fumen: 'v115@vhAAgH' });
        cy.get(datatest('btn-list-view')).click();
        cy.get(datatest('list-view-tools')).should('be.visible');
        assertMenuSheet({
            image: false,
            comments: [['btn-show-comment', false], ['btn-comment-writable', false], ['btn-comment-readonly', false]],
        });
    });
});

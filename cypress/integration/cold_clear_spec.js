import { datatest, visit } from '../support/common';
import { operations } from '../support/operations';

const ensureTreeGraphView = () => {
    cy.get(datatest('btn-list-view')).click();

    cy.get('body').then(($body) => {
        if ($body.find('[title="Enable tree mode"]').length > 0) {
            cy.get('[title="Enable tree mode"]').click();
        }
    });

    cy.get('[title="Show pages in tree view"]').should('be.visible').click();
    cy.get(datatest('btn-tree-ai-menu')).should('be.visible');
};

describe('Cold Clear menu', () => {
    it('shows the latest INPUT best move only after AI guide calculation completes', () => {
        visit({ mode: 'edit', lng: 'en' });
        operations.mode.comment.open();
        cy.get(datatest('text-comment')).clear().type('#Q=[](T)SILZJO').blur();
        operations.mode.piece.open();
        operations.mode.piece.spawn.T();
        operations.mode.piece.layout('play');

        cy.get(datatest('btn-input-ai-guide'))
            .should('have.attr', 'aria-pressed', 'false')
            .and('have.attr', 'data-status', 'idle');
        cy.get(datatest('input-ai-guide-status')).should('have.text', '');
        operations.mode.piece.toggleAiGuide();
        cy.get(datatest('btn-input-ai-guide')).should('have.attr', 'aria-pressed', 'true');
        cy.window().then(win => {
            const settings = JSON.parse(win.localStorage.getItem('view-settings@1'));
            expect(settings.coldClearInputGuideEnabled).to.equal(true);
        });
        cy.get('[datatest^="input-ai-guide-block-"]').should('have.length', 4)
            .each(block => expect(block.attr('visible')).not.to.equal('true'));

        operations.mode.piece.waitAiGuideReady();
        cy.get(datatest('input-ai-guide-status')).should('have.text', 'Showing');
        cy.get('[datatest^="input-ai-guide-block-"]').should('have.length', 4)
            .each(block => expect(block.attr('visible')).to.equal('true'));

        cy.get('[datatest^="input-ai-guide-block-"]').then($blocks => {
            const placement = [...$blocks].map(block => ({
                x: block.getAttribute('x'),
                y: block.getAttribute('y'),
            }));
            cy.get(datatest('tray-piece-hold')).click();
            cy.get(datatest('btn-input-ai-guide'))
                .should('have.attr', 'data-status', 'ready');
            cy.get('[datatest^="input-ai-guide-block-"]').each((block, index) => {
                expect(block.attr('visible')).to.equal('true');
                expect(block[0].getAttribute('x')).to.equal(placement[index].x);
                expect(block[0].getAttribute('y')).to.equal(placement[index].y);
            });
        });

        operations.mode.piece.harddrop();
        cy.get('[datatest^="input-ai-guide-block-"]')
            .each(block => expect(block.attr('visible')).not.to.equal('true'));
        operations.mode.piece.waitAiGuideReady();
        cy.get('[datatest^="input-ai-guide-block-"]')
            .each(block => expect(block.attr('visible')).to.equal('true'));

        operations.mode.piece.toggleAiGuide();
        cy.get(datatest('btn-input-ai-guide'))
            .should('have.attr', 'aria-pressed', 'false')
            .and('have.attr', 'data-status', 'idle');
        cy.window().then(win => {
            const settings = JSON.parse(win.localStorage.getItem('view-settings@1'));
            expect(settings.coldClearInputGuideEnabled).to.equal(false);
        });
        cy.get('[datatest^="input-ai-guide-block-"]')
            .each(block => expect(block.attr('visible')).not.to.equal('true'));
    });

    it('locks the current piece on the INPUT AI guide ghost when it is tapped', () => {
        cy.clearLocalStorage();
        visit({ mode: 'edit', lng: 'en' });
        operations.mode.comment.open();
        cy.get(datatest('text-comment')).clear().type('#Q=[](T)SILZJO').blur();
        operations.mode.piece.open();
        operations.mode.piece.spawn.T();
        operations.mode.piece.layout('play');
        operations.mode.piece.toggleAiGuide();
        operations.mode.piece.waitAiGuideReady();

        cy.get(datatest('input-ai-guide-block-0')).should('not.have.attr', 'data-cell', '').then(($block) => {
            const [x, y] = $block.attr('data-cell').split(',').map(Number);
            operations.mode.block.click(x, y);
        });

        cy.get(datatest('text-pages')).should('contain', '2 / 2');
        operations.mode.piece.waitAiGuideReady();
    });

    it('shows and switches the AI engine from the INPUT AI guide', () => {
        cy.clearLocalStorage();
        visit({ mode: 'edit', lng: 'en' });
        operations.mode.comment.open();
        cy.get(datatest('text-comment')).clear().type('#Q=[](T)SILZJO').blur();
        operations.mode.piece.open();
        operations.mode.piece.spawn.T();
        operations.mode.piece.layout('play');

        cy.get(datatest('btn-input-ai-engine'))
            .should('have.attr', 'data-engine', 'coldClear')
            .and('have.attr', 'aria-label', 'Switch AI engine (current: Cold Clear)');
        operations.mode.piece.toggleAiGuide();
        operations.mode.piece.waitAiGuideReady();

        operations.mode.piece.switchAiEngineTo('soldSlear');
        cy.window().then(win => {
            const settings = JSON.parse(win.localStorage.getItem('view-settings@1'));
            expect(settings.aiEngine).to.equal('soldSlear');
        });
        // 切り替えたエンジンで考え直す
        operations.mode.piece.waitAiGuideReady();
        cy.get('[datatest^="input-ai-guide-block-"]').should('have.length', 4)
            .each(block => expect(block.attr('visible')).to.equal('true'));

        operations.mode.piece.switchAiEngineTo('coldClear');
        cy.window().then(win => {
            const settings = JSON.parse(win.localStorage.getItem('view-settings@1'));
            expect(settings.aiEngine).to.equal('coldClear');
        });
    });

    it('shows why the INPUT AI guide cannot run', () => {
        visit({ mode: 'edit', lng: 'en' });
        operations.mode.piece.open();
        operations.mode.piece.layout('play');

        operations.mode.piece.toggleAiGuide();
        cy.get(datatest('btn-input-ai-guide'))
            .should('have.attr', 'aria-pressed', 'true')
            .and('have.attr', 'data-status', 'unavailable')
            .and('have.attr', 'data-reason', 'noQueue');
        cy.get(datatest('input-ai-guide-status')).should('have.text', 'No queue');
    });

    it('adds a top-level node from ghost add button in tree view', () => {
        visit({ mode: 'edit', lng: 'en' });
        ensureTreeGraphView();

        cy.get('[datatest^="tree-node-"]').should('have.length', 1);
        cy.get(datatest('btn-tree-root-add-ghost')).should('be.visible').click();
        cy.get('[datatest^="tree-node-"]').should('have.length', 2);
        cy.get(datatest('btn-tree-ai-menu')).should('be.visible');
    });

    it('shows the primary search actions and enabled placed-score action', () => {
        visit({ mode: 'edit', lng: 'en' });
        ensureTreeGraphView();

        cy.get(datatest('btn-tree-ai-menu')).click();
        cy.get(datatest('mdl-cold-clear-menu')).should('be.visible');

        cy.get(datatest('btn-cold-clear-sequence-search')).should('be.visible');
        cy.get(datatest('btn-cold-clear-top-branches-search')).should('be.visible');
        cy.get(datatest('btn-cold-clear-append-one-bag')).scrollIntoView().should('be.visible');

        cy.get(datatest('btn-cold-clear-evaluate-placed-spawn-score')).should('not.be.disabled');
    });

    it('fails fast with toast when no placed piece exists', () => {
        visit({ mode: 'edit', lng: 'en' });

        operations.mode.comment.open();
        cy.get(datatest('text-comment')).clear().type('TIOLJSZ');
        ensureTreeGraphView();

        cy.get(datatest('btn-tree-ai-menu')).click();
        cy.get(datatest('btn-cold-clear-evaluate-placed-spawn-score')).click();

        cy.contains('.toast', 'AI: Place a piece before running this action').should('be.visible');
        cy.get(datatest('mdl-cold-clear-menu')).should('be.visible');
    });

    it('closes modal after placed-score evaluation completes', () => {
        visit({ mode: 'edit', lng: 'en' });

        operations.mode.comment.open();
        cy.get(datatest('text-comment')).clear().type('TIOLJSZ');
        operations.mode.piece.open();
        operations.mode.piece.spawn.T();
        operations.mode.piece.harddrop();
        // ハードドロップは次ページを自動挿入してそちらへ移動するため、
        // 設置済みピースのあるページへ戻ってから配置スコアを評価する。
        operations.mode.tools.backPage();

        ensureTreeGraphView();
        cy.get(datatest('btn-tree-ai-menu')).click();
        cy.get(datatest('mdl-cold-clear-menu')).should('be.visible');

        cy.get(datatest('btn-cold-clear-evaluate-placed-spawn-score')).click();

        // Observe the persistent tree control's running state before waiting
        // for the modal component to be removed.
        cy.get(datatest('btn-tree-ai-menu'), { timeout: 15000 })
            .should('have.attr', 'data-cold-clear-running', '1');
        cy.get(datatest('mdl-cold-clear-menu'), { timeout: 15000 }).should('not.exist');
        // A placed-score run returns to the editor PAINT tray so the score comment
        // remains visible after the evaluation finishes.
        cy.get(datatest('btn-paint-mode'), { timeout: 15000 })
            .should('have.attr', 'aria-pressed', 'true');
        cy.get(datatest('tray-paint-pen'), { timeout: 15000 }).should('exist');
        cy.get(datatest('text-comment'), { timeout: 15000 })
            .invoke('val')
            .should('match', /^score=/);
    });

    it('allows editing top branch count and disables it while search runs', () => {
        visit({ mode: 'edit', lng: 'en' });

        operations.mode.comment.open();
        cy.get(datatest('text-comment')).clear().type('TIOLJSZ');
        ensureTreeGraphView();

        cy.get(datatest('btn-tree-ai-menu')).click();
        cy.get(datatest('input-cold-clear-top-branch-count')).scrollIntoView()
            .should('be.visible').and('not.be.disabled');

        cy.get(datatest('badge-cold-clear-top-branch-count')).should('have.text', '×5');
        cy.get(datatest('input-cold-clear-top-branch-count')).clear().type('7').blur();
        cy.get(datatest('input-cold-clear-top-branch-count')).should('have.value', '7');
        cy.get(datatest('badge-cold-clear-top-branch-count')).should('have.text', '×7');
        cy.get(datatest('btn-cold-clear-top-branches-search')).click();

        cy.get(datatest('input-cold-clear-top-branch-count')).should('be.disabled');
    });

    it('offers buttons to set the queue and turn Lock on when the search cannot start', () => {
        visit({ mode: 'edit', lng: 'en', flagsHidden: false });
        operations.mode.flags.open();
        operations.mode.flags.lockToOff();
        operations.mode.flags.close();
        ensureTreeGraphView();

        cy.get(datatest('btn-tree-ai-menu')).click();
        cy.get(datatest('btn-cold-clear-setup-queue')).should('be.visible');
        cy.get(datatest('btn-cold-clear-setup-lock')).should('be.visible').click();
        cy.get(datatest('btn-cold-clear-setup-lock')).should('not.exist');

        cy.get(datatest('btn-cold-clear-setup-queue')).click();
        cy.get(datatest('mdl-cold-clear-menu')).should('be.visible');
        cy.get(datatest('mdl-input-window')).should('not.exist');
        cy.get(datatest('input-cold-clear-queue')).should('be.focused');
    });

    describe('Sold Slear engine', () => {
        const openAiMenuWithQueue = (queue) => {
            visit({ mode: 'edit', lng: 'en' });
            operations.mode.comment.open();
            cy.get(datatest('text-comment')).clear().type(queue).blur();
            ensureTreeGraphView();
            cy.get(datatest('btn-tree-ai-menu')).click();
            cy.get(datatest('mdl-cold-clear-menu')).should('be.visible');
        };

        it('switches from the modal title, hides Cold Clear-only settings and remembers it', () => {
            cy.clearLocalStorage();
            openAiMenuWithQueue('#Q=[](T)SILZJO');

            cy.get(datatest('btn-ai-engine-switch'))
                .should('have.attr', 'data-engine', 'coldClear')
                .and('contain', 'Cold Clear');
            cy.get(datatest('toggle-cold-clear-hold-allowed')).should('exist');
            cy.get(datatest('select-cold-clear-weights-preset')).should('exist');
            cy.get(datatest('toggle-cold-clear-speculate')).should('exist');
            cy.get(datatest('txt-ai-engine-notice')).should('not.exist');

            operations.aiMenu.switchEngineTo('soldSlear');
            cy.get(datatest('btn-ai-engine-switch')).should('contain', 'Sold Slear');
            cy.get(datatest('toggle-cold-clear-hold-allowed')).should('not.exist');
            cy.get(datatest('select-cold-clear-weights-preset')).should('not.exist');
            cy.get(datatest('toggle-cold-clear-speculate')).should('not.exist');
            cy.get(datatest('select-cold-clear-think-time')).should('not.exist');
            cy.get(datatest('select-sold-slear-budget')).should('have.value', 'standard');
            cy.get(datatest('txt-ai-engine-notice')).should('exist');
            cy.window().then(win => {
                const settings = JSON.parse(win.localStorage.getItem('view-settings@1'));
                expect(settings.aiEngine).to.equal('soldSlear');
            });

            cy.reload();
            ensureTreeGraphView();
            cy.get(datatest('btn-tree-ai-menu')).click();
            cy.get(datatest('btn-ai-engine-switch')).should('have.attr', 'data-engine', 'soldSlear');

            operations.aiMenu.switchEngineTo('coldClear');
            cy.get(datatest('toggle-cold-clear-hold-allowed')).should('exist');
        });

        it('runs a sequence search and adds the result pages to the tree', () => {
            cy.clearLocalStorage();
            openAiMenuWithQueue('#Q=[](T)SILZ');
            operations.aiMenu.switchEngineTo('soldSlear');

            cy.get(datatest('btn-cold-clear-sequence-search')).click();
            cy.get(datatest('btn-ai-engine-switch')).should('have.attr', 'aria-disabled', 'true');
            cy.get(datatest('mdl-cold-clear-menu'), { timeout: 30000 }).should('not.exist');

            // current + NEXT 4 個 → 最大 4 手（最後の 1 個は NEXT が無いので置かない。HOLD を使えば減る）
            cy.get('[datatest^="tree-node-"]', { timeout: 30000 })
                .should('have.length.within', 3, 5);
        });

        // 返却 16 候補の外の root 手も探索値を持つので、16 を超えて分岐を追加できる
        it('adds up to 20 top branches, beyond the 16 returned candidates', () => {
            cy.clearLocalStorage();
            openAiMenuWithQueue('#Q=[](T)SILZJO');
            operations.aiMenu.switchEngineTo('soldSlear');

            cy.get(datatest('input-cold-clear-top-branch-count')).scrollIntoView()
                .should('have.attr', 'max', '20');
            cy.get(datatest('input-cold-clear-top-branch-count')).clear().type('18').blur();
            cy.get(datatest('btn-cold-clear-top-branches-search')).click();

            cy.get(datatest('mdl-cold-clear-menu'), { timeout: 30000 }).should('not.exist');
            cy.get('[datatest^="tree-node-"]', { timeout: 30000 }).should('have.length', 19);
        });

        it('reports the placed piece rank and writes its score when it is a candidate', () => {
            cy.clearLocalStorage();
            visit({ mode: 'edit', lng: 'en' });
            operations.mode.comment.open();
            cy.get(datatest('text-comment')).clear().type('#Q=[](T)IOLJSZ').blur();
            operations.mode.piece.open();
            operations.mode.piece.spawn.T();
            operations.mode.piece.harddrop();
            operations.mode.tools.backPage();

            ensureTreeGraphView();
            cy.get(datatest('btn-tree-ai-menu')).click();
            operations.aiMenu.switchEngineTo('soldSlear');
            cy.get(datatest('btn-cold-clear-evaluate-placed-spawn-score')).click();

            cy.contains('.toast', /Sold Slear: (rank \d+ of \d+ candidates|not among the \d+ candidates)/,
                { timeout: 30000 }).should('be.visible').invoke('text').then((toast) => {
                cy.get(datatest('mdl-cold-clear-menu'), { timeout: 15000 }).should('not.exist');
                // 候補内ならスコアを書き、候補外ならコメントを書き換えない
                cy.get(datatest('text-comment'), { timeout: 15000 }).invoke('val').should(
                    /rank \d+ of/.test(toast) ? 'match' : 'not.match',
                    /rank \d+ of/.test(toast) ? /^score=-?\d+\.\d{2} \| #Q=\[\]\(T\)IOLJSZ$/ : /score=|outsideTop=/,
                );
            });
        });

        it('recomputes the INPUT guide after switching engines', () => {
            cy.clearLocalStorage();
            visit({ mode: 'edit', lng: 'en' });
            operations.mode.comment.open();
            cy.get(datatest('text-comment')).clear().type('#Q=[](T)SILZJO').blur();
            operations.mode.piece.open();
            operations.mode.piece.spawn.T();
            operations.mode.piece.layout('play');
            operations.mode.piece.toggleAiGuide();
            operations.mode.piece.waitAiGuideReady();

            cy.get(datatest('btn-cold-clear')).click();
            operations.aiMenu.switchEngineTo('soldSlear');
            cy.get(datatest('btn-cold-clear-menu-close')).click();

            operations.mode.piece.waitAiGuideReady();
            cy.get('[datatest^="input-ai-guide-block-"]').should('have.length', 4)
                .each(block => expect(block.attr('visible')).to.equal('true'));
        });
    });

    it('respawns the current piece edited in the AI menu', () => {
        visit({ mode: 'edit', lng: 'en' });
        operations.mode.comment.open();
        cy.get(datatest('text-comment')).clear().type('#Q=[Z](S)L').blur();
        operations.mode.piece.open();
        operations.mode.piece.spawn.S();

        cy.get(datatest('btn-cold-clear')).click();
        cy.get(datatest('mdl-cold-clear-menu')).should('be.visible');
        cy.get(datatest('pane-cold-clear-current')).click();
        cy.get(datatest('btn-cold-clear-queue-add-O')).click();
        cy.get(datatest('btn-cold-clear-menu-close')).click();
        operations.mode.comment.open();
        cy.get(datatest('text-comment')).should('have.value', '#Q=[Z](O)L');

        operations.mode.tools.undo();
        cy.get(datatest('text-comment')).should('have.value', '#Q=[Z](S)L');
        operations.mode.piece.open();
        operations.mode.piece.harddrop();
        operations.mode.comment.open();
        cy.get(datatest('text-comment')).should('have.value', '#Q=[Z](L)');
    });
});

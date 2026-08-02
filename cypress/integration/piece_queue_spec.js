import { Color, datatest, mino, Piece, Rotation, visit } from '../support/common';
import { operations } from '../support/operations';

describe('PIECE queues', () => {
    beforeEach(() => cy.clearLocalStorage());

    it('shows Hold and nearest-first NEXT only in the play layout', () => {
        cy.viewport(375, 667);
        visit({ mode: 'edit' });

        cy.get(datatest('piece-queue-hold')).should('not.exist');
        cy.get(datatest('piece-queue-next')).should('not.exist');
        cy.get(datatest('piece-queue-infinite')).should('not.exist');

        cy.get(datatest('btn-paint-mode')).click();
        cy.get(datatest('text-comment')).clear().type('T:IOTLJ').blur();
        cy.get(datatest('btn-piece-mode')).click();

        // 初期レイアウトは通常（パレット表示）。キューはPlayを押すまで出ない。
        cy.get(datatest('editor-rail')).should('have.attr', 'data-piece-layout', 'select');
        cy.get(datatest('piece-queue-hold')).should('not.exist');
        operations.mode.piece.layout('play');
        cy.get(datatest('editor-rail')).should('have.attr', 'data-piece-layout', 'play');

        cy.get(datatest('piece-queue-hold'))
            .should('be.visible')
            .and('have.attr', 'data-piece', 'T');
        // キュー列は盤面幅に対して他クライアントと同等の比率を保つ
        cy.get(`${datatest('editor-field-frame')},${datatest('piece-queue-hold')},`
            + `${datatest('piece-queue-next')}`).then(elements => {
            const field = elements.filter(datatest('editor-field-frame'))[0].getBoundingClientRect();
            [datatest('piece-queue-hold'), datatest('piece-queue-next')].forEach(selector => {
                const column = elements.filter(selector)[0].getBoundingClientRect();
                expect(column.width).to.be.at.least(66);
                expect(column.width / field.width).to.be.at.least(0.28);
            });
        });
        cy.get(datatest('piece-queue-next-0')).then(row => {
            expect(row[0].getBoundingClientRect().height).to.be.at.least(40);
        });
        ['I', 'O', 'T', 'L', 'J'].forEach((piece, index) => {
            cy.get(datatest(`piece-queue-next-${index}`))
                .should('be.visible')
                .and('have.attr', 'data-piece', piece);
        });
        cy.get(datatest('piece-queue-infinite')).should('be.visible').and('contain.text', '∞ 7bag');
        cy.get(datatest('piece-queue-infinite-checkbox'))
            .should('have.attr', 'aria-pressed', 'false');
        cy.get(datatest('piece-queue-infinite')).then(toggle => {
            const toggleRect = toggle[0].getBoundingClientRect();
            const checkboxRect = toggle.find(datatest('piece-queue-infinite-checkbox'))[0].getBoundingClientRect();
            const textRect = toggle.find(datatest('piece-queue-infinite-text'))[0].getBoundingClientRect();
            expect(Math.abs((checkboxRect.top + checkboxRect.bottom) / 2
                - (textRect.top + textRect.bottom) / 2)).to.be.lessThan(2);
            expect(textRect.right).to.be.at.most(toggleRect.right);
            expect(toggle[0].scrollWidth).to.be.at.most(Math.ceil(toggleRect.width));
        });
        cy.get(datatest('editor-rail')).should('have.attr', 'data-piece-layout', 'play');
        // 操作重視はミノ選択セルを持たず、削除・リスポーン・リセットだけを残す
        ['btn-piece-i', 'btn-piece-t', 'btn-piece-inference',
            'btn-insert-new-page', 'btn-insert-from-clipboard', 'btn-copy-to-clipboard', 'btn-cut-page',
            'btn-editor-import', 'btn-editor-export', 'btn-utils-mode', 'btn-flags-mode'].forEach(selector => {
            cy.get(datatest(selector)).should('not.exist');
        });
        ['btn-piece-empty', 'btn-piece-gray', 'btn-piece-reset'].forEach(selector => {
            cy.get(datatest(selector)).should('be.visible');
        });
        cy.get(datatest('btn-editor-user-settings')).should('be.visible');
    });

    it('shows the PAINT-like rail and keeps the board size in the select layout', () => {
        cy.viewport(375, 667);
        visit({ mode: 'edit' });

        cy.get(datatest('editor-field-frame')).then(paintField => {
            const paint = paintField[0].getBoundingClientRect();
            cy.get(datatest('btn-piece-mode')).click();

            cy.get(datatest('editor-rail')).should('have.attr', 'data-piece-layout', 'select');
            cy.get(datatest('editor-field-frame')).then(pieceField => {
                const piece = pieceField[0].getBoundingClientRect();
                ['width', 'height', 'top'].forEach(dimension => {
                    expect(piece[dimension]).to.be.closeTo(paint[dimension], 1);
                });
            });
        });

        ['piece-queue-hold', 'piece-queue-next', 'piece-queue-infinite'].forEach(selector => {
            cy.get(datatest(selector)).should('not.exist');
        });
        ['btn-editor-import', 'btn-editor-export', 'btn-insert-new-page', 'btn-insert-from-clipboard',
            'btn-copy-to-clipboard', 'btn-cut-page', 'btn-utils-mode',
            'btn-piece-i', 'btn-piece-t', 'btn-piece-empty', 'btn-piece-gray',
            'btn-piece-palette-spacer'].forEach(selector => {
            cy.get(datatest(selector)).should('be.visible');
        });
        ['btn-piece-inference', 'btn-piece-reset'].forEach(selector => {
            cy.get(datatest(selector)).should('not.exist');
        });
    });

    it('keeps the queue contents across a layout round trip and remembers the layout', () => {
        visit({ mode: 'edit' });
        cy.get(datatest('btn-paint-mode')).click();
        cy.get(datatest('text-comment')).clear().type('#Q=[T](I)OLJ').blur();
        operations.mode.piece.openWithQueues();

        cy.get(datatest('piece-queue-hold')).should('have.attr', 'data-piece', 'T');
        cy.get(datatest('piece-queue-next-0')).should('have.attr', 'data-piece', 'O');

        operations.mode.piece.layout('select');
        cy.get(datatest('piece-queue-next')).should('not.exist');
        operations.mode.piece.layout('play');
        cy.get(datatest('piece-queue-hold')).should('have.attr', 'data-piece', 'T');
        cy.get(datatest('piece-queue-next-0')).should('have.attr', 'data-piece', 'O');
        operations.mode.comment.open();
        cy.get(datatest('text-comment')).should('have.value', '#Q=[T](I)OLJ');

        // 表示設定は復元され、PlayセルはPAINTからも直接Playへ入る
        cy.reload();
        cy.get(datatest('btn-piece-layout')).click();
        cy.get(datatest('editor-rail')).should('have.attr', 'data-piece-layout', 'play');
        cy.get(datatest('piece-queue-next')).should('be.visible');

        // Play中のPIECEも通常PIECEへの対等な直接入口
        cy.get(datatest('btn-piece-mode')).click();
        cy.get(datatest('editor-rail')).should('have.attr', 'data-piece-layout', 'select');
        cy.get(datatest('piece-queue-next')).should('not.exist');
        cy.get(datatest('btn-piece-t')).should('be.visible');
        cy.get(datatest('btn-piece-mode')).should('have.attr', 'aria-pressed', 'true');
        cy.get(datatest('btn-piece-layout')).should('have.attr', 'aria-pressed', 'false');
    });

    it('enters the play layout from PAINT with a single tap', () => {
        visit({ mode: 'edit' });
        cy.get(datatest('btn-paint-mode')).click();
        cy.get(datatest('text-comment')).clear().type('T:IO').blur();

        cy.get(datatest('btn-piece-layout')).click();

        cy.get(datatest('btn-piece-mode')).should('have.attr', 'aria-pressed', 'false');
        cy.get(datatest('btn-piece-layout')).should('have.attr', 'aria-pressed', 'true');
        cy.get(datatest('editor-rail')).should('have.attr', 'data-piece-layout', 'play');
        cy.get(datatest('piece-queue-hold')).should('have.attr', 'data-piece', 'T');
        cy.get(datatest('tray-piece-harddrop')).should('be.visible');
    });

    it('toggles infinite 7bag separately from the NEXT settings button', () => {
        visit({ mode: 'edit' });
        cy.get(datatest('btn-paint-mode')).click();
        cy.get(datatest('text-comment')).clear().type('#Q=[](T)IOLJSZ').blur();
        operations.mode.piece.openWithQueues();

        operations.mode.piece.toggleInfiniteQueue();
        cy.get(datatest('piece-queue-infinite-checkbox'))
            .should('have.attr', 'aria-pressed', 'true');
        cy.get(datatest('mdl-piece-queue')).should('not.exist');

        operations.mode.piece.toggleInfiniteQueue();
        cy.get(datatest('piece-queue-infinite-checkbox'))
            .should('have.attr', 'aria-pressed', 'false');
        cy.get(datatest('piece-queue-next-0')).should('have.attr', 'data-piece', 'I');
    });

    it('keeps the field focused when toggling infinite 7bag', () => {
        visit({ mode: 'edit' });
        operations.mode.piece.open();
        operations.mode.piece.spawn.T();
        cy.get('#field-top').focus();

        operations.mode.piece.toggleInfiniteQueue();

        cy.get('#field-top').should('be.focused');
        cy.get('body').trigger('keydown', { code: 'ArrowLeft' });
        cy.get('body').trigger('keyup', { code: 'ArrowLeft' });
        mino(Piece.T, Rotation.Spawn)(3, 20).forEach(selector => {
            cy.get(selector).should('have.attr', 'color', Color.T.Highlight2);
        });
    });

    it('hides the comment input while the context tray is shown and restores its value', () => {
        visit({ mode: 'edit' });
        cy.get(datatest('btn-paint-mode')).click();
        cy.get(datatest('text-comment')).clear().type('kept comment').blur();
        cy.get(datatest('btn-piece-mode')).click();

        cy.get(datatest('tray-context')).should('be.visible');
        cy.get(datatest('text-comment')).should('not.exist');

        // PAINT is the explicit exit from the direct PIECE/Play entries.
        cy.get(datatest('btn-paint-mode')).click();
        // PAINTを再度押すと従来どおりトレイを閉じる。
        cy.get(datatest('btn-paint-mode')).click();
        cy.get(datatest('tray-context')).should('not.exist');
        cy.get(datatest('text-comment')).should('have.value', 'kept comment');
    });

    it('opens the queue modal and commits edits to the page comment', () => {
        visit({ mode: 'edit' });
        cy.get(datatest('btn-paint-mode')).click();
        cy.get(datatest('text-comment')).clear().type('T:IO').blur();
        operations.mode.piece.openWithQueues();

        cy.get(datatest('piece-queue-next')).click();
        cy.get(datatest('mdl-piece-queue')).should('be.visible');
        cy.get(datatest('btn-piece-queue-add-Z')).click();
        cy.get(datatest('btn-piece-queue-close')).click();

        cy.get(datatest('piece-queue-next-2')).should('have.attr', 'data-piece', 'Z');
        operations.mode.comment.open();
        cy.get(datatest('text-comment')).should('have.value', '#Q=[T]()IOZ');
    });

    it('ignores a touch click retargeted to NEXT after a piece transition', () => {
        cy.viewport(375, 667);
        visit({ mode: 'edit' });
        cy.get(datatest('btn-paint-mode')).click();
        cy.get(datatest('text-comment')).clear().type('#Q=[](T)I').blur();
        operations.mode.piece.open();
        operations.mode.piece.spawn.T();
        operations.mode.piece.layout('play');

        cy.get(datatest('tray-piece-harddrop'))
            .trigger('pointerdown', { pointerId: 1, pointerType: 'touch', button: 0 })
            .trigger('pointerup', { pointerId: 1, pointerType: 'touch', button: 0, force: true });
        cy.get(datatest('text-pages')).should('contain', '2 / 2');

        // Mobile browsers can retarget only the synthesized click after the
        // pointerdown action has replaced the page beneath the finger.
        cy.get(datatest('piece-queue-next'))
            .trigger('click', { detail: 1, pointerType: 'touch' });
        cy.get(datatest('mdl-piece-queue')).should('not.exist');

        cy.get(datatest('piece-queue-next')).click();
        cy.get(datatest('mdl-piece-queue')).should('be.visible');
    });

    it('focuses the modal section matching the tapped queue panel', () => {
        visit({ mode: 'edit' });
        cy.get(datatest('btn-paint-mode')).click();
        cy.get(datatest('text-comment')).clear().type('T:IO').blur();
        operations.mode.piece.openWithQueues();

        cy.get(datatest('piece-queue-hold')).click();
        cy.get(datatest('input-piece-queue-hold')).should('be.focused');
        cy.get(datatest('pane-piece-queue-hold')).should('have.css', 'border-top-color', 'rgb(25, 118, 210)');
        cy.get(datatest('btn-piece-queue-close')).click();

        cy.get(datatest('piece-queue-next')).click();
        cy.get(datatest('input-piece-queue-next')).should('be.focused');
        cy.get(datatest('pane-piece-queue-next')).should('have.css', 'border-top-color', 'rgb(25, 118, 210)');
        cy.get(datatest('btn-piece-queue-close')).click();
    });

    it('edits the current piece from the modal', () => {
        visit({ mode: 'edit' });
        cy.get(datatest('btn-paint-mode')).click();
        cy.get(datatest('text-comment')).clear().type('#Q=[T]()IO').blur();
        operations.mode.piece.openWithQueues();

        cy.get(datatest('piece-queue-next')).click();
        cy.get(datatest('mdl-piece-queue')).should('be.visible');

        cy.get(datatest('pane-piece-queue-current')).click();
        cy.get(datatest('input-piece-queue-current')).should('be.focused');
        cy.get(datatest('btn-piece-queue-add-S')).click();
        cy.get(datatest('btn-piece-queue-close')).click();

        operations.mode.comment.open();
        cy.get(datatest('text-comment')).should('have.value', '#Q=[T](S)IO');
    });

    it('respawns the edited current piece and undoes queue and spawn together', () => {
        visit({ mode: 'edit' });
        cy.get(datatest('btn-paint-mode')).click();
        cy.get(datatest('text-comment')).clear().type('#Q=[Z](S)L').blur();
        operations.mode.piece.open();
        operations.mode.piece.spawn.S();
        operations.mode.piece.layout('play');

        cy.get(datatest('piece-queue-next')).click();
        cy.get(datatest('pane-piece-queue-current')).click();
        cy.get(datatest('btn-piece-queue-add-O')).click();
        cy.get(datatest('btn-piece-queue-close')).click();
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

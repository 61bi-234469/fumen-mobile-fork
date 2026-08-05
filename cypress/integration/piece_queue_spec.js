import { block, Color, datatest, mino, Piece, Rotation, visit } from '../support/common';
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
        // 操作重視はミノ選択セルを持たず、盤面リセットだけを残す
        ['btn-piece-i', 'btn-piece-t', 'btn-piece-inference', 'btn-piece-empty', 'btn-piece-gray',
            'btn-insert-new-page', 'btn-insert-from-clipboard', 'btn-copy-to-clipboard', 'btn-cut-page',
            'btn-editor-import', 'btn-editor-export', 'btn-utils-mode', 'btn-flags-mode'].forEach(selector => {
            cy.get(datatest(selector)).should('not.exist');
        });
        cy.get(datatest('btn-piece-reset')).should('be.visible').and('contain.text', 'RESET');
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

    it('keeps the queue contents across a layout round trip', () => {
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

        // リロード後もINPUTセルはPAINTから直接操作重視へ入る
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

        // 閉じるときにカレントが空ならNEXT先頭 (I) を繰り上げるため、残るNEXTはO・Z。
        cy.get(datatest('piece-queue-next-1')).should('have.attr', 'data-piece', 'Z');
        operations.mode.comment.open();
        cy.get(datatest('text-comment')).should('have.value', '#Q=[T](I)OZ');
    });

    it('pulls the NEXT head into an empty current when the queue modal closes', () => {
        visit({ mode: 'edit' });
        cy.get(datatest('btn-paint-mode')).click();
        cy.get(datatest('text-comment')).clear().type('#Q=[T]()SZ').blur();
        operations.mode.piece.openWithQueues();

        cy.get(datatest('piece-queue-next')).click();
        cy.get(datatest('mdl-piece-queue')).should('be.visible');
        cy.get(datatest('btn-piece-queue-close')).click();

        // 繰り上げたカレントは盤面にもスポーンされ、そのままINPUTを続けられる
        cy.get(datatest('img-rotation-spawn')).should('be.visible');
        cy.get(datatest('tray-piece-harddrop')).should('not.be.disabled');
        cy.get(datatest('piece-queue-next-0')).should('have.attr', 'data-piece', 'Z');
        operations.mode.comment.open();
        cy.get(datatest('text-comment')).should('have.value', '#Q=[T](S)Z');
    });

    it('keeps an empty current when the NEXT queue is also empty', () => {
        visit({ mode: 'edit' });
        cy.get(datatest('btn-paint-mode')).click();
        cy.get(datatest('text-comment')).clear().type('#Q=[T]()').blur();
        operations.mode.piece.openWithQueues();

        cy.get(datatest('piece-queue-next')).click();
        cy.get(datatest('mdl-piece-queue')).should('be.visible');
        cy.get(datatest('btn-piece-queue-close')).click();

        cy.get(datatest('img-rotation-empty')).should('be.visible');
        operations.mode.comment.open();
        cy.get(datatest('text-comment')).should('have.value', '#Q=[T]()');
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

    it('rotates pages away from the front once the kept page count is exceeded', () => {
        visit({ mode: 'edit' });
        operations.menu.setPageRotationLimit(3);
        cy.get(datatest('btn-paint-mode')).click();
        cy.get(datatest('text-comment')).clear().type('#Q=[](T)IOLJSZ').blur();
        operations.mode.piece.open();
        operations.mode.piece.spawn.T();
        operations.mode.piece.layout('play');

        operations.mode.piece.harddrop();
        cy.get(datatest('text-pages')).should('contain', '2 / 2');
        operations.mode.piece.harddrop();
        cy.get(datatest('text-pages')).should('contain', '3 / 3');

        // 上限を超えた分は先頭から消えるので、ページ番号は3止まりで進み続ける
        operations.mode.piece.harddrop();
        cy.get(datatest('text-pages')).should('contain', '3 / 3');
        operations.mode.piece.harddrop();
        cy.get(datatest('text-pages')).should('contain', '3 / 3');
        cy.get(datatest('piece-queue-next-0')).should('have.attr', 'data-piece', 'S');
    });

    it('keeps the infinite queue boundary stable while seven bag gray is enabled', () => {
        visit({ mode: 'edit' });
        operations.menu.setSevenBagGray(true);
        cy.get(datatest('btn-paint-mode')).click();
        operations.mode.block.L();
        operations.mode.block.click(0, 0);
        cy.get(datatest('text-comment')).clear().type('#Q=[](T)IOLJSZ').blur();
        operations.mode.piece.open();
        operations.mode.piece.spawn.T();
        operations.mode.piece.layout('play');
        operations.mode.piece.toggleInfiniteQueue();

        operations.mode.piece.harddrop();
        cy.get(datatest('piece-queue-next-0')).should('have.attr', 'data-piece', 'O');
        operations.mode.piece.harddrop();
        operations.mode.piece.harddrop();
        cy.get(datatest('text-pages')).should('contain', '1 / 1');

        // キュー設定の表示・確定を挟んでも、sbgのbag位置を失わない。
        cy.get(datatest('piece-queue-next')).click();
        cy.get(datatest('btn-piece-queue-close')).click();

        operations.mode.piece.harddrop();
        operations.mode.piece.harddrop();
        operations.mode.piece.harddrop();
        cy.get(datatest('text-pages')).should('contain', '1 / 1');
        operations.mode.piece.harddrop();
        cy.get(datatest('text-pages')).should('contain', '2 / 2');
        // The active field for the next bag also uses gray for all previously settled terrain.
        cy.get(block(0, 0)).should('have.attr', 'color', Color.Gray.Normal);
        operations.mode.comment.open();
        cy.get(datatest('text-comment')).should('have.value', '');
        operations.mode.tools.backPage();
        cy.get(block(0, 0)).should('have.attr', 'color', Color.Gray.Normal);
        cy.get(block(4, 0)).should('have.attr', 'color', Color.T.Normal);
    });

    it('starts a seven-bag gray workspace after RESET with later imported pages', () => {
        const suppliedFumen = [
            'v115@vhm2OJsEJC7IzMJpIJ3LJlKJfIJ02Iq1IZ/IzFJ++I?FMJkLJfIJT+IVBJSsHTJJc/IeNJpIJSMJFFJVsH0/',
            'IRPJTN?J+MJUDJ3FJyAJT1I32IcxIp5Ie5IlLJheQLHeSLGeiWdfwh?IewhAeAtAPBeQ4AeRpwhAtAeAthlR4wSglgWwh',
            'AtwhgWxwQ?4glQ4xwxhg0wwg0AeglQ4B8i0glg0BtQ4BtA8xhglg0A8Ct?g0QpAtA8QLAeglxwJeAgHHhQ4IeQ4AeAtCewhAexwTeTGJ',
        ].join('');

        visit({ mode: 'edit' });
        operations.menu.openPage();
        cy.get(datatest('mdl-open-fumen')).should('be.visible').within(() => {
            cy.get(datatest('input-fumen')).clear().type(suppliedFumen);
            cy.get(datatest('btn-open')).click();
        });
        cy.get(datatest('mdl-open-fumen')).should('not.exist');
        cy.get(datatest('text-pages')).should('contain', '1 / 41');

        operations.menu.setSevenBagGray(true);
        operations.mode.piece.open();
        operations.mode.piece.layout('play');
        operations.mode.piece.toggleInfiniteQueue();
        operations.mode.piece.resetBoard();

        for (let index = 0; index < 7; index += 1) {
            operations.mode.piece.harddrop();
        }

        // One detached workspace plus one page for the completed bag.
        cy.get(datatest('text-pages')).should('contain', '43 / 43');
        cy.get(`[datatest^="block-"][color="${Color.Gray.Normal}"]`).should('exist');
    });

    it('keeps all seven placements visible before line clears', () => {
        visit({ mode: 'edit' });
        operations.menu.setSevenBagGray(true);
        cy.get(datatest('btn-paint-mode')).click();
        operations.mode.block.L();
        [0, 1, 2, 7, 8, 9].forEach(x => operations.mode.block.click(x, 0));
        cy.get(datatest('text-comment')).clear().type('#Q=[](I)OTLJSZ').blur();
        operations.mode.piece.open();
        operations.mode.piece.spawn.I();
        operations.mode.piece.layout('play');
        operations.mode.piece.toggleInfiniteQueue();

        for (let index = 0; index < 7; index += 1) {
            operations.mode.piece.harddrop();
        }

        cy.get(datatest('text-pages')).should('contain', '2 / 2');
        operations.mode.tools.backPage();
        [0, 1, 2, 7, 8, 9].forEach((x) => {
            cy.get(block(x, 0)).should('have.attr', 'color', Color.Gray.Highlight1);
        });
        [3, 4, 5, 6].forEach((x) => {
            cy.get(block(x, 0)).should('have.attr', 'color', Color.I.Highlight1);
        });
    });

    it('applies the page rotation limit to ordinary page adds too', () => {
        visit({ mode: 'edit' });
        operations.menu.setPageRotationLimit(3);

        // INPUT以外のページ追加（ADDボタン）でも上限を超えた分は先頭から消える
        operations.mode.tools.addNewPage();
        cy.get(datatest('text-pages')).should('contain', '2 / 2');
        operations.mode.tools.addNewPage();
        cy.get(datatest('text-pages')).should('contain', '3 / 3');
        operations.mode.tools.addNewPage();
        cy.get(datatest('text-pages')).should('contain', '3 / 3');
        operations.mode.tools.addNewPage();
        cy.get(datatest('text-pages')).should('contain', '3 / 3');
    });

    it('keeps every page while the page rotation limit is 0', () => {
        visit({ mode: 'edit' });
        cy.get(datatest('btn-paint-mode')).click();
        cy.get(datatest('text-comment')).clear().type('#Q=[](T)IOLJSZ').blur();
        operations.mode.piece.open();
        operations.mode.piece.spawn.T();
        operations.mode.piece.layout('play');

        operations.mode.piece.harddrop();
        operations.mode.piece.harddrop();
        operations.mode.piece.harddrop();
        operations.mode.piece.harddrop();
        cy.get(datatest('text-pages')).should('contain', '5 / 5');
    });

    it('rewinds one queue piece per undo in the play layout', () => {
        visit({ mode: 'edit' });
        cy.get(datatest('btn-paint-mode')).click();
        cy.get(datatest('text-comment')).clear().type('#Q=[](T)IO').blur();
        operations.mode.piece.open();
        operations.mode.piece.spawn.T();
        operations.mode.piece.layout('play');

        operations.mode.piece.moveToLeft();
        operations.mode.piece.rotateToRight();
        operations.mode.piece.harddrop();

        cy.get(datatest('text-pages')).should('contain', '2 / 2');
        cy.get(datatest('piece-queue-next-0')).should('have.attr', 'data-piece', 'O');
        mino(Piece.I, Rotation.Spawn)(4, 20).forEach(selector => {
            cy.get(selector).should('have.attr', 'color', Color.I.Highlight2);
        });

        // 1回の戻るで、移動・回転・ページ追加・キュー進行・スポーンをまとめて巻き戻す。
        // 一つ手前のキューミノ(T)がスポーン位置に戻る。
        operations.mode.tools.undo();

        cy.get(datatest('text-pages')).should('contain', '1 / 1');
        cy.get(datatest('piece-queue-next-0')).should('have.attr', 'data-piece', 'I');
        mino(Piece.T, Rotation.Spawn)(4, 20).forEach(selector => {
            cy.get(selector).should('have.attr', 'color', Color.T.Highlight2);
        });

        operations.mode.tools.redo();

        cy.get(datatest('text-pages')).should('contain', '2 / 2');
        cy.get(datatest('piece-queue-next-0')).should('have.attr', 'data-piece', 'O');
        mino(Piece.I, Rotation.Spawn)(4, 20).forEach(selector => {
            cy.get(selector).should('have.attr', 'color', Color.I.Highlight2);
        });
    });

    it('rewinds past a hold swap to the previous queue piece', () => {
        visit({ mode: 'edit' });
        cy.get(datatest('btn-paint-mode')).click();
        cy.get(datatest('text-comment')).clear().type('#Q=[](T)IOL').blur();
        operations.mode.piece.open();
        operations.mode.piece.spawn.T();
        operations.mode.piece.layout('play');

        operations.mode.piece.harddrop();
        cy.get(datatest('text-pages')).should('contain', '2 / 2');
        cy.get(datatest('piece-queue-next-0')).should('have.attr', 'data-piece', 'O');

        // HOLDは空なのでNEXT先頭(O)と入れ替わり、カレントがIからOになる。
        cy.get(datatest('tray-piece-hold')).click();
        cy.get(datatest('piece-queue-hold')).should('have.attr', 'data-piece', 'I');
        cy.get(datatest('piece-queue-next-0')).should('have.attr', 'data-piece', 'L');
        operations.mode.piece.moveToLeft();

        // HOLDは静止点にしない。戻るは同じキュー単位ごと巻き戻し、
        // 一つ手前のキューミノ(T)のスポーン直後まで戻る。
        operations.mode.tools.undo();

        cy.get(datatest('text-pages')).should('contain', '1 / 1');
        cy.get(datatest('piece-queue-hold')).should('have.attr', 'data-piece', '');
        cy.get(datatest('piece-queue-next-0')).should('have.attr', 'data-piece', 'I');
        mino(Piece.T, Rotation.Spawn)(4, 20).forEach(selector => {
            cy.get(selector).should('have.attr', 'color', Color.T.Highlight2);
        });
    });

    it('rewinds by queue step right after the queue runs out', () => {
        visit({ mode: 'edit' });
        cy.get(datatest('btn-paint-mode')).click();
        cy.get(datatest('text-comment')).clear().type('#Q=[](T)').blur();
        operations.mode.piece.open();
        operations.mode.piece.spawn.T();
        operations.mode.piece.layout('play');

        // 最後の1ミノを置くとキューが空になり、コメントも空になってカレントミノが出ない。
        operations.mode.piece.harddrop();
        cy.get(datatest('text-pages')).should('contain', '2 / 2');
        cy.get(datatest('piece-queue-next-0')).should('have.attr', 'data-piece', '');

        // この状態でもキュー単位で戻し、直前に置いたミノをスポーンし直す。
        operations.mode.tools.undo();

        cy.get(datatest('text-pages')).should('contain', '1 / 1');
        mino(Piece.T, Rotation.Spawn)(4, 20).forEach(selector => {
            cy.get(selector).should('have.attr', 'color', Color.T.Highlight2);
        });
    });

    it('never rewinds across a fumen load', () => {
        visit({ mode: 'edit' });
        cy.get(datatest('btn-paint-mode')).click();
        cy.get(datatest('text-comment')).clear().type('#Q=[](T)IO').blur();
        operations.mode.piece.open();
        operations.mode.piece.spawn.T();
        operations.mode.piece.layout('play');
        operations.mode.piece.harddrop();
        cy.get(datatest('text-pages')).should('contain', '2 / 2');

        // 別のテト譜を読み込む。ここから先は別のキューセッションになる。
        operations.menu.openPage();
        cy.get(datatest('mdl-open-fumen')).should('be.visible').within(() => {
            cy.get(datatest('input-fumen')).clear().type('v115@vhAAgH');
            cy.get(datatest('btn-open')).click();
        });
        cy.get(datatest('mdl-open-fumen')).should('not.exist');
        cy.get(datatest('text-pages')).should('contain', '1 / 1');

        cy.get(datatest('btn-paint-mode')).click();
        cy.get(datatest('text-comment')).clear().type('#Q=[](S)ZL').blur();
        operations.mode.piece.open();
        operations.mode.piece.spawn.S();
        operations.mode.piece.layout('play');
        operations.mode.piece.moveToLeft();

        // 読み込み前のキュー境界までは戻らない（1回の戻るで前のテト譜へ戻らない）。
        operations.mode.tools.undo();

        cy.get(datatest('text-pages')).should('contain', '1 / 1');
        cy.get(datatest('piece-queue-next-0')).should('have.attr', 'data-piece', 'Z');
        mino(Piece.S, Rotation.Spawn)(4, 20).forEach(selector => {
            cy.get(selector).should('have.attr', 'color', Color.S.Highlight2);
        });
    });

    it('keeps per-operation undo outside the play layout', () => {
        visit({ mode: 'edit' });
        cy.get(datatest('btn-paint-mode')).click();
        cy.get(datatest('text-comment')).clear().type('#Q=[](T)IO').blur();
        operations.mode.piece.open();
        operations.mode.piece.spawn.T();

        operations.mode.piece.moveToLeft();
        operations.mode.piece.rotateToRight();

        // 通常レイアウトでは従来どおり1操作ずつ戻る（回転だけが取り消される）。
        operations.mode.tools.undo();

        mino(Piece.T, Rotation.Spawn)(3, 20).forEach(selector => {
            cy.get(selector).should('have.attr', 'color', Color.T.Highlight2);
        });
    });
});

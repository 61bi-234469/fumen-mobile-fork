import { block, Color, datatest, mino, Piece, Rotation, visit } from '../support/common';
import { operations } from '../support/operations';

// 右クリックはPAINT / SELECT / PIECEで同じ挙動に統合されている。
// 消しゴム、SPAWNミノのキュー戻し、選択プレビューの取消の3点を確認する。
describe('Right click', () => {
    it('erases a block in PAINT', () => {
        visit({ mode: 'edit' });
        cy.get(datatest('btn-piece-t')).click();
        operations.mode.block.click(1, 1);
        cy.get(block(1, 1)).should('have.attr', 'color', Color.T.Normal);

        operations.mode.block.rightClick(1, 1);

        cy.get(block(1, 1)).should('not.have.attr', 'color', Color.T.Normal);
    });

    it('erases a block in SELECT', () => {
        visit({ mode: 'edit' });
        cy.get(datatest('btn-piece-t')).click();
        operations.mode.block.click(1, 1);

        cy.get(datatest('btn-select-mode')).click();
        operations.mode.block.rightClick(1, 1);

        cy.get(block(1, 1)).should('not.have.attr', 'color', Color.T.Normal);
    });

    it('erases a block in PIECE', () => {
        visit({ mode: 'edit' });
        cy.get(datatest('btn-piece-t')).click();
        operations.mode.block.click(1, 1);

        operations.mode.piece.open();
        operations.mode.block.rightClick(1, 1);

        cy.get(block(1, 1)).should('not.have.attr', 'color', Color.T.Normal);
    });

    it('erases along the drag in SELECT', () => {
        visit({ mode: 'edit' });
        cy.get(datatest('btn-piece-t')).click();
        operations.mode.block.dragToRight({ from: 0, to: 3 }, 1);
        cy.get(block(2, 1)).should('have.attr', 'color', Color.T.Normal);

        cy.get(datatest('btn-select-mode')).click();
        operations.mode.block.rightDrag({ x: 0, y: 1 }, { x: 3, y: 1 });

        [0, 1, 2, 3].forEach(x => {
            cy.get(block(x, 1)).should('not.have.attr', 'color', Color.T.Normal);
        });
    });

    it('erases a whole row in PAINT when fillRow is armed', () => {
        visit({ mode: 'edit' });
        cy.get(datatest('btn-piece-t')).click();
        operations.mode.block.dragToRight({ from: 0, to: 9 }, 1);

        operations.mode.fillRow.open();
        operations.mode.block.rightClick(4, 1);

        [0, 4, 9].forEach(x => {
            cy.get(block(x, 1)).should('not.have.attr', 'color', Color.T.Normal);
        });
    });

    it('erases only the clicked cell in SELECT even when fillRow is armed', () => {
        visit({ mode: 'edit' });
        cy.get(datatest('btn-piece-t')).click();
        operations.mode.block.dragToRight({ from: 0, to: 9 }, 1);

        operations.mode.fillRow.open();
        cy.get(datatest('btn-select-mode')).click();
        operations.mode.block.rightClick(4, 1);

        cy.get(block(4, 1)).should('not.have.attr', 'color', Color.T.Normal);
        cy.get(block(0, 1)).should('have.attr', 'color', Color.T.Normal);
        cy.get(block(9, 1)).should('have.attr', 'color', Color.T.Normal);
    });

    it('deletes the whole selection when pressed inside a settled rect', () => {
        visit({ mode: 'edit' });
        cy.get(datatest('btn-piece-t')).click();
        operations.mode.block.dragToRight({ from: 0, to: 9 }, 1);

        cy.get(datatest('btn-select-mode')).click();
        operations.mode.block.drag({ x: 1, y: 1 }, { x: 3, y: 1 });
        cy.get(datatest('tray-selection-summary')).should('contain', '3×1');

        operations.mode.block.rightClick(2, 1);

        [1, 2, 3].forEach(x => {
            cy.get(block(x, 1)).should('not.have.attr', 'color', Color.T.Normal);
        });
        cy.get(block(0, 1)).should('have.attr', 'color', Color.T.Normal);
        cy.get(block(4, 1)).should('have.attr', 'color', Color.T.Normal);
        // SPAWNミノと同じく、削除したら選択そのものもリセットする。
        cy.get(datatest('tray-selection-summary')).should('not.exist');
    });

    it('deletes the SPAWN mino covered by the deleted selection', () => {
        cy.clearLocalStorage();
        visit({ mode: 'edit' });
        operations.mode.piece.open();
        operations.mode.piece.spawn.T();

        cy.get(datatest('btn-select-mode')).click();
        operations.mode.block.drag({ x: 3, y: 19 }, { x: 5, y: 21 });
        operations.mode.block.rightClick(4, 20);

        mino(Piece.T, Rotation.Spawn)(4, 20).forEach(selector => {
            cy.get(selector).should('not.have.attr', 'color', Color.T.Highlight2);
        });
    });

    it('re-selects instead of respawning after a cancelled part preview', () => {
        visit({ mode: 'edit' });
        cy.get(datatest('btn-piece-t')).click();
        operations.mode.block.click(1, 1);

        cy.get(datatest('btn-select-mode')).click();
        operations.mode.block.drag({ x: 1, y: 1 }, { x: 1, y: 1 });
        cy.get(datatest('tray-select-copy')).click();
        cy.get(datatest('btn-piece-i')).click();
        cy.get(block(4, 3)).should('have.attr', 'color', Color.T.Normal);

        operations.mode.block.rightClick(4, 3);
        cy.get(block(4, 3)).should('not.have.attr', 'color', Color.T.Normal);

        // 取消後の左ドラッグは矩形選択をやり直す。パーツが再配置されてはいけない。
        operations.mode.block.drag({ x: 6, y: 6 }, { x: 7, y: 7 });

        cy.get(datatest('tray-selection-summary')).should('contain', '2×2');
        cy.get(block(4, 3)).should('not.have.attr', 'color', Color.T.Normal);
        cy.get(block(6, 6)).should('not.have.attr', 'color', Color.T.Normal);
    });

    it('deletes a floating part preview when pressed inside it', () => {
        visit({ mode: 'edit' });
        cy.get(datatest('btn-piece-t')).click();
        operations.mode.block.click(1, 1);

        cy.get(datatest('btn-select-mode')).click();
        operations.mode.block.drag({ x: 1, y: 1 }, { x: 1, y: 1 });
        cy.get(datatest('tray-select-copy')).click();
        cy.get(datatest('btn-piece-i')).click();
        // 1×1のパーツは着地面の3マス上、x=4, y=3 に浮かぶ。
        cy.get(block(4, 3)).should('have.attr', 'color', Color.T.Normal);

        operations.mode.block.rightClick(4, 3);

        cy.get(block(4, 3)).should('not.have.attr', 'color', Color.T.Normal);
        // 未確定のプレビューを消しただけなので、コピー元のブロックはそのまま残る。
        cy.get(block(1, 1)).should('have.attr', 'color', Color.T.Normal);
    });

    it('deletes a selection a right drag passes over', () => {
        cy.clearLocalStorage();
        visit({ mode: 'edit' });
        cy.get(datatest('btn-piece-t')).click();
        operations.mode.block.dragToRight({ from: 0, to: 9 }, 1);

        cy.get(datatest('btn-select-mode')).click();
        operations.mode.block.drag({ x: 5, y: 1 }, { x: 7, y: 1 });
        cy.get(datatest('tray-selection-summary')).should('contain', '3×1');

        // 選択の外から始めて、ドラッグが選択を通過する。
        operations.mode.block.rightDrag({ x: 0, y: 5 }, { x: 6, y: 1 });

        [5, 6, 7].forEach(x => {
            cy.get(block(x, 1)).should('not.have.attr', 'color', Color.T.Normal);
        });
        cy.get(block(9, 1)).should('have.attr', 'color', Color.T.Normal);
        cy.get(datatest('tray-selection-summary')).should('not.exist');
    });

    it('keeps a selection a right drag passes over when the setting is off', () => {
        cy.clearLocalStorage();
        visit({ mode: 'edit' });

        operations.menu.openUserSettings();
        cy.get(datatest('switch-delete-spawn-mino-on-paint-drag')).uncheck({ force: true });
        cy.get(datatest('btn-save')).click();

        cy.get(datatest('btn-piece-t')).click();
        operations.mode.block.dragToRight({ from: 0, to: 9 }, 1);

        cy.get(datatest('btn-select-mode')).click();
        operations.mode.block.drag({ x: 5, y: 1 }, { x: 7, y: 1 });

        operations.mode.block.rightDrag({ x: 0, y: 5 }, { x: 6, y: 1 });

        // 通過したセル(6,1)は1マス消しになるが、通過していない選択内のセルは残る。
        cy.get(block(6, 1)).should('not.have.attr', 'color', Color.T.Normal);
        cy.get(block(7, 1)).should('have.attr', 'color', Color.T.Normal);
        cy.get(datatest('tray-selection-summary')).should('contain', '3×1');
    });

    it('erases outside a floating SELECT preview and keeps it floating', () => {
        visit({ mode: 'edit' });
        cy.get(datatest('btn-piece-t')).click();
        operations.mode.block.click(1, 1);
        cy.get(datatest('btn-piece-i')).click();
        operations.mode.block.click(8, 1);

        cy.get(datatest('btn-select-mode')).click();
        operations.mode.block.drag({ x: 1, y: 1 }, { x: 1, y: 1 });
        cy.get(datatest('tray-select-copy')).click();
        cy.get(datatest('btn-piece-i')).click();
        cy.get(block(4, 3)).should('have.attr', 'color', Color.T.Normal);

        operations.mode.block.rightClick(8, 1);

        cy.get(block(8, 1)).should('not.have.attr', 'color', Color.I.Normal);
        cy.get(block(4, 3)).should('have.attr', 'color', Color.T.Normal);
    });

    it('erases COMP debris cell by cell in PAINT', () => {
        visit({ mode: 'edit' });
        operations.mode.block.Completion();

        // ミノとして解決していない3マスは白いCOMP残骸として残る。
        operations.mode.block.click(1, 1);
        operations.mode.block.click(3, 1);
        operations.mode.block.click(5, 1);
        [1, 3, 5].forEach(x => {
            cy.get(block(x, 1)).should('have.attr', 'color', Color.Completion.Highlight2);
        });

        operations.mode.block.rightClick(3, 1);

        cy.get(block(3, 1)).should('have.attr', 'color', Color.Empty.Normal);
        cy.get(block(1, 1)).should('have.attr', 'color', Color.Completion.Highlight2);
        cy.get(block(5, 1)).should('have.attr', 'color', Color.Completion.Highlight2);
    });

    it('erases the COMP debris a right drag passes over', () => {
        visit({ mode: 'edit' });
        operations.mode.block.Completion();

        operations.mode.block.click(1, 1);
        operations.mode.block.click(3, 1);
        operations.mode.block.click(5, 1);

        operations.mode.block.rightDrag({ x: 0, y: 1 }, { x: 4, y: 1 });

        [1, 3].forEach(x => {
            cy.get(block(x, 1)).should('have.attr', 'color', Color.Empty.Normal);
        });
        cy.get(block(5, 1)).should('have.attr', 'color', Color.Completion.Highlight2);
    });

    it('returns the SPAWN mino to the queue in SELECT', () => {
        visit({ mode: 'edit' });
        operations.mode.piece.open();
        operations.mode.piece.spawn.T();

        cy.get(datatest('btn-select-mode')).click();
        operations.mode.block.rightClick(4, 20);

        mino(Piece.T, Rotation.Spawn)(4, 20).forEach(selector => {
            cy.get(selector).should('not.have.attr', 'color', Color.T.Highlight2);
        });
    });

    it('deletes the SPAWN mino reached by a right drag in SELECT', () => {
        cy.clearLocalStorage();
        visit({ mode: 'edit' });
        operations.mode.piece.open();
        operations.mode.piece.spawn.T();

        cy.get(datatest('btn-select-mode')).click();
        operations.mode.block.rightDrag({ x: 0, y: 20 }, { x: 4, y: 20 });

        mino(Piece.T, Rotation.Spawn)(4, 20).forEach(selector => {
            cy.get(selector).should('not.have.attr', 'color', Color.T.Highlight2);
        });
    });

    it('keeps the SPAWN mino on a right drag when the setting is off', () => {
        cy.clearLocalStorage();
        visit({ mode: 'edit' });

        operations.menu.openUserSettings();
        cy.get(datatest('switch-delete-spawn-mino-on-paint-drag')).should('be.checked');
        cy.get(datatest('switch-delete-spawn-mino-on-paint-drag')).uncheck({ force: true });
        cy.get(datatest('btn-save')).click();

        operations.mode.piece.open();
        operations.mode.piece.spawn.T();

        cy.get(datatest('btn-select-mode')).click();
        operations.mode.block.rightDrag({ x: 0, y: 20 }, { x: 4, y: 20 });

        mino(Piece.T, Rotation.Spawn)(4, 20).forEach(selector => {
            cy.get(selector).should('have.attr', 'color', Color.T.Highlight2);
        });
    });
});

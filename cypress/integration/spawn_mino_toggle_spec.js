import { block, Color, datatest, visit } from '../support/common';
import { operations } from '../support/operations';

// SPAWNミノとペイントの相互変換トグル。
// 期待fumenを直接書かず、「変換 → 逆変換で元のfumenへ戻る」という往復同値で検証する。
// これなら盤面ごとに正解文字列を用意する必要がなく、退行時に文字列を書き換える誘惑も生まれない。
//
// alias(cy.as) はDOM由来の値だと参照時にクエリを再実行してしまい、
// 「変換前後で同じ値」に見えてしまう。必ずthenの中でプレーンな変数へ退避する。
const readFumen = (store) => {
    operations.menu.copyToClipboard();
    cy.get(datatest('copied-fumen-data')).invoke('attr', 'data').then((value) => {
        store.value = value;
    });
};

// PAINTのペンでTミノの形（(1,1)(2,1)(3,1)(2,2)）を塗る
const paintTShape = () => {
    cy.get(datatest('btn-piece-t')).click();
    operations.mode.block.click(1, 1);
    operations.mode.block.click(2, 1);
    operations.mode.block.click(3, 1);
    operations.mode.block.click(2, 2);
};

// 前ページの盤面を引き継ぐページを追加する（btn-insert-page 経由）。
// ADD(btn-insert-new-page)は空のページを作るので継承の検証には使えない。
const addInheritingPage = () => {
    operations.mode.tools.nextPage();
    cy.wait(100);
};

describe('Spawn mino / paint toggle', () => {
    it('converts the spawn mino into blocks, then back by tapping the candidate', () => {
        const withSpawnMino = {};
        const withBlocks = {};
        const roundTrip = {};

        visit({ mode: 'edit' });
        operations.mode.piece.open();
        operations.mode.piece.spawn.T();

        // ブロック化は対象がSPAWNミノ1つに定まるので1タップ
        operations.mode.spawnMinoToggle.open();
        operations.mode.spawnMinoToggle.expectDirection('to-paint');
        readFumen(withSpawnMino);

        operations.mode.spawnMinoToggle.click();
        operations.mode.spawnMinoToggle.expectDirection('to-mino');
        readFumen(withBlocks);

        // ミノ化は必ず「ボタン → 候補をタップ」の2手
        operations.mode.spawnMinoToggle.click();
        operations.mode.spawnMinoToggle.expectDirection('pick');
        operations.mode.block.click(4, 20);
        operations.mode.spawnMinoToggle.expectDirection('to-paint');
        readFumen(roundTrip);

        cy.then(() => {
            expect(withBlocks.value).not.to.eq(withSpawnMino.value);
            expect(roundTrip.value).to.eq(withSpawnMino.value);
        });
    });

    it('highlights the tappable candidates while waiting for a target', () => {
        visit({ mode: 'edit' });
        paintTShape();

        // 待機前は普通のブロック表示
        cy.get(block(2, 1)).should('have.attr', 'color', Color.T.Normal);

        operations.mode.spawnMinoToggle.click();

        // 待機中は候補4セルが操作対象のハイライトになる
        operations.mode.spawnMinoToggle.expectDirection('pick');
        [[1, 1], [2, 1], [3, 1], [2, 2]].forEach(([x, y]) => {
            cy.get(block(x, y)).should('have.attr', 'color', Color.T.Highlight2);
        });
    });

    it('leaves non-candidates unhighlighted while waiting for a target', () => {
        visit({ mode: 'edit' });
        paintTShape();
        // 灰色はSPAWNミノになれないので候補にならない
        cy.get(datatest('btn-piece-gray')).click();
        operations.mode.block.click(6, 1);
        // 同色を1つ足して5セル連結にしたミノも候補から外れる
        cy.get(datatest('btn-piece-i')).click();
        operations.mode.block.dragToRight({ from: 0, to: 4 }, 5);

        operations.mode.spawnMinoToggle.click();
        operations.mode.spawnMinoToggle.expectDirection('pick');

        cy.get(block(2, 1)).should('have.attr', 'color', Color.T.Highlight2);
        cy.get(block(6, 1)).should('have.attr', 'color', Color.Gray.Normal);
        cy.get(block(2, 5)).should('have.attr', 'color', Color.I.Normal);
    });

    it('restores the block state with a single undo', () => {
        const withBlocks = {};
        const afterUndo = {};

        visit({ mode: 'edit' });
        operations.mode.piece.open();
        operations.mode.piece.spawn.T();

        operations.mode.spawnMinoToggle.open();
        operations.mode.spawnMinoToggle.click();
        readFumen(withBlocks);

        operations.mode.spawnMinoToggle.click();
        operations.mode.block.click(4, 20);
        operations.mode.tools.undo();
        cy.wait(100);
        readFumen(afterUndo);

        cy.then(() => {
            expect(afterUndo.value).to.eq(withBlocks.value);
        });
    });

    it('lifts the mino drawn on this page after tapping it', () => {
        visit({ mode: 'edit' });
        paintTShape();

        operations.mode.spawnMinoToggle.expectDirection('to-mino');
        operations.mode.spawnMinoToggle.click();
        operations.mode.spawnMinoToggle.expectDirection('pick');

        operations.mode.block.click(2, 1);

        operations.mode.spawnMinoToggle.expectDirection('to-paint');
        cy.get(block(2, 1)).should('have.attr', 'color', Color.T.Highlight2);
    });

    it('changes nothing until a candidate is tapped', () => {
        const beforeToggle = {};
        const afterToggle = {};

        visit({ mode: 'edit' });
        paintTShape();
        addInheritingPage();

        operations.mode.spawnMinoToggle.open();
        readFumen(beforeToggle);

        operations.mode.spawnMinoToggle.click();

        // ボタンは候補を光らせるだけ。盤面は一切変わらない
        operations.mode.spawnMinoToggle.expectDirection('pick');
        readFumen(afterToggle);

        cy.then(() => {
            expect(afterToggle.value).to.eq(beforeToggle.value);
        });
    });

    it('lifts an inherited mino too, since the user picks the target', () => {
        visit({ mode: 'edit' });
        paintTShape();
        addInheritingPage();

        operations.mode.spawnMinoToggle.open();
        operations.mode.spawnMinoToggle.click();
        operations.mode.spawnMinoToggle.expectDirection('pick');

        operations.mode.block.click(2, 1);

        operations.mode.spawnMinoToggle.expectDirection('to-paint');
        cy.get(block(2, 1)).should('have.attr', 'color', Color.T.Highlight2);
    });

    it('cancels the pick when the button is pressed again', () => {
        const beforeCancel = {};
        const afterCancel = {};

        visit({ mode: 'edit' });
        paintTShape();

        operations.mode.spawnMinoToggle.click();
        operations.mode.spawnMinoToggle.expectDirection('pick');
        cy.get(block(2, 1)).should('have.attr', 'color', Color.T.Highlight2);
        readFumen(beforeCancel);

        // 出したのと同じボタンで引っ込められる
        operations.mode.spawnMinoToggle.click();

        operations.mode.spawnMinoToggle.expectDirection('to-mino');
        cy.get(block(2, 1)).should('have.attr', 'color', Color.T.Normal);
        readFumen(afterCancel);

        cy.then(() => {
            expect(afterCancel.value).to.eq(beforeCancel.value);
        });
    });

    it('cancels the pick from the keyboard shortcut too', () => {
        visit({ mode: 'edit' });
        paintTShape();

        operations.mode.spawnMinoToggle.click();
        operations.mode.spawnMinoToggle.expectDirection('pick');

        operations.mode.spawnMinoToggle.shortcut();

        operations.mode.spawnMinoToggle.expectDirection('to-mino');
        cy.get(block(2, 1)).should('have.attr', 'color', Color.T.Normal);
    });

    it('cancels the pick when a cell that cannot be lifted is tapped', () => {
        const beforeCancel = {};
        const afterCancel = {};

        visit({ mode: 'edit' });
        paintTShape();
        addInheritingPage();

        operations.mode.spawnMinoToggle.open();
        operations.mode.spawnMinoToggle.click();
        operations.mode.spawnMinoToggle.expectDirection('pick');
        readFumen(beforeCancel);

        // 空セルをタップするとキャンセルされ、塗りも起きない
        operations.mode.block.click(8, 8);

        operations.mode.spawnMinoToggle.expectDirection('to-mino');
        readFumen(afterCancel);

        cy.then(() => {
            expect(afterCancel.value).to.eq(beforeCancel.value);
        });
    });

    it('drops the pick on undo so the next tap paints as usual', () => {
        visit({ mode: 'edit' });
        paintTShape();
        addInheritingPage();

        operations.mode.spawnMinoToggle.open();
        operations.mode.spawnMinoToggle.click();
        operations.mode.spawnMinoToggle.expectDirection('pick');

        operations.mode.tools.undo();
        cy.wait(100);
        operations.mode.spawnMinoToggle.expectDirection('to-mino');

        cy.get(datatest('btn-piece-i')).click();
        operations.mode.block.click(8, 8);
        cy.get(block(8, 8)).should('have.attr', 'color', Color.I.Normal);
    });

    it('disables the button when nothing can be converted', () => {
        visit({ mode: 'edit' });
        operations.mode.spawnMinoToggle.open();

        operations.mode.spawnMinoToggle.expectDirection('none');
        operations.mode.spawnMinoToggle.expectDisabled();
    });

    it('keeps grey blocks out of the conversion', () => {
        visit({ mode: 'edit' });
        cy.get(datatest('btn-piece-gray')).click();
        operations.mode.block.click(1, 1);
        operations.mode.block.click(2, 1);
        operations.mode.block.click(3, 1);
        operations.mode.block.click(2, 2);

        operations.mode.spawnMinoToggle.expectDirection('none');
        operations.mode.spawnMinoToggle.expectDisabled();
    });

    it('converts from the UTILS menu as well', () => {
        visit({ mode: 'edit' });
        operations.mode.piece.open();
        operations.mode.piece.spawn.T();

        operations.mode.utils.spawnMinoToggle();

        operations.mode.spawnMinoToggle.open();
        operations.mode.spawnMinoToggle.expectDirection('to-mino');
    });

    it('converts from the keyboard shortcut as well', () => {
        visit({ mode: 'edit' });
        operations.mode.piece.open();
        operations.mode.piece.spawn.T();

        operations.mode.spawnMinoToggle.open();
        operations.mode.spawnMinoToggle.shortcut();

        operations.mode.spawnMinoToggle.expectDirection('to-mino');
    });

    it('warns only when the conversion also changes the meaning', () => {
        // lockフラグを切り替えるためFLAGSインスペクタを表示する（既定は非表示）
        visit({ mode: 'edit', flagsHidden: false });
        operations.mode.piece.open();
        operations.mode.piece.spawn.T();

        // lock=true・ライン非完成・非Quiz は通常ケースなので何も出さない
        operations.mode.spawnMinoToggle.open();
        operations.mode.spawnMinoToggle.click();
        cy.get('.spawn-mino-toggle-toast').should('not.exist');

        // lock=false ではブロックが以降のページに残るため通知する
        operations.mode.spawnMinoToggle.click();
        operations.mode.block.click(4, 20);
        operations.mode.flags.open();
        operations.mode.flags.lockToOff();
        operations.mode.flags.close();

        operations.mode.spawnMinoToggle.open();
        operations.mode.spawnMinoToggle.click();
        cy.get('.spawn-mino-toggle-toast').should('exist');
    });
});

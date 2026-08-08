import { datatest, expectFumen, visit } from '../support/common';
import { operations } from '../support/operations';

// League の1ラウンド抜粋（player-a が garbagesmash で敗北する側）。
// 期待 fumen は同じ fixture に対する Jest（simulator + ir_to_page + encode）の
// 決定論的な出力から取得している。値を変える前に .agents/skills/e2e/SKILL.md の
// fumen 分類手順を踏むこと。
// 盤面に続く quiz コメント（#Q=[hold](current)next...）は Editor へ引き継ぐ
// HOLD / カレント / NEXT を表す。
const FIXTURE = 'src/lib/ttrm/__tests__/fixtures/league_loss.json';
const PLAYER_A_LOCKS = 78;
const TERMINAL_FUMEN = 'v115@EeAtBeAtxhilBtAeBtwhQ4AeAtywglQ4g0whg0Q4Ae?'
    + 'BtywAtwhI8AeI8AeG8AeG8AeI8AeI8AeI8AeI8AeL8AeI8A?'
    + 'eI8AeI8AeI8AeC8AeM8AeI8AeI8AeI8AeI8AeC8JeAgWaAF?'
    + 'LDmClcJSAVDVSAVG88A4W88AZyTxCK+AAA';
const LOCK1_FUMEN = 'v115@RhRpHeRpReAgWZAFLDmClcJSAVDEHBEooRBJoAVBsu?LuCqAAAA';

const importLeagueLoss = () => {
    operations.replay.importFile({ contents: FIXTURE, fileName: 'league_loss.ttrm' });
    cy.get(datatest('replay-select-phase')).should('exist');
};

describe('TETR.IO Replay', () => {
    it('imports a .ttrm and shows the round summary from the selected side', () => {
        // 自陣の記憶（FR-13）が残っていると既定選択が変わるため、明示的に消す
        cy.clearLocalStorage();
        visit({ mode: 'edit' });

        // 1. Utils メニューから起動してファイルを投入
        operations.replay.open();
        importLeagueLoss();

        cy.get(datatest('replay-self-player-player-a-id')).should('contain', 'player-a');
        cy.get(datatest('replay-self-player-player-b-id')).should('contain', 'player-b');

        // 記憶がなければ左側のプレイヤー（このfixtureでは player-b）が既定で選ばれ、
        // そのラウンドの勝敗がすぐ読める
        cy.get(datatest('replay-round-0')).should('contain', 'Win');

        // 2. 勝敗表示は自陣基準で反転する
        operations.replay.selectSelfPlayer('player-a-id');
        cy.get(datatest('replay-round-0')).should('contain', 'Loss');
        operations.replay.selectSelfPlayer('player-b-id');
        cy.get(datatest('replay-round-0')).should('contain', 'Win');
    });

    it('plays the round lock by lock and opens the current point in the editor', () => {
        visit({ mode: 'edit' });

        operations.replay.open();
        importLeagueLoss();
        operations.replay.selectSelfPlayer('player-a-id');
        operations.replay.selectRound(0);

        // 3. 再生フェーズへ。手番カーソルは1始まり
        operations.replay.start();
        cy.get(datatest('replay-lock-counter')).should('contain', `1 / ${PLAYER_A_LOCKS}`);
        cy.get(datatest('replay-board')).should('exist');

        // 4. 手番送りと終端（FR-21/28）。最終 lock の次は終端状態になる
        operations.replay.next();
        cy.get(datatest('replay-lock-counter')).should('contain', `2 / ${PLAYER_A_LOCKS}`);
        operations.replay.prev();
        cy.get(datatest('replay-lock-counter')).should('contain', `1 / ${PLAYER_A_LOCKS}`);
        operations.replay.last();
        cy.get(datatest('replay-lock-counter')).should('contain', 'End');
        cy.get(datatest('replay-lock-counter')).should('contain', 'garbagesmash');

        // 6. この地点は 25 行スタックなので切り捨てチップが出る（FR-56）
        cy.get(datatest('replay-clip-notice')).should('be.visible');

        // 5. 編集していない状態では確認モーダルなしで Editor へ遷移する
        operations.replay.openInEditor();
        cy.get(datatest('replay-discard-confirm')).should('not.exist');
        cy.get(datatest('replay-screen')).should('not.exist');
        expectFumen(TERMINAL_FUMEN);
    });

    it('asks for confirmation before discarding edits (Q2)', () => {
        visit({ mode: 'edit' });

        operations.replay.open();
        importLeagueLoss();
        operations.replay.selectSelfPlayer('player-a-id');
        operations.replay.start();
        operations.replay.openInEditor();
        cy.get(datatest('replay-screen')).should('not.exist');

        // Editor で 1 ブロック描く → undoCount > 0
        operations.mode.block.open();
        operations.mode.block.Gray();
        operations.mode.block.click(0, 0);

        // 5b. 再度 Replay から Editor を開こうとすると確認モーダルが出る
        operations.replay.open();
        cy.get(datatest('replay-playing-phase')).should('exist');
        operations.replay.openInEditor();
        cy.get(datatest('replay-discard-confirm')).should('be.visible');

        // キャンセルで Replay に留まる
        cy.get(datatest('btn-replay-discard-cancel')).click();
        cy.get(datatest('replay-discard-confirm')).should('not.exist');
        cy.get(datatest('replay-playing-phase')).should('exist');

        // 破棄して開くで遷移する
        operations.replay.openInEditor();
        cy.get(datatest('btn-replay-discard-ok')).click();
        cy.get(datatest('replay-screen')).should('not.exist');
        // player-a の手番1（fieldAfter）を HOLD/カレント/NEXT ごと開き直せている
        expectFumen(LOCK1_FUMEN);
    });

    it('shows an explicit error for a broken file instead of guessing (FR-60)', () => {
        visit({ mode: 'edit' });

        operations.replay.open();
        operations.replay.importFile({
            contents: Cypress.Buffer.from('{ this is not a ttrm'),
            fileName: 'broken.ttrm',
        });

        cy.get(datatest('replay-error')).should('be.visible');
        cy.get(datatest('replay-select-phase')).should('not.exist');
        cy.get(datatest('replay-playing-phase')).should('not.exist');
    });
});

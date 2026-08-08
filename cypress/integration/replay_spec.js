import { block, Color, datatest, expectFumen, visit } from '../support/common';
import { operations } from '../support/operations';

// League の1ラウンド抜粋（player-a が garbagesmash で敗北する側）。
// 期待 fumen は同じ fixture に対する Jest（simulator + ir_to_page + encode）の
// 決定論的な出力から取得している。値を変える前に .agents/skills/e2e/SKILL.md の
// fumen 分類手順を踏むこと。
//
// いずれも 2 ページ構成で、1 ページ目は visit({mode:'edit'}) の既定の空白ページ
// （= 切り出しが既存ページを上書きしていない証拠）、2 ページ目が取り込んだ地点。
// 盤面に続く quiz コメント（#Q=[hold](current)next...）は Editor へ引き継ぐ
// HOLD / カレント / NEXT を表す。NEXT は画面表示の5件ではなく、リプレイから
// 読める分（エンジンのキュー全件）が入る。カレントは quiz だけでなく
// spawn 位置の操作対象ミノとしてもページに載る（2 ページ目の piece）。
const FIXTURE = 'src/lib/ttrm/__tests__/fixtures/league_loss.json';
const PLAYER_A_LOCKS = 78;
const TERMINAL_FUMEN = 'v115@vhAAgHEeAtBeAtxhilBtAeBtwhQ4AeAtywglQ4g0wh?'
    + 'g0Q4AeBtywAtwhI8AeI8AeG8AeG8AeI8AeI8AeI8AeI8AeL?'
    + '8AeI8AeI8AeI8AeI8AeC8AeM8AeI8AeI8AeI8AeI8AeC8Je?'
    + 'TnWgAFLDmClcJSAVDVSAVG88A4W88AZyTxCKeHgCzXWWC';
const LOCK1_FUMEN = 'v115@vhAAgHRhRpHeRpReRsWgAFLDmClcJSAVDEHBEooRBJ?oAVBsuLuCq3/wCPd9VC';

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
        operations.replay.board('self').should('exist');

        // 4. 手番送りと終端（FR-21/28）。最終 lock の次は終端状態になる
        operations.replay.next();
        cy.get(datatest('replay-lock-counter')).should('contain', `2 / ${PLAYER_A_LOCKS}`);
        operations.replay.prev();
        cy.get(datatest('replay-lock-counter')).should('contain', `1 / ${PLAYER_A_LOCKS}`);
        // P2 §7-2 の意図的変更: 先頭ボタンは「手番 1」ではなく「開始（設置 0）」へ戻る
        operations.replay.first();
        cy.get(datatest('replay-lock-counter')).should('contain', 'Start');
        operations.replay.next();
        cy.get(datatest('replay-lock-counter')).should('contain', `1 / ${PLAYER_A_LOCKS}`);

        operations.replay.last();
        cy.get(datatest('replay-lock-counter')).should('contain', 'End');
        cy.get(datatest('replay-lock-counter')).should('contain', 'garbagesmash');

        // 6. この地点は 25 行スタックなので切り捨てチップが出る（FR-56）
        cy.get(datatest('replay-clip-notice')).should('be.visible');

        // 5. Editor へ遷移し、既存ページの次に新規ページとして挿入される
        operations.replay.openInEditor();
        cy.get(datatest('replay-screen')).should('not.exist');
        cy.get(datatest('tools')).find(datatest('text-pages')).should('have.text', '2 / 2');
        expectFumen(TERMINAL_FUMEN);
    });

    it('inserts as a new page and opens the INPUT layout without overwriting edits', () => {
        visit({ mode: 'edit' });

        // Editor で 1 ブロック描いておく（この編集は保持されなければならない）
        operations.mode.block.open();
        operations.mode.block.Gray();
        operations.mode.block.click(0, 0);

        operations.replay.open();
        importLeagueLoss();
        operations.replay.selectSelfPlayer('player-a-id');
        operations.replay.start();
        operations.replay.openInEditor();

        // 確認を挟まず遷移し、INPUT レイアウト（HOLD/NEXT キュー）で開く
        cy.get(datatest('replay-screen')).should('not.exist');
        cy.get(datatest('editor-rail')).should('have.attr', 'data-piece-layout', 'play');

        // カレント（手番1では I）が spawn 位置の操作対象ミノとして載っている
        for (const x of [3, 4, 5, 6]) {
            cy.get(block(x, 20)).should('have.attr', 'color', Color.I.Highlight2);
        }

        // 描いたブロックは 1 ページ目に残り、取り込んだ地点が 2 ページ目になる
        cy.get(datatest('tools')).find(datatest('text-pages')).should('have.text', '2 / 2');
        operations.menu.firstPage();
        cy.get(block(0, 0)).should('have.attr', 'color', Color.Gray.Normal);
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

    // ---- P2: 相手盤面と時間軸 ----

    // 再生フェーズまで一気に進める共通手順。
    // reload は同一テスト内で 2 回目に呼ぶとき用。cy.visit は同じ URL・同じハッシュだと
    // 再読み込みしないため、Replay 画面に留まったままになる。
    const startPlaying = ({ selfId = 'player-a-id', reload = false } = {}) => {
        visit({ mode: 'edit', reload });
        operations.replay.open();
        importLeagueLoss();
        operations.replay.selectSelfPlayer(selfId);
        operations.replay.selectRound(0);
        operations.replay.start();
    };

    // カウンタ文字列からポイント index を読む。'Piece 12 / 78' → 12、
    // 開始地点（設置 0）は 'Start' と出るので 0 に読み替える。
    const pieceNumberOf = ($el) => {
        const text = $el.text();
        const matched = /(\d+)\s*\/\s*\d+/.exec(text);
        if (matched !== null) {
            return Number(matched[1]);
        }
        return text.includes('Start') ? 0 : null;
    };

    it('shows the opponent board at the same instant as your own (FR-30)', () => {
        cy.clearLocalStorage();
        startPlaying();

        operations.replay.board('self').should('exist');
        operations.replay.board('opponent').should('exist');
        cy.get(datatest('replay-opponent-counter')).should('exist');

        // 相手の手番は自陣と独立に進む。両者の設置数は一致しないので、
        // 自陣を 5 手送った時点で相手が同じ手番数になっている保証はない。
        cy.get(datatest('replay-opponent-counter')).then(($before) => {
            const opponentBefore = pieceNumberOf($before);

            for (let i = 0; i < 5; i += 1) {
                operations.replay.next();
            }
            cy.get(datatest('replay-lock-counter')).should('contain', `6 / ${PLAYER_A_LOCKS}`);

            // 相手側も同一時刻の地点まで進む（進んだかどうかは時刻依存なので、
            // 後退しないことと盤面が出続けることを見る）
            cy.get(datatest('replay-opponent-counter')).then(($after) => {
                const opponentAfter = pieceNumberOf($after);
                if (opponentBefore !== null && opponentAfter !== null) {
                    expect(opponentAfter).to.be.at.least(opponentBefore);
                }
            });
            operations.replay.board('opponent').should('exist');
        });
    });

    it('remembers that the opponent board is hidden (FR-34)', () => {
        cy.clearLocalStorage();
        startPlaying();

        operations.replay.board('opponent').should('exist');
        operations.replay.toggleOpponent();
        operations.replay.board('opponent').should('not.exist');
        operations.replay.board('self').should('exist');

        // 再訪問しても消えたまま（localStorage 経由の復元）
        startPlaying({ reload: true });
        operations.replay.board('opponent').should('not.exist');

        // 戻せることも確認しておく
        operations.replay.toggleOpponent();
        operations.replay.board('opponent').should('exist');
    });

    it('swaps the two sides while holding the playback position (FR-11/12)', () => {
        cy.clearLocalStorage();
        startPlaying();

        for (let i = 0; i < 9; i += 1) {
            operations.replay.next();
        }
        cy.get(datatest('replay-lock-counter')).should('contain', `10 / ${PLAYER_A_LOCKS}`);

        cy.get(datatest('replay-time-label')).invoke('text').then((timeBefore) => {
            cy.get(datatest('replay-opponent-counter')).invoke('text').then((opponentBefore) => {
                operations.replay.swapSides();

                // 時刻は動かない
                cy.get(datatest('replay-time-label')).should('have.text', timeBefore);
                // 自陣に出るのは、入れ替え前に相手側で見えていた手番
                const swappedPiece = /(\d+)\s*\/\s*\d+/.exec(opponentBefore);
                if (swappedPiece !== null) {
                    cy.get(datatest('replay-lock-counter'))
                        .should('contain', `${swappedPiece[1]} / `);
                }
            });
        });
    });

    // FR-55（相手盤面の fumen 化）は入れ替え → 切り出しで到達できる（P2 §3-8）
    it('exports the opponent side by swapping first', () => {
        cy.clearLocalStorage();
        startPlaying();

        operations.replay.swapSides();
        operations.replay.openInEditor();

        cy.get(datatest('replay-screen')).should('not.exist');
        cy.get(datatest('tools')).find(datatest('text-pages')).should('have.text', '2 / 2');
    });

    it('plays on a clock and stops when paused (FR-23/27)', () => {
        cy.clearLocalStorage();
        startPlaying();

        cy.get(datatest('replay-timeline')).invoke('val').then((startValue) => {
            const start = Number(startValue);

            // Date と interval だけを差し替える。setTimeout / rAF は実物のままにして
            // Hyperapp の再描画を止めない。
            cy.clock(Date.now(), ['Date', 'setInterval', 'clearInterval']);

            // 1 倍で 2 秒 = 120 フレーム進む
            operations.replay.playPause();
            cy.tick(2000);
            cy.get(datatest('replay-timeline')).should('have.value', String(start + 120));

            // 一時停止後は進まない
            operations.replay.playPause();
            cy.tick(2000);
            cy.get(datatest('replay-timeline')).should('have.value', String(start + 120));

            // 2 倍だと同じ 1 秒で 2 倍進む
            operations.replay.setSpeed(2);
            operations.replay.playPause();
            cy.tick(1000);
            cy.get(datatest('replay-timeline')).should('have.value', String(start + 240));
            operations.replay.playPause();
        });
    });

    it('seeks to an arbitrary time on the timeline (FR-25)', () => {
        cy.clearLocalStorage();
        startPlaying();

        // 先頭へシークすると開始地点（設置 0）になる
        operations.replay.seek(0);
        cy.get(datatest('replay-lock-counter')).should('contain', 'Start');
        cy.get(datatest('replay-time-label')).should('contain', '0:00.0');

        // 終端へシークすると終了地点になる
        cy.get(datatest('replay-timeline')).invoke('attr', 'max').then((max) => {
            operations.replay.seek(Number(max));
            cy.get(datatest('replay-lock-counter')).should('contain', 'End');
        });
    });

    it('steps by the opponent placements when the basis is switched (FR-22)', () => {
        cy.clearLocalStorage();
        startPlaying();

        operations.replay.setBasis('opponent');
        cy.get(datatest('replay-opponent-counter')).then(($before) => {
            const before = pieceNumberOf($before);
            expect(before, 'opponent point index before stepping').to.not.equal(null);

            operations.replay.next();
            cy.get(datatest('replay-opponent-counter')).then(($after) => {
                // 相手基準では相手の設置が 1 つずつ進む
                expect(pieceNumberOf($after)).to.equal(before + 1);
            });
        });
    });

    it('shows only 3 opponent NEXT pieces on a phone', () => {
        cy.clearLocalStorage();
        startPlaying();

        cy.get(datatest('replay-opponent-next-2')).should('exist');
        cy.get(datatest('replay-opponent-next-3')).should('not.exist');
    });

    // ---- PC レイアウト（P2 §3-6-2）----

    // PC 判定は UA ではなく ?mobile=1 の有無で決まる（states.ts の getPlatform）。
    // mobile: false で PC 扱いになり、viewport 幅で wide / narrow が分かれる。
    const startPlayingOnPC = ({ width = 1280, reload = false } = {}) => {
        cy.viewport(width, 800);
        visit({ mode: 'edit', mobile: false, reload });
        operations.replay.open();
        importLeagueLoss();
        operations.replay.selectSelfPlayer('player-a-id');
        operations.replay.selectRound(0);
        operations.replay.start();
    };

    const boardWidth = (side) => operations.replay.board(side).then(($el) => $el.width());

    it('draws both boards at the same size on PC', () => {
        cy.clearLocalStorage();
        startPlayingOnPC();

        boardWidth('self').then((self) => {
            boardWidth('opponent').then((opponent) => {
                expect(opponent, 'opponent board width').to.equal(self);
            });
        });
    });

    it('gives the opponent the same NEXT queue as your own on PC', () => {
        cy.clearLocalStorage();
        startPlayingOnPC();

        // 自陣と同じ縦列 5 件。モバイルの横並び 3 件から増える
        cy.get(datatest('replay-next-4')).should('exist');
        cy.get(datatest('replay-opponent-next-4')).should('exist');
        cy.get(datatest('replay-opponent-hold-0')).should('exist');
    });

    it('keeps both piece counters usable on PC', () => {
        cy.clearLocalStorage();
        startPlayingOnPC();

        cy.get(datatest('replay-lock-counter')).should('contain', `1 / ${PLAYER_A_LOCKS}`);
        cy.get(datatest('replay-opponent-counter')).should('exist');

        operations.replay.next();
        cy.get(datatest('replay-lock-counter')).should('contain', `2 / ${PLAYER_A_LOCKS}`);
    });

    it('swaps which player is yours on PC (FR-11/12)', () => {
        cy.clearLocalStorage();
        startPlayingOnPC();

        // 左が自陣で固定。入れ替えると見出しのプレイヤー名が左右で入れ替わる
        cy.get(datatest('replay-side-self')).should('contain', 'player-a');
        cy.get(datatest('replay-side-opponent')).should('contain', 'player-b');

        cy.get(datatest('replay-time-label')).invoke('text').then((timeBefore) => {
            operations.replay.swapSides();

            cy.get(datatest('replay-time-label')).should('have.text', timeBefore);
            cy.get(datatest('replay-side-self')).should('contain', 'player-b');
            cy.get(datatest('replay-side-opponent')).should('contain', 'player-a');
        });
    });

    it('hides the opponent side on PC too (FR-34)', () => {
        cy.clearLocalStorage();
        startPlayingOnPC();

        operations.replay.board('opponent').should('exist');
        operations.replay.toggleOpponent();
        operations.replay.board('opponent').should('not.exist');
        operations.replay.board('self').should('exist');
    });

    it('falls back to the shrunken opponent board in a narrow PC window', () => {
        cy.clearLocalStorage();
        startPlayingOnPC({ width: 600 });

        // 幅が閾値を下回るので、PC でもモバイルと同じ縮小並置になる
        boardWidth('self').then((self) => {
            boardWidth('opponent').then((opponent) => {
                expect(opponent, 'opponent board width').to.be.lessThan(self);
            });
        });
        cy.get(datatest('replay-opponent-next-3')).should('not.exist');
    });

});

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
// 手番送りは「その手が接地して確定する直前」で止まるので、手番 1 の切り出しは
// 1 手目を置いた後ではなく置く前の局面になる。旧期待値は
// 'v115@vhAAgHRhRpHeRpReRsWgAFLDmClcJSAVDEHBEooRBJ?oAVBsuLuCq3/wCPd9VC' で、
// 盤面に O が固定済み・カレントが次の I・quiz が '#Q=[](I)LTZSJZJTOSIL' だった。
// 新期待値は空盤面・カレントが 1 手目の O・quiz が '#Q=[](O)ILTZSJZJTOSIL'。
// 双方をデコードして差分が「1 手ぶんの前倒し」であることを確認済み（意図した仕様変更）。
const LOCK1_FUMEN = 'v115@vhBAgHTnWhAFLDmClcJSAVDEHBEooRBPoAVBpCmFDz?fzPCU3LMCsAAAA';
// 手番 1 で接地している 1 手目の O（盤面左下）。停止位置が接地直前であることの目印。
const LOCK1_CELLS = '[[0,1],[1,1],[0,0],[1,0]]';

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

        // 3. 再生フェーズへ。初手の操作・自由落下を見せるためframe 0から始まる
        operations.replay.start();
        cy.get(datatest('replay-lock-counter')).should('contain', 'Start');
        operations.replay.board('self').should('exist');

        // 4. 手番送りと終端（FR-21/28）。最終 lock の次は終端状態になる
        operations.replay.next();
        cy.get(datatest('replay-lock-counter')).should('contain', `1 / ${PLAYER_A_LOCKS}`);
        operations.replay.prev();
        cy.get(datatest('replay-lock-counter')).should('contain', 'Start');
        // P2 §7-2 の意図的変更: 先頭ボタンは「手番 1」ではなく「開始（設置 0）」へ戻る。
        // すでに開始地点なのでボタンは無効になる。
        cy.get(datatest('btn-replay-first')).should('have.class', 'disabled');
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

    it('supports keyboard transport and protects endpoint jumps with a lock', () => {
        cy.clearLocalStorage();
        startPlaying();

        operations.replay.pressRight();
        cy.get(datatest('replay-lock-counter')).should('contain', `1 / ${PLAYER_A_LOCKS}`);
        operations.replay.pressLeft();
        cy.get(datatest('replay-lock-counter')).should('contain', 'Start');

        cy.get(datatest('btn-replay-endpoint-lock'))
            .should('have.attr', 'aria-pressed', 'false');
        operations.replay.endpointLock();
        cy.get(datatest('btn-replay-endpoint-lock'))
            .should('have.attr', 'aria-pressed', 'true')
            .and('have.attr', 'data-locked', 'true');
        cy.get(datatest('btn-replay-first')).should('have.class', 'disabled')
            .and('have.attr', 'data-endpoint-locked', 'true');
        cy.get(datatest('btn-replay-last')).should('have.class', 'disabled')
            .and('have.attr', 'data-endpoint-locked', 'true');

        cy.get(datatest('replay-lock-counter')).should('contain', 'Start');
        operations.replay.next();
        cy.get(datatest('replay-lock-counter')).should('contain', `1 / ${PLAYER_A_LOCKS}`);

        operations.replay.pressSpace();
        cy.get(datatest('btn-replay-play-pause')).find('i').should('contain', 'pause');
        operations.replay.pressSpace();
        cy.get(datatest('btn-replay-play-pause')).find('i').should('contain', 'play_arrow');
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

        // frame 0 のカレントOミノが、従来どおりspawn位置の操作対象として載っている
        for (const [x, y] of [[4, 20], [5, 20], [4, 21], [5, 21]]) {
            cy.get(block(x, y)).should('have.attr', 'color', Color.O.Highlight2);
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
            cy.get(datatest('replay-lock-counter')).should('contain', `5 / ${PLAYER_A_LOCKS}`);

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
        cy.get(datatest('replay-lock-counter')).should('contain', `9 / ${PLAYER_A_LOCKS}`);

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
            // 16ms interval の最後の tick は 992ms 地点なので、range が整数表示へ
            // 切り捨てるぶんだけ1フレーム未満の差を許容する。
            cy.get(datatest('replay-timeline')).invoke('val').should((value) => {
                expect(Number(value)).to.be.within(start + 239, start + 240);
            });
            operations.replay.playPause();
        });
    });

    it('replays the first mino movement and free-fall on the frame axis', () => {
        cy.clearLocalStorage();
        startPlaying();

        operations.replay.active('self')
            .should('have.attr', 'data-active-piece', 'O')
            .invoke('attr', 'data-active-cells')
            .then((initialCells) => {
                operations.replay.seek(20);
                operations.replay.active('self')
                    .should('have.attr', 'data-active-cells')
                    .and('not.equal', initialCells);
            });

        // 手番送りは接地直前で止まる。1 手目の O が、確定前の姿勢で盤面に載る
        operations.replay.next();
        operations.replay.active('self')
            .should('have.attr', 'data-active-piece', 'O')
            .and('have.attr', 'data-active-cells', LOCK1_CELLS);
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

    it('always steps by your placements and has no basis selector', () => {
        cy.clearLocalStorage();
        startPlaying();

        cy.get(datatest('btn-replay-basis-self')).should('not.exist');
        cy.get(datatest('btn-replay-basis-opponent')).should('not.exist');
        cy.get(datatest('replay-lock-counter')).then(($before) => {
            const before = pieceNumberOf($before);
            expect(before, 'self point index before stepping').to.not.equal(null);

            operations.replay.next();
            cy.get(datatest('replay-lock-counter')).then(($after) => {
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

    it('anchors replay rates to the bottom of the field', () => {
        cy.clearLocalStorage();
        startPlayingOnPC();
        operations.replay.next();

        ['self', 'opponent'].forEach((side) => {
            const prefix = side === 'self' ? 'replay-side-stats' : 'replay-opponent-side-stats';
            const fieldPrefix = side === 'self' ? 'replay-field-stats' : 'replay-opponent-field-stats';
            ['pps', 'apm', 'app'].forEach((metric) => {
                cy.get(datatest(`${prefix}-${metric}`)).invoke('text')
                    .should('match', new RegExp(`^-?\\d+\\.\\d{2} ${metric}$`));
            });
            ['vs', 'area'].forEach((metric) => {
                cy.get(datatest(`${fieldPrefix}-${metric}`)).invoke('text')
                    .should('match', new RegExp(`^-?\\d+\\.\\d{2} ${metric}$`));
            });
            operations.replay.stats(side).then(($stats) => {
                operations.replay.board(side).then(($board) => {
                    const statsRect = $stats[0].getBoundingClientRect();
                    const boardRect = $board[0].getBoundingClientRect();
                    expect(Math.abs(statsRect.bottom - boardRect.bottom)).to.be.lessThan(2);
                    expect(statsRect.right).to.be.lessThan(boardRect.left);
                });
            });
            operations.replay.fieldStats(side).then(($stats) => {
                operations.replay.board(side).then(($board) => {
                    const statsRect = $stats[0].getBoundingClientRect();
                    const boardRect = $board[0].getBoundingClientRect();
                    expect(Math.abs(statsRect.bottom - boardRect.bottom)).to.be.lessThan(2);
                    expect(statsRect.left).to.be.greaterThan(boardRect.right);
                });
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

        cy.get(datatest('replay-lock-counter')).should('contain', 'Start');
        cy.get(datatest('replay-opponent-counter')).should('exist');

        operations.replay.next();
        cy.get(datatest('replay-lock-counter')).should('contain', `1 / ${PLAYER_A_LOCKS}`);
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

    // ---- ガベージ（P3 / FR-40〜45, 54）----

    // fixture（player-a）のガベージ実測。frame 1697 に 5 行受信し、
    // frame 1808 に列 5 で全量が盤面へ入る。frame 1800 はその間。
    const GAUGE_FRAME = 1800;
    const GAUGE_ROWS = '5';
    const GAUGE_HOLE_COLUMN = '5';
    // frame 262 のT-spin double直前。2行の保留を5 attackで相殺する。
    const CANCEL_FRAME = 261;
    // 最後の攻撃（死因）は受信側confirm時刻2519ではなく、raw IGEに記録された
    // 送信側クロックのframe 2483で生成されている。
    const KILLER_SENDER_TIME = '0:41.4';
    // GAUGE_FRAME での切り出し。盤面と quiz は P2 と同じで、せり上がり行だけが増える。
    // 生成手順は Jest（simulator → garbage → ir_to_page → encode）と同一。
    // frame 1728 のHOLDも再現するため、この中間frameでは旧lock地点の(T)ではなく
    // 実際の操作中(J)がspawn位置のcurrentになり、HOLDは[T]になる。
    const GAUGE_FUMEN = 'v115@vhAAgHpgQ4EeglBewhR4BtilBewhg0Q4AeBtywAtwh?'
        + 'I8AeI8AeG8AeG8AeD8VkYkAFLDmClcJSAVTXSAVG88AYe88?'
        + 'A52TxCs3HgCpuHgCMdNFD';

    it('shows the garbage gauge for both sides (FR-40)', () => {
        cy.clearLocalStorage();
        startPlaying();

        // ゲージ 0 でも枠は残す（盤面位置を動かさないため）
        operations.replay.gauge('self').should('have.attr', 'data-gauge', '0');
        operations.replay.gauge('opponent').should('exist');

        operations.replay.seek(GAUGE_FRAME);
        operations.replay.gauge('self').should('have.attr', 'data-gauge', GAUGE_ROWS);
        operations.replay.gauge('self').should('contain', GAUGE_ROWS);
        operations.replay.gaugeSegments('self')
            .should('have.length', 1)
            .and('have.attr', 'data-rows', GAUGE_ROWS);
        operations.replay.gaugeBar('self').then(($bar) => {
            operations.replay.gaugeSegments('self').then(($segments) => {
                const bar = $bar[0].getBoundingClientRect();
                const segment = $segments[0].getBoundingClientRect();
                expect(segment.bottom).to.be.closeTo(bar.bottom - 1, 0.5);
                operations.replay.board('self').then(($board) => {
                    const cellHeight = $board[0].getBoundingClientRect().width / 10;
                    expect(segment.height).to.be.closeTo(cellHeight * Number(GAUGE_ROWS), 0.5);
                });
            });
        });
        cy.get(datatest('replay-stat-gauge')).should('contain', GAUGE_ROWS);
    });

    it('previews the row that actually rises next (FR-42/43)', () => {
        cy.clearLocalStorage();
        startPlaying();

        // 保留が無いあいだは予告を出さない
        operations.replay.risePreview().should('not.exist');

        operations.replay.seek(GAUGE_FRAME);
        operations.replay.risePreview().should('exist');
        cy.get(datatest('replay-rise-preview-label'))
            .should('have.text', '+5')
            .and('have.attr', 'data-column', GAUGE_HOLE_COLUMN)
            .and('have.attr', 'data-rows', '5');
        // 穴は 1 列だけ空き、それが実際に開いた列である
        operations.replay.riseHole().should('have.length', 1);
        operations.replay.riseHole().should('have.attr', 'data-column', GAUGE_HOLE_COLUMN);
    });

    it('names the attack that ended the round and jumps to it (FR-45)', () => {
        cy.clearLocalStorage();
        startPlaying();

        operations.replay.killer().should('not.exist');

        operations.replay.last();
        cy.get(datatest('replay-lock-counter')).should('contain', 'garbagesmash');
        operations.replay.killer().should('be.visible');
        // 死因になった攻撃の行数と穴列が読める
        operations.replay.killer().should('contain', '5');
        operations.replay.killer().should('contain', KILLER_SENDER_TIME);

        // 共通フレーム軸なので、相手が撃った瞬間へそのまま跳べる
        operations.replay.killerSeek();
        cy.get(datatest('replay-time-label')).should('contain', KILLER_SENDER_TIME);
    });

    it('always shows garbage information and ignores the former saved visibility setting', () => {
        cy.clearLocalStorage();
        cy.window().then((win) => {
            win.localStorage.setItem('view-settings@1', JSON.stringify({ replayShowGarbage: false }));
        });
        startPlaying();

        operations.replay.seek(GAUGE_FRAME);
        operations.replay.gauge('self').should('exist');
        operations.replay.risePreview().should('exist');
        cy.get(datatest('replay-garbage-markers')).should('exist');

        operations.replay.board('self').should('exist');
    });

    it('carries the gauge into the exported page (FR-54)', () => {
        cy.clearLocalStorage();
        startPlaying();

        operations.replay.seek(GAUGE_FRAME);
        operations.replay.openInEditor();

        cy.get(datatest('replay-screen')).should('not.exist');
        cy.get(datatest('tools')).find(datatest('text-pages')).should('have.text', '2 / 2');
        expectFumen(GAUGE_FUMEN);
    });

    it('continues the replay gauge, B2B/Combo and multi-row tank in INPUT', () => {
        cy.clearLocalStorage();
        startPlayingOnPC();

        operations.replay.seek(GAUGE_FRAME);
        operations.replay.openInEditor();

        operations.inputReplay.fieldGauge().should('have.attr', 'data-gauge', GAUGE_ROWS);
        operations.inputReplay.fieldGaugeSegments()
            .should('have.length', 1)
            .and('have.attr', 'data-rows', GAUGE_ROWS);
        operations.inputReplay.fieldGaugeBar().then(($bar) => {
            operations.inputReplay.fieldGaugeSegments().then(($segments) => {
                const bar = $bar[0].getBoundingClientRect();
                const segment = $segments[0].getBoundingClientRect();
                expect(segment.bottom).to.be.closeTo(bar.bottom - 1, 0.5);
                cy.get(datatest('editor-field-frame')).then(($field) => {
                    const cellHeight = ($field[0].getBoundingClientRect().width - 1) / 10;
                    expect(segment.height).to.be.closeTo(cellHeight * Number(GAUGE_ROWS), 0.5);
                });
            });
        });
        operations.inputReplay.b2b().should('exist');
        operations.inputReplay.combo().should('contain', 'Combo');
        cy.get(datatest('input-stats-action')).should('have.text', '—');

        // 元リプレイと同じく次lockはライン消去なし。cap内の5行が1手で同時に上がる。
        operations.mode.piece.harddrop();
        operations.inputReplay.fieldGauge().should('have.attr', 'data-gauge', '0');
        operations.inputReplay.fieldGaugeSegments().should('not.exist');
        operations.inputReplay.damage().should('have.attr', 'data-value', '0:0:0:5');
    });

    it('opens Replay from the shortcut above the INPUT NEXT queue', () => {
        cy.clearLocalStorage();
        startPlayingOnPC();

        operations.replay.seek(GAUGE_FRAME);
        operations.replay.openInEditor();
        cy.get(datatest('btn-open-replay-input')).should('be.visible');

        operations.inputReplay.openReplay();
        cy.get(datatest('replay-screen')).should('exist');
    });

    it('cancels pending garbage with an INPUT line clear', () => {
        cy.clearLocalStorage();
        startPlayingOnPC();

        operations.replay.seek(CANCEL_FRAME);
        operations.replay.openInEditor();
        operations.inputReplay.fieldGauge().should('have.attr', 'data-gauge', '2');

        // 元リプレイ同様、Spawnで床へ下ろし、Rightでさらに下ろしてから
        // Reverseへ回してT-spin doubleへ入れる。
        operations.mode.piece.softdrop();
        operations.mode.piece.rotateToRight();
        operations.mode.piece.softdrop();
        operations.mode.piece.rotateToRight();
        operations.mode.piece.harddrop();

        operations.inputReplay.fieldGauge().should('have.attr', 'data-gauge', '0');
        operations.inputReplay.damage().should('have.attr', 'data-value', '5:2:3:0');
    });

    // §7-2 の懸念 1: ゲージ 0 の地点にせり上がり行を混ぜない（盤面と quiz は接地直前のもの）
    it('exports a gauge-free turn stop without any sent line (FR-54)', () => {
        cy.clearLocalStorage();
        startPlaying();

        operations.replay.next();
        cy.get(datatest('replay-lock-counter')).should('contain', `1 / ${PLAYER_A_LOCKS}`);
        operations.replay.gauge('self').should('have.attr', 'data-gauge', '0');
        operations.replay.openInEditor();

        expectFumen(LOCK1_FUMEN);
    });

    it('takes the gauge from the swapped-in side (FR-11 x FR-54)', () => {
        cy.clearLocalStorage();
        startPlaying();

        // frame 1800 では自陣にゲージ 5、相手は 0
        operations.replay.seek(GAUGE_FRAME);
        operations.replay.gauge('self').should('have.attr', 'data-gauge', GAUGE_ROWS);
        operations.replay.gauge('opponent').should('have.attr', 'data-gauge', '0');

        operations.replay.swapSides();
        // 入れ替え後の自陣は元の相手なので、ゲージも入れ替わる
        operations.replay.gauge('self').should('have.attr', 'data-gauge', '0');
        operations.replay.gauge('opponent').should('have.attr', 'data-gauge', GAUGE_ROWS);
        operations.replay.risePreview().should('not.exist');
    });

    // Cold Clear による手評価解析。探索は時間打ち切りで非決定的なので、
    // スコアの具体値ではなく「解析が最後まで進み、グラフと集計が出て、
    // そこからシークできる」ことだけを検証する。
    describe('AI analysis', () => {
        it('analyzes every lock and lets the graph seek to a move', () => {
            cy.clearLocalStorage();
            startPlaying();

            // 未解析ではグラフも集計も出ない
            operations.replay.analysis.panel().should('exist');
            operations.replay.analysis.graph().should('not.exist');
            operations.replay.analysis.summary().should('not.exist');

            // 実 WASM 探索を 78 手ぶん走らせるので最短プリセットにする
            operations.replay.analysis.setThinkMs(100);
            operations.replay.analysis.start();
            operations.replay.analysis.progress().should('have.attr', 'data-status', 'running');
            operations.replay.analysis.waitDone();

            operations.replay.analysis.progress()
                .should('have.attr', 'data-total', String(PLAYER_A_LOCKS))
                .should('have.attr', 'data-current', String(PLAYER_A_LOCKS));
            operations.replay.analysis.graph().should('be.visible');

            operations.replay.analysis.summary().then(($summary) => {
                const rate = Number($summary.attr('data-match-rate'));
                const analyzed = Number($summary.attr('data-analyzed'));
                expect(rate, 'match rate').to.be.within(0, 100);
                expect(analyzed, 'analyzed moves').to.be.greaterThan(0);
                expect(analyzed + Number($summary.attr('data-unmatched'))
                    + Number($summary.attr('data-skipped')), 'moves accounted for')
                    .to.equal(PLAYER_A_LOCKS);
            });

            // 解析はカーソルを動かさない。ワースト手を押すとその手番へ飛ぶ
            cy.get(datatest('replay-lock-counter')).should('contain', 'Start');
            operations.replay.analysis.worst(0).then(($button) => {
                const index = Number($button.text().replace(/^#(\d+).*$/, '$1'));
                cy.wrap($button).click();
                cy.get(datatest('replay-lock-counter')).should('contain', `${index} / ${PLAYER_A_LOCKS}`);
                operations.replay.analysis.current().should('have.attr', 'data-index', String(index));
                // 評価した手そのものが見えている（設置直前で止まる）
                operations.replay.active('self').should('exist');
            });
        });

        it('keeps partial results when stopped and drops them when the side changes', () => {
            cy.clearLocalStorage();
            startPlaying();

            operations.replay.analysis.setThinkMs(100);
            operations.replay.analysis.start();
            // 数手ぶん進んでから止める（部分結果が残ることを見たい）
            operations.replay.analysis.progress({ timeout: 60000 })
                .should('not.have.attr', 'data-current', '0');
            operations.replay.analysis.abort();

            operations.replay.analysis.progress().should('have.attr', 'data-status', 'aborted');
            operations.replay.analysis.progress().then(($progress) => {
                expect(Number($progress.attr('data-current')), 'partial progress')
                    .to.be.within(1, PLAYER_A_LOCKS - 1);
            });
            operations.replay.analysis.graph().should('exist');

            // 自陣が変われば解析結果は無効になる
            operations.replay.swapSides();
            operations.replay.analysis.graph().should('not.exist');
            operations.replay.analysis.summary().should('not.exist');
        });
    });

    it('keeps both gauges the same size on PC', () => {
        cy.clearLocalStorage();
        startPlayingOnPC();

        operations.replay.seek(GAUGE_FRAME);
        operations.replay.gauge('self').then(($self) => {
            operations.replay.gauge('opponent').then(($opponent) => {
                expect($opponent.width(), 'opponent gauge width').to.equal($self.width());
                expect($opponent.height(), 'opponent gauge height').to.equal($self.height());
            });
        });
        // 盤面は P2 と同じく左右で等寸のまま
        boardWidth('self').then((self) => {
            boardWidth('opponent').then((opponent) => {
                expect(opponent, 'opponent board width').to.equal(self);
            });
        });
    });

});

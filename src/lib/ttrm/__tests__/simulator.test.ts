import { FieldConstants, Piece } from '../../enums';
import { minoToPiece } from '../board_converter';
import { buildReplayIR, simulatePlayerRound } from '../simulator';
import { activeAtFrame, boardAtFrame } from '../timeline';
import { IRField, TtrmFile } from '../types';

const leagueWin = require('./fixtures/league_win.json') as TtrmFile;
const leagueLoss = require('./fixtures/league_loss.json') as TtrmFile;
const privateSwapped = require('./fixtures/private_swapped.json') as TtrmFile;

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

// Raw .ttrm boards are top-down (board[39] is the bottom row) with string
// cells; convert the bottom 23 rows to the IR layout for comparison.
const rawBoardToIRField = (board: any[][]): IRField => {
    const field: IRField = [];
    for (let y = 0; y < FieldConstants.Height; y += 1) {
        const row = board[board.length - 1 - y] || [];
        for (let x = 0; x < FieldConstants.Width; x += 1) {
            const cell = row[x];
            if (cell === null || cell === undefined) {
                field.push(Piece.Empty);
            } else {
                field.push(minoToPiece(typeof cell === 'object' ? cell.mino : cell));
            }
        }
    }
    return field;
};

describe('simulator', () => {
    test('league win round: stats self-check passes for both players (FR-63)', () => {
        const ir = buildReplayIR(leagueWin);
        expect(ir.rounds).toHaveLength(1);
        const round = ir.rounds[0];
        expect(round.status).toEqual('ok');
        expect(round.result.winnerId).toEqual('player-a-id');
        for (const player of round.players) {
            expect(player.verification.matched).toBeTruthy();
            expect(player.locks.length).toEqual(player.verification.piecesplaced.expected);
        }
    });

    test('losing side terminal contains the killing garbage (RV-01)', () => {
        const loser = leagueLoss.replay.rounds[0].find(p => p.id === 'player-a-id')!;
        const result = simulatePlayerRound(loser);
        expect(result.verification.matched).toBeTruthy();
        expect(result.terminal.alive).toBeFalsy();
        expect(result.terminal.reason).toEqual('garbagesmash');

        // In engine 4.2.7 the killing garbage tanks within the final lock
        // processing, so the terminal (and the last lock) must show a board
        // dominated by garbage rows: 9 gray cells + 1 hole per row.
        const lastLock = result.locks[result.locks.length - 1];
        expect(result.terminal.frame).toBeGreaterThan(lastLock.frame);
        const garbageRows = Array.from({ length: FieldConstants.Height }).filter((ignore, y) => {
            const row = result.terminal.field.slice(y * 10, (y + 1) * 10);
            return row.filter(cell => cell === Piece.Gray).length === 9
                && row.filter(cell => cell === Piece.Empty).length === 1;
        }).length;
        expect(garbageRows).toBeGreaterThanOrEqual(15);

        // Early in the round the board had no such garbage wall.
        const earlyGray = result.locks[0].fieldAfter.filter(cell => cell === Piece.Gray).length;
        expect(earlyGray).toBeLessThan(20);
    });

    test('losing side terminal matches end.data.game.board exactly', () => {
        const loser = leagueLoss.replay.rounds[0].find(p => p.id === 'player-a-id')!;
        const endEvent = loser.replay.events.find(e => e.type === 'end')!;
        const expected = rawBoardToIRField(endEvent.data.game.board);
        const result = simulatePlayerRound(loser);
        expect(result.terminal.field).toEqual(expected);
    });

    test('private room round with swapped seat order resolves players by id (FR-15)', () => {
        const ir = buildReplayIR(privateSwapped);
        const round = ir.rounds[0];
        expect(round.status).toEqual('ok');
        expect(round.players.map(p => p.id)).toEqual(['player-a-id', 'player-b-id']);
        expect(round.result.winnerId).toEqual('player-a-id');
        for (const player of round.players) {
            expect(player.verification.matched).toBeTruthy();
        }
    });

    test('a self-check mismatch marks the round as failed (FR-61/63)', () => {
        const tampered = clone(leagueWin);
        tampered.replay.rounds[0][0].replay.results.stats.piecesplaced += 1;
        const ir = buildReplayIR(tampered);
        expect(ir.rounds[0].status).toEqual('failed');
        expect(ir.rounds[0].failure!.stage).toEqual('verify');
    });

    test('non-standard board width is rejected as failed (FR-04)', () => {
        const tampered = clone(leagueWin);
        for (const player of tampered.replay.rounds[0]) {
            player.replay.options.boardwidth = 8;
        }
        const ir = buildReplayIR(tampered);
        expect(ir.rounds[0].status).toEqual('failed');
        expect(ir.rounds[0].failure!.stage).toEqual('validate');
    });

    test('current is the piece already spawned when the lock fires', () => {
        const winner = leagueWin.replay.rounds[0].find(p => p.id === 'player-a-id')!;
        const result = simulatePlayerRound(winner);

        // 各設置後の (hold, current, next) から、次に置かれるミノは
        //   hold を挟まなければ current、挟めば hold（hold が空なら next[0] が繰り上がる）
        // のどちらかになる。current が単なる next[0] だとこの関係は崩れる。
        let holdUsed = 0;
        for (let i = 0; i < result.locks.length - 1; i += 1) {
            const { current, hold, next } = result.locks[i];
            const placed = result.locks[i + 1].piece;
            expect(current).not.toBeNull();
            expect([current, hold !== null ? hold : next[0]]).toContain(placed);
            if (placed !== current) {
                holdUsed += 1;
                // hold を使ったなら、直前の current が hold へ移る
                expect(result.locks[i + 1].hold).toEqual(current);
            }
        }
        expect(holdUsed).toBeGreaterThan(0);
    });

    test('the initial point holds the empty board and the opening queue (P2 §3-3)', () => {
        const winner = leagueWin.replay.rounds[0].find(p => p.id === 'player-a-id')!;
        const result = simulatePlayerRound(winner);

        expect(result.initial.frame).toEqual(0);
        expect(result.initial.hold).toBeNull();
        expect(result.initial.field).toHaveLength(FieldConstants.PlayBlocks);
        expect(result.initial.field.every(cell => cell === Piece.Empty)).toBeTruthy();

        // 構築直後にキューが読めていること。読めずに 1 tick フォールバックへ落ちた場合も
        // ここは満たすが、盤面が空であることと併せて開始局面であることを固定する。
        expect(result.initial.current).not.toBeNull();
        expect(result.initial.next.length).toBeGreaterThan(0);
        for (const piece of result.initial.next) {
            expect(piece).not.toEqual(Piece.Empty);
            expect(piece).not.toEqual(Piece.Gray);
        }
    });

    test('the first placement comes from the initial current or hold (P2 §3-3)', () => {
        const winner = leagueWin.replay.rounds[0].find(p => p.id === 'player-a-id')!;
        const result = simulatePlayerRound(winner);

        // hold は空なので、初手は current そのものか、hold して繰り上がった next[0]
        const { current, next } = result.initial;
        expect([current, next[0]]).toContain(result.locks[0].piece);
        if (result.locks[0].piece !== current) {
            expect(result.locks[0].hold).toEqual(current);
        }
    });

    test('meta carries the measured parse time (NFR-02)', () => {
        const ir = buildReplayIR(leagueWin);
        expect(typeof ir.meta.parseMs).toEqual('number');
        expect(Number.isFinite(ir.meta.parseMs)).toBeTruthy();
        expect(ir.meta.parseMs).toBeGreaterThanOrEqual(0);
    });

    test('terminal carries its own queue', () => {
        const winner = leagueWin.replay.rounds[0].find(p => p.id === 'player-a-id')!;
        const result = simulatePlayerRound(winner);
        expect(result.terminal.current).not.toBeNull();
        expect(result.terminal.next.length).toBeGreaterThan(0);
        for (const piece of result.terminal.next) {
            expect(piece).not.toEqual(Piece.Empty);
            expect(piece).not.toEqual(Piece.Gray);
        }
    });

    test('the next queue is kept whole, not cut down to the displayed count', () => {
        const winner = leagueWin.replay.rounds[0].find(p => p.id === 'player-a-id')!;
        const result = simulatePlayerRound(winner);

        // 画面が出すのは5件だが、IR はエンジンのキューを全部持つ（1バッグ=7を超える）
        for (const lock of result.locks) {
            expect(lock.next.length).toBeGreaterThan(7);
        }

        // 隣り合う地点のキューは、先頭を 1〜2 個（hold でもう1個引くことがある）
        // 消費しただけの連続した並びになる。途中で切っていると成立しない。
        const continues = (prev: Piece[], cur: Piece[], consumed: number): boolean => {
            const tail = prev.slice(consumed);
            const length = Math.min(tail.length, cur.length);
            return length > 0 && tail.slice(0, length).every((piece, j) => piece === cur[j]);
        };
        for (let i = 0; i < result.locks.length - 1; i += 1) {
            const prev = result.locks[i].next;
            const cur = result.locks[i + 1].next;
            expect(continues(prev, cur, 1) || continues(prev, cur, 2)).toBeTruthy();
        }
    });

    // ---- P3 §3-3: ガベージイベントの識別子 ----

    test('every garbage event carries the interaction id it belongs to', () => {
        const loser = leagueLoss.replay.rounds[0].find(p => p.id === 'player-a-id')!;
        const result = simulatePlayerRound(loser);

        expect(result.garbageEvents.length).toBeGreaterThan(0);
        for (const event of result.garbageEvents) {
            expect(typeof event.iid).toEqual('number');
            expect(Number.isFinite(event.iid)).toBeTruthy();
        }
    });

    test('confirm events carry the sender and the sender-side frame (FR-45)', () => {
        const loser = leagueLoss.replay.rounds[0].find(p => p.id === 'player-a-id')!;
        const confirms = simulatePlayerRound(loser).garbageEvents
            .filter(event => event.kind === 'confirm');

        expect(confirms.length).toBeGreaterThan(0);
        for (const event of confirms) {
            expect(typeof event.gameid).toEqual('number');
            expect(typeof event.senderFrame).toEqual('number');
            expect(event.amount).toEqual(0);
        }
    });

    test('confirm senderFrame is read from the nested raw garbage payload', () => {
        const loser = leagueLoss.replay.rounds[0].find(p => p.id === 'player-a-id')!;
        const raw = loser.replay.events.find((event: any) =>
            event.type === 'ige' && event.data?.type === 'interaction_confirm')!;
        expect(raw).toBeDefined();

        const envelope = raw.data.data;
        const payload = envelope.data ?? envelope;
        const iid = envelope.iid ?? payload.iid;
        const gameid = envelope.gameid ?? payload.gameid;
        const confirm = simulatePlayerRound(loser).garbageEvents.find(event =>
            event.kind === 'confirm' && event.iid === iid && event.gameid === gameid);

        expect(payload.frame).toEqual(220);
        expect(confirm).toBeDefined();
        expect(confirm!.senderFrame).toEqual(220);
        expect(confirm!.senderFrame).not.toEqual(raw.frame);
        expect(confirm!.senderFrame).not.toEqual(raw.data.frame);

        const nestedFile = clone(leagueLoss);
        const nestedLoser = nestedFile.replay.rounds[0]
            .find(player => player.id === 'player-a-id')!;
        const nestedRaw = nestedLoser.replay.events.find((event: any) =>
            event.type === 'ige' && event.data?.type === 'interaction_confirm')!;
        nestedRaw.data.data.data = { frame: 427 };
        const nestedConfirm = simulatePlayerRound(nestedLoser).garbageEvents.find(event =>
            event.kind === 'confirm' && event.iid === iid && event.gameid === gameid);
        expect(nestedConfirm!.senderFrame).toEqual(427);
    });

    test('tank events carry the column the hole actually opened in (FR-42)', () => {
        const loser = leagueLoss.replay.rounds[0].find(p => p.id === 'player-a-id')!;
        const tanks = simulatePlayerRound(loser).garbageEvents
            .filter(event => event.kind === 'tank');

        expect(tanks.length).toBeGreaterThan(0);
        for (const event of tanks) {
            expect(event.column).toBeGreaterThanOrEqual(0);
            expect(event.column).toBeLessThan(FieldConstants.Width);
        }
    });

    // §3-3 の NG ボックス: received を足すと再生できるラウンドが消える（V-02 で 13/34 が failed）
    test('the self-check still weighs exactly three values (FR-63)', () => {
        const winner = leagueWin.replay.rounds[0].find(p => p.id === 'player-a-id')!;
        const { verification } = simulatePlayerRound(winner);

        expect(Object.keys(verification).sort())
            .toEqual(['lines', 'matched', 'piecesplaced', 'sent']);
        expect((verification as any).received).toBeUndefined();
    });

    // pendingHoles は「キューの件数」であって穴位置ではなかったので廃止した（§3-3）
    test('locks no longer expose the misnamed pendingHoles counter', () => {
        const winner = leagueWin.replay.rounds[0].find(p => p.id === 'player-a-id')!;
        const result = simulatePlayerRound(winner);
        expect((result.locks[0] as any).pendingHoles).toBeUndefined();
    });

    test('locks carry hold/next and clear metadata', () => {
        const winner = leagueWin.replay.rounds[0].find(p => p.id === 'player-a-id')!;
        const result = simulatePlayerRound(winner);
        expect(result.locks.length).toBeGreaterThan(0);
        for (const lock of result.locks) {
            expect(lock.next.length).toBeGreaterThan(0);
            expect(lock.fieldBefore).toHaveLength(FieldConstants.PlayBlocks);
            expect(lock.fieldAfter).toHaveLength(FieldConstants.PlayBlocks);
        }
        const totalLines = result.locks.reduce((sum, lock) => sum + lock.clear.lines, 0);
        expect(totalLines).toEqual(result.verification.lines.expected);
    });

    test('production IR contains sorted visual change points for realtime playback', () => {
        const winner = leagueWin.replay.rounds[0].find(p => p.id === 'player-a-id')!;
        const result = simulatePlayerRound(winner);
        const visual = result.visual!;

        expect(visual).toBeDefined();
        for (const points of [visual.active, visual.boards, visual.queues, visual.garbage]) {
            expect(points.length).toBeGreaterThan(0);
            expect(points[0].frame).toEqual(0);
            for (let index = 1; index < points.length; index += 1) {
                expect(points[index].frame).toBeGreaterThan(points[index - 1].frame);
            }
        }

        expect(visual.active.length).toBeGreaterThan(result.locks.length);
        expect(visual.active.some((point, index) => index > 0
            && point.x !== visual.active[index - 1].x)).toBeTruthy();
        expect(visual.active.some((point, index) => index > 0
            && point.rotation !== visual.active[index - 1].rotation)).toBeTruthy();
        expect(visual.active.some((point, index) => index > 0
            && point.y !== visual.active[index - 1].y)).toBeTruthy();
        expect(visual.queues.some(point => point.hold !== null)).toBeTruthy();
        for (const point of visual.active) {
            expect(point.cells).toHaveLength(4);
        }
    });

    test('captures the first falling pose at frame zero', () => {
        const loser = leagueLoss.replay.rounds[0].find(p => p.id === 'player-a-id')!;
        const result = simulatePlayerRound(loser);
        expect(result.visual!.active[0]).toEqual({
            frame: 0,
            piece: Piece.O,
            rotation: 0,
            x: 4,
            y: 22,
            cells: [[4, 22], [5, 22], [4, 21], [5, 21]],
        });
    });

    test('visual board boundaries agree with lock and terminal points', () => {
        const winner = leagueWin.replay.rounds[0].find(p => p.id === 'player-a-id')!;
        const result = simulatePlayerRound(winner);

        for (const lock of result.locks) {
            expect(boardAtFrame(result, lock.frame).field).toEqual(lock.fieldAfter);
        }
        expect(boardAtFrame(result, result.terminal.frame).field).toEqual(result.terminal.field);
        expect(activeAtFrame(result, result.terminal.frame)).toBeUndefined();

        const loser = leagueLoss.replay.rounds[0].find(p => p.id === 'player-a-id')!;
        const losingResult = simulatePlayerRound(loser);
        const tankFrames = losingResult.garbageEvents
            .filter(event => event.kind === 'tank')
            .map(event => event.frame);
        expect(tankFrames.length).toBeGreaterThan(0);
        for (const frame of tankFrames) {
            expect(losingResult.visual!.boards.some(point => point.frame === frame)).toBeTruthy();
        }
    });
});

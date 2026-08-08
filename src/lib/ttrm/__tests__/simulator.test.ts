import { FieldConstants, Piece } from '../../enums';
import { minoToPiece } from '../board_converter';
import { buildReplayIR, simulatePlayerRound } from '../simulator';
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
});

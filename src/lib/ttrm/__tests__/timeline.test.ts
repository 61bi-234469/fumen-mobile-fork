import { FieldConstants, Piece } from '../../enums';
import {
    clampPointIndex,
    formatFrameTime,
    frameAt,
    indexAtFrame,
    lastPointIndex,
    pointAt,
    pointCount,
    statsAt,
} from '../timeline';
import { IRField, LockPoint, PlayerRoundIR } from '../types';

const emptyField = (): IRField =>
    Array.from({ length: FieldConstants.PlayBlocks }).map(() => Piece.Empty);

const lockAt = (frame: number, overrides: Partial<LockPoint> = {}): LockPoint => ({
    frame,
    pieceIndex: 0,
    fieldBefore: emptyField(),
    fieldAfter: emptyField(),
    piece: Piece.T,
    rotation: 0,
    x: 4,
    y: 1,
    hold: null,
    current: Piece.I,
    next: [Piece.O],
    clear: { lines: 0, spin: 'none', b2b: 0, ren: 0, perfectClear: false },
    attack: 0,
    garbageGauge: 0,
    pendingHoles: 0,
    sourceHeight: 1,
    clippedRowCount: 0,
    ...overrides,
});

const playerWith = (locks: LockPoint[], terminalFrame: number = 1000): PlayerRoundIR => ({
    locks,
    id: 'player-a-id',
    username: 'player-a',
    resolvedOptions: {},
    optionWarnings: [],
    garbageEvents: [],
    initial: {
        frame: 0,
        field: emptyField(),
        hold: null,
        current: Piece.T,
        next: [Piece.I, Piece.O, Piece.S],
    },
    terminal: {
        frame: terminalFrame,
        field: emptyField(),
        sourceHeight: 0,
        clippedRowCount: 2,
        garbageGauge: 0,
        hold: Piece.L,
        current: Piece.J,
        next: [Piece.Z],
        reason: 'winner',
        alive: true,
    },
    verification: {
        piecesplaced: { expected: locks.length, actual: locks.length },
        lines: { expected: 0, actual: 0 },
        sent: { expected: 0, actual: 0 },
        matched: true,
    },
});

describe('timeline point space', () => {
    describe('point layout', () => {
        test('there are locks.length + 2 points, bounded by initial and terminal', () => {
            const player = playerWith([lockAt(100), lockAt(200), lockAt(300)]);
            expect(pointCount(player)).toEqual(5);
            expect(lastPointIndex(player)).toEqual(4);

            expect(pointAt(player, 0).kind).toEqual('initial');
            expect(pointAt(player, 0).frame).toEqual(0);
            expect(pointAt(player, 4).kind).toEqual('terminal');
            expect(pointAt(player, 4).frame).toEqual(1000);

            // index がそのまま手番番号: locks[0] は「手番 1」
            for (let i = 1; i <= 3; i += 1) {
                const point = pointAt(player, i);
                expect(point.kind).toEqual('lock');
                expect(point.frame).toEqual(player.locks[i - 1].frame);
                expect(point.field).toBe(player.locks[i - 1].fieldAfter);
            }
        });

        test('a round with no placements has exactly two points', () => {
            const player = playerWith([], 42);
            expect(pointCount(player)).toEqual(2);
            expect(pointAt(player, 0).kind).toEqual('initial');
            expect(pointAt(player, 1).kind).toEqual('terminal');
            expect(indexAtFrame(player, 0)).toEqual(0);
            expect(indexAtFrame(player, 41)).toEqual(0);
            expect(indexAtFrame(player, 42)).toEqual(1);
        });

        test('the index is clamped to the point space', () => {
            const player = playerWith([lockAt(100)]);
            expect(clampPointIndex(player, -5)).toEqual(0);
            expect(clampPointIndex(player, 99)).toEqual(2);
            expect(pointAt(player, -5).kind).toEqual('initial');
            expect(pointAt(player, 99).kind).toEqual('terminal');
        });

        test('the terminal point carries its own queue and clipped row count', () => {
            const player = playerWith([lockAt(100)]);
            const point = pointAt(player, 2);
            expect(point.hold).toEqual(Piece.L);
            expect(point.current).toEqual(Piece.J);
            expect(point.clippedRowCount).toEqual(2);
        });
    });

    describe('indexAtFrame', () => {
        const player = playerWith([lockAt(100), lockAt(200), lockAt(300)], 1000);

        test('before the first lock the cursor sits on the start point', () => {
            expect(indexAtFrame(player, 0)).toEqual(0);
            expect(indexAtFrame(player, 99)).toEqual(0);
        });

        test('a lock frame itself already shows that lock', () => {
            expect(indexAtFrame(player, 100)).toEqual(1);
            expect(indexAtFrame(player, 199)).toEqual(1);
            expect(indexAtFrame(player, 200)).toEqual(2);
            expect(indexAtFrame(player, 300)).toEqual(3);
            expect(indexAtFrame(player, 999)).toEqual(3);
        });

        test('from the terminal frame onwards the cursor sits on the terminal', () => {
            expect(indexAtFrame(player, 1000)).toEqual(4);
            expect(indexAtFrame(player, 5000)).toEqual(4);
        });

        test('with several locks on one frame the last of them wins', () => {
            const bunched = playerWith(
                [lockAt(100), lockAt(240), lockAt(240), lockAt(240), lockAt(400)], 1000);
            expect(indexAtFrame(bunched, 240)).toEqual(4);
            expect(indexAtFrame(bunched, 239)).toEqual(1);
            expect(indexAtFrame(bunched, 241)).toEqual(4);
        });

        test('frameAt and indexAtFrame round-trip on distinct frames', () => {
            for (let index = 0; index <= lastPointIndex(player); index += 1) {
                expect(indexAtFrame(player, frameAt(player, index))).toEqual(index);
            }
        });
    });

    describe('statsAt', () => {
        const player = playerWith([
            lockAt(60, { attack: 0, clear: { lines: 0, spin: 'none', b2b: 0, ren: 0, perfectClear: false } }),
            lockAt(120, { attack: 4, clear: { lines: 4, spin: 'none', b2b: 1, ren: 2, perfectClear: false } }),
            lockAt(180, { attack: 2, clear: { lines: 2, spin: 'normal', b2b: 2, ren: 3, perfectClear: false } }),
        ], 600);

        test('the start point has no elapsed time and no divide-by-zero', () => {
            const stats = statsAt(player, 0);
            expect(stats.placed).toEqual(0);
            expect(stats.seconds).toEqual(0);
            expect(stats.pps).toEqual(0);
            expect(stats.apm).toEqual(0);
            expect(stats.attack).toEqual(0);
        });

        test('pps, apm and the attack total are computed up to the cursor', () => {
            const stats = statsAt(player, 2);
            expect(stats.placed).toEqual(2);
            expect(stats.totalLocks).toEqual(3);
            expect(stats.seconds).toBeCloseTo(2);
            expect(stats.pps).toBeCloseTo(1);
            // 4 attack in 2 seconds = 120 per minute
            expect(stats.apm).toBeCloseTo(120);
            expect(stats.attack).toEqual(4);
            expect(stats.b2b).toEqual(1);
            expect(stats.ren).toEqual(2);
        });

        // エンジンの combo はコンボが途切れている間 -1 を返す（実データで確認）
        test('an idle combo counter is shown as zero, not -1', () => {
            const idle = playerWith([
                lockAt(60, { clear: { lines: 0, spin: 'none', b2b: -1, ren: -1, perfectClear: false } }),
            ], 600);
            expect(statsAt(idle, 1).ren).toEqual(0);
            expect(statsAt(idle, 1).b2b).toEqual(0);
        });

        test('the terminal counts every lock', () => {
            const stats = statsAt(player, 4);
            expect(stats.placed).toEqual(3);
            expect(stats.attack).toEqual(6);
            expect(stats.seconds).toBeCloseTo(10);
            expect(stats.pps).toBeCloseTo(0.3);
        });
    });

    describe('formatFrameTime', () => {
        test('frames are shown as mm:ss.s at 60fps', () => {
            expect(formatFrameTime(0)).toEqual('0:00.0');
            expect(formatFrameTime(90)).toEqual('0:01.5');
            expect(formatFrameTime(60 * 75)).toEqual('1:15.0');
            expect(formatFrameTime(-10)).toEqual('0:00.0');
        });
    });
});

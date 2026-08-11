import { FieldConstants, Piece } from '../../enums';
import {
    activeAtFrame,
    boardAtFrame,
    changePointAtFrame,
    clampPointIndex,
    formatFrameTime,
    frameAt,
    garbageAtFrame,
    indexAtFrame,
    lastPointIndex,
    pointAt,
    pointCount,
    preLockPointAt,
    queueAtFrame,
    statsAt,
    stopFrameAt,
    visualAtFrame,
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
    garbageCleared: 0,
    garbageGauge: 0,
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
            expect(stats.app).toEqual(0);
            expect(stats.vs).toEqual(0);
            expect(stats.area).toEqual(0);
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
            expect(stats.garbageCleared).toEqual(0);
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

        test('APP, VS and AREA follow the TetraStats-derived formulas', () => {
            const withDownstack = playerWith([
                lockAt(60, { attack: 4, garbageCleared: 2 }),
                lockAt(120, { attack: 2, garbageCleared: 0 }),
            ], 180);
            const stats = statsAt(withDownstack, 2);

            // 2 pieces / 2 seconds, 6 attack and 2 downstack lines
            expect(stats.pps).toBeCloseTo(1);
            expect(stats.apm).toBeCloseTo(180);
            expect(stats.app).toBeCloseTo(3);
            expect(stats.vs).toBeCloseTo(400);
            // DS/s=1, DS/p=1, garbage efficiency=6
            expect(stats.area).toBeCloseTo(180 + 45 + 400 * 0.444 + 3 * 185 + 175 + 450 + 6 * 315);
        });

        // P3 §3-8。TETR.IO の received は出さず、エンジン基準の 2 値を添える。
        test('the garbage gauge and the tanked total follow the cursor', () => {
            const withGarbage: PlayerRoundIR = {
                ...player,
                garbageEvents: [
                    { frame: 90, iid: 1, amount: 4, kind: 'receive' },
                    { frame: 150, iid: 1, amount: 3, column: 5, size: 1, kind: 'tank' },
                ],
            };
            // 手番 1（frame 60）はまだ受信前
            expect(statsAt(withGarbage, 1).gauge).toEqual(0);
            expect(statsAt(withGarbage, 1).tanked).toEqual(0);
            // 手番 2（frame 120）は受信後・被弾前
            expect(statsAt(withGarbage, 2).gauge).toEqual(4);
            expect(statsAt(withGarbage, 2).tanked).toEqual(0);
            // 手番 3（frame 180）は被弾後
            expect(statsAt(withGarbage, 3).gauge).toEqual(1);
            expect(statsAt(withGarbage, 3).tanked).toEqual(3);

            // 既存の項目は影響を受けない
            expect(statsAt(withGarbage, 2).attack).toEqual(statsAt(player, 2).attack);
            expect(statsAt(withGarbage, 2).pps).toEqual(statsAt(player, 2).pps);
        });

        test('a round without garbage reports zeros instead of nothing', () => {
            expect(statsAt(player, 2).gauge).toEqual(0);
            expect(statsAt(player, 2).tanked).toEqual(0);
        });

        // ゲージバーはカーソルのフレームで描くので、統計行も同じ瞬間を指せる必要がある
        test('an explicit frame overrides the point frame for the garbage values only', () => {
            const withGarbage: PlayerRoundIR = {
                ...player,
                garbageEvents: [
                    { frame: 130, iid: 1, amount: 4, kind: 'receive' },
                    { frame: 160, iid: 1, amount: 4, column: 5, size: 1, kind: 'tank' },
                ],
            };
            // 手番 2（frame 120）に留まったまま、カーソルだけ 150 まで進んだ状態
            expect(statsAt(withGarbage, 2).gauge).toEqual(0);
            expect(statsAt(withGarbage, 2, 150).gauge).toEqual(4);
            expect(statsAt(withGarbage, 2, 170).tanked).toEqual(4);
            // 手番由来の値は動かない
            expect(statsAt(withGarbage, 2, 170).frame).toEqual(120);
            expect(statsAt(withGarbage, 2, 170).placed).toEqual(2);
        });
    });

    describe('visual change-point timeline', () => {
        test('changePointAtFrame returns the last point on or before the target', () => {
            const points = [{ frame: 10, value: 'a' }, { frame: 20, value: 'b' }];
            expect(changePointAtFrame(points, 9)).toBeUndefined();
            expect(changePointAtFrame(points, 10)).toBe(points[0]);
            expect(changePointAtFrame(points, 19)).toBe(points[0]);
            expect(changePointAtFrame(points, 20)).toBe(points[1]);
            expect(changePointAtFrame(points, 999)).toBe(points[1]);
        });

        test('visualAtFrame floors fractional frames and composes independent timelines', () => {
            const before = emptyField();
            const after = emptyField();
            after[0] = Piece.Gray;
            const player = playerWith([lockAt(100, { fieldAfter: after })], 200);
            player.visual = {
                active: [
                    { frame: 0, piece: Piece.T, rotation: 0, x: 4, y: 20, cells: [[4, 20]] },
                    { frame: 140, piece: Piece.I, rotation: 1, x: 5, y: 18, cells: [[5, 18]] },
                ],
                boards: [
                    { frame: 0, field: before, sourceHeight: 0, clippedRowCount: 0 },
                    { frame: 100, field: after, sourceHeight: 1, clippedRowCount: 0 },
                ],
                queues: [
                    { frame: 0, hold: null, current: Piece.T, next: [Piece.I] },
                    { frame: 120, hold: Piece.T, current: Piece.I, next: [Piece.O] },
                ],
                garbage: [
                    { frame: 0, snapshot: {} as any },
                    { frame: 149, snapshot: { size: 4 } as any },
                    { frame: 150, snapshot: { size: 5 } as any },
                ],
            };

            const state = visualAtFrame(player, 149.9);
            expect(state.frame).toEqual(149);
            expect(state.field).toBe(after);
            expect(state.active!.piece).toEqual(Piece.I);
            expect(state.hold).toEqual(Piece.T);
            expect(state.next).toEqual([Piece.O]);
            expect(state.garbage!.frame).toEqual(149);
            expect(boardAtFrame(player, 99.9).field).toBe(before);
            expect(queueAtFrame(player, 119.9).hold).toBeNull();
            expect(garbageAtFrame(player, 149.9)!.frame).toEqual(149);
        });

        test('a lock boundary never leaves the previous active piece over the locked board', () => {
            const player = playerWith([lockAt(100)], 200);
            player.visual = {
                active: [
                    { frame: 0, piece: Piece.T, rotation: 0, x: 4, y: 20, cells: [[4, 20]] },
                ],
                boards: [],
                queues: [],
                garbage: [],
            };

            expect(activeAtFrame(player, 99)!.piece).toEqual(Piece.T);
            expect(activeAtFrame(player, 100)).toBeUndefined();
            expect(activeAtFrame(player, 150)).toBeUndefined();

            player.visual.active.push({
                frame: 100, piece: Piece.I, rotation: 0, x: 4, y: 20, cells: [[4, 20]],
            });
            expect(activeAtFrame(player, 100)!.piece).toEqual(Piece.I);
            expect(activeAtFrame(player, 200)).toBeUndefined();
            expect(activeAtFrame(player, 999)).toBeUndefined();
        });

        test('old hand-made IR without visual data falls back to ReplayPoints', () => {
            const after = emptyField();
            after[0] = Piece.Gray;
            const player = playerWith([lockAt(100, {
                fieldAfter: after,
                hold: Piece.T,
                current: Piece.I,
                next: [Piece.O],
            })], 200);

            expect(boardAtFrame(player, 100).field).toBe(after);
            expect(queueAtFrame(player, 100)).toMatchObject({
                frame: 100, hold: Piece.T, current: Piece.I, next: [Piece.O],
            });
            expect(garbageAtFrame(player, 100)).toBeUndefined();
        });
    });

    // 手番停止は「接地直前（設置済み・未確定）」。確定地点を返す pointAt とは別物。
    describe('preLockPointAt / stopFrameAt', () => {
        const CELLS: [number, number][] = [[3, 0], [4, 0], [5, 0], [4, 1]];

        const withCells = (frame: number, overrides: Partial<LockPoint> = {}): LockPoint =>
            lockAt(frame, { cells: CELLS.map(([x, y]) => [x, y] as [number, number]), ...overrides });

        test('the point sits one frame before the lock and carries the placed pose', () => {
            const risen = emptyField();
            risen[0] = Piece.Gray;
            const player = playerWith([withCells(100), withCells(200)], 300);
            player.visual = {
                active: [],
                boards: [
                    { frame: 0, field: emptyField(), sourceHeight: 0, clippedRowCount: 0 },
                    { frame: 150, field: risen, sourceHeight: 1, clippedRowCount: 0 },
                ],
                queues: [],
                garbage: [],
            };

            const point = preLockPointAt(player, 2)!;
            expect(point.index).toEqual(2);
            expect(point.frame).toEqual(199);
            expect(point.confirmedIndex).toEqual(1);
            // 盤面は「その lock の直前の変化点」。前の設置とその後のせり上がりを含む
            expect(point.visual.field).toBe(risen);
            expect(point.visual.active!.cells).toEqual(CELLS);
            expect(point.visual.active!.piece).toEqual(Piece.T);
            expect(point.visual.active!.frame).toEqual(199);
        });

        test('the queue is the one facing the player, not the post-lock one', () => {
            const player = playerWith([withCells(100, {
                hold: Piece.L, piece: Piece.S, current: Piece.I, next: [Piece.O, Piece.Z],
            })], 300);

            const point = preLockPointAt(player, 1)!;
            expect(point.visual.hold).toEqual(Piece.L);
            expect(point.visual.current).toEqual(Piece.S);
            expect(point.visual.next).toEqual([Piece.I, Piece.O, Piece.Z]);
        });

        test('the start and terminal points have no pre-lock state', () => {
            const player = playerWith([withCells(100)], 300);
            expect(preLockPointAt(player, 0)).toBeUndefined();
            expect(preLockPointAt(player, 2)).toBeUndefined();
            expect(preLockPointAt(player, 99)).toBeUndefined();
        });

        test('IR without placed cells falls back', () => {
            const player = playerWith([lockAt(100)], 300);
            expect(preLockPointAt(player, 1)).toBeUndefined();
        });

        test('a lock sharing its frame with the previous one falls back', () => {
            const player = playerWith([withCells(100), withCells(100)], 300);
            expect(preLockPointAt(player, 1)).toBeDefined();
            expect(preLockPointAt(player, 2)).toBeUndefined();
        });

        test('cells already filled on the pre-lock board fall back', () => {
            const occupied = emptyField();
            occupied[4] = Piece.Gray;   // (4, 0) は設置セルのひとつ
            const player = playerWith([withCells(100), withCells(200)], 300);
            player.visual = {
                active: [],
                boards: [{ frame: 0, field: occupied, sourceHeight: 1, clippedRowCount: 0 }],
                queues: [],
                garbage: [],
            };
            expect(preLockPointAt(player, 2)).toBeUndefined();
        });

        test('stopFrameAt is the pre-lock frame where available and frameAt otherwise', () => {
            const player = playerWith([withCells(100), lockAt(200)], 300);
            expect(stopFrameAt(player, 0)).toEqual(0);
            expect(stopFrameAt(player, 1)).toEqual(99);
            // cells の無い手番は従来どおり lock フレームへ止まる
            expect(stopFrameAt(player, 2)).toEqual(200);
            expect(stopFrameAt(player, 3)).toEqual(300);
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

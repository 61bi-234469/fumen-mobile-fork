import { FieldConstants, Piece } from '../../enums';
import {
    gaugeAtFrame,
    garbageCapOf,
    garbageViewAt,
    getGarbageTimeline,
    killerGarbageOf,
    pendingParcelsAt,
    recentEventAt,
    riseForecastAt,
    tankedAtFrame,
} from '../garbage';
import { simulatePlayerRound } from '../simulator';
import { GarbageEvent, IRField, LockPoint, PlayerRoundIR, TtrmFile } from '../types';

const leagueLoss = require('./fixtures/league_loss.json') as TtrmFile;

const emptyField = (): IRField =>
    Array.from({ length: FieldConstants.PlayBlocks }).map(() => Piece.Empty);

const lockAt = (frame: number): LockPoint => ({
    frame,
    pieceIndex: 0,
    fieldBefore: emptyField(),
    fieldAfter: emptyField(),
    piece: Piece.T,
    rotation: 0,
    x: 4,
    y: 0,
    hold: null,
    current: Piece.I,
    next: [Piece.O],
    clear: { lines: 0, spin: 'none', b2b: 0, ren: 0, perfectClear: false },
    attack: 0,
    garbageGauge: 0,
    sourceHeight: 1,
    clippedRowCount: 0,
});

// 合成データ。イベント列と終端の理由だけを差し替えて境界条件を作る。
const playerWith = (
    garbageEvents: GarbageEvent[],
    { locks = [] as LockPoint[], reason = 'winner', terminalFrame = 1000 } = {},
): PlayerRoundIR => ({
    locks,
    garbageEvents,
    id: 'player-a-id',
    username: 'player-a',
    resolvedOptions: {},
    optionWarnings: [],
    initial: { frame: 0, field: emptyField(), hold: null, current: Piece.T, next: [Piece.I] },
    terminal: {
        reason,
        frame: terminalFrame,
        field: emptyField(),
        sourceHeight: 0,
        clippedRowCount: 0,
        garbageGauge: 0,
        hold: null,
        current: Piece.S,
        next: [Piece.Z],
        alive: reason === 'winner',
    },
    verification: {
        piecesplaced: { expected: locks.length, actual: locks.length },
        lines: { expected: 0, actual: 0 },
        sent: { expected: 0, actual: 0 },
        matched: true,
    },
});

const receive = (frame: number, iid: number, amount: number): GarbageEvent =>
    ({ frame, iid, amount, kind: 'receive' });
const tank = (frame: number, iid: number, amount: number, column: number): GarbageEvent =>
    ({ frame, iid, amount, column, kind: 'tank', size: 1 });
const cancel = (frame: number, iid: number, amount: number): GarbageEvent =>
    ({ frame, iid, amount, kind: 'cancel' });
const confirm = (frame: number, iid: number, gameid: number, senderFrame: number): GarbageEvent =>
    ({ frame, iid, gameid, senderFrame, amount: 0, kind: 'confirm' });

describe('garbage timeline (real fixture)', () => {
    const loser = simulatePlayerRound(
        leagueLoss.replay.rounds[0].find(p => p.id === 'player-a-id')!);
    const winner = simulatePlayerRound(
        leagueLoss.replay.rounds[0].find(p => p.id === 'player-b-id')!);

    // V-02 の検証 B をそのまま回帰テストに落としたもの。上流エンジンの版差（R5）で
    // garbage.* の意味が変わったとき、ここが最初に落ちる。
    test('the gauge identity reproduces every recorded lock gauge (FR-40)', () => {
        for (const player of [loser, winner]) {
            const timeline = getGarbageTimeline(player);
            expect(player.garbageEvents.length).toBeGreaterThan(0);
            for (const lock of player.locks) {
                expect(gaugeAtFrame(timeline, lock.frame)).toEqual(lock.garbageGauge);
            }
            expect(gaugeAtFrame(timeline, player.terminal.frame))
                .toEqual(player.terminal.garbageGauge);
        }
    });

    test('every parcel keeps a non-negative balance and the leftovers are the end gauge', () => {
        for (const player of [loser, winner]) {
            const timeline = getGarbageTimeline(player);
            let leftover = 0;
            for (const parcel of timeline.parcels) {
                const resolved = parcel.resolutions
                    .reduce((sum, resolution) => sum + resolution.amount, 0);
                expect(resolved).toBeLessThanOrEqual(parcel.amount);
                leftover += parcel.amount - resolved;
            }
            expect(leftover).toEqual(player.terminal.garbageGauge);
        }
    });

    test('every event carries an iid and every tank a real column (FR-42)', () => {
        for (const player of [loser, winner]) {
            for (const event of player.garbageEvents) {
                expect(typeof event.iid).toEqual('number');
            }
            for (const tanked of getGarbageTimeline(player).tanks) {
                expect(tanked.column).toBeGreaterThanOrEqual(0);
                expect(tanked.column).toBeLessThan(FieldConstants.Width);
            }
        }
    });

    test('the timeline is memoized per player round', () => {
        expect(getGarbageTimeline(loser)).toBe(getGarbageTimeline(loser));
    });

    // F: 敗因が garbagesmash のラウンドでは最終設置以降の tank を死因として拾える
    test('the killing garbage is identified on the losing side (FR-45)', () => {
        expect(loser.terminal.reason).toEqual('garbagesmash');
        const killer = killerGarbageOf(loser)!;
        expect(killer).toBeDefined();
        expect(killer.amount).toBeGreaterThan(0);
        expect(killer.column).toBeGreaterThanOrEqual(0);
        expect(killer.column).toBeLessThan(FieldConstants.Width);
        expect(killer.frame)
            .toBeGreaterThanOrEqual(loser.locks[loser.locks.length - 1].frame);
    });

    test('the winner has no cause of loss', () => {
        expect(killerGarbageOf(winner)).toBeUndefined();
    });

    // §3-6 / §8: fixture の終端ゲージは両者 0。だから既存の期待 fumen は変わらない。
    test('both sides end the fixture round with an empty gauge', () => {
        expect(loser.terminal.garbageGauge).toEqual(0);
        expect(winner.terminal.garbageGauge).toEqual(0);
    });
});

describe('gaugeAtFrame', () => {
    const player = playerWith([
        receive(100, 1, 4),
        tank(200, 1, 3, 5),
        receive(300, 2, 2),
        cancel(400, 2, 2),
        tank(500, 1, 1, 7),
    ]);
    const timeline = getGarbageTimeline(player);

    test('is zero before the first receive', () => {
        expect(gaugeAtFrame(timeline, 0)).toEqual(0);
        expect(gaugeAtFrame(timeline, 99)).toEqual(0);
    });

    test('follows receive / tank / cancel in order', () => {
        expect(gaugeAtFrame(timeline, 100)).toEqual(4);
        expect(gaugeAtFrame(timeline, 199)).toEqual(4);
        expect(gaugeAtFrame(timeline, 200)).toEqual(1);
        expect(gaugeAtFrame(timeline, 300)).toEqual(3);
        expect(gaugeAtFrame(timeline, 400)).toEqual(1);
        expect(gaugeAtFrame(timeline, 500)).toEqual(0);
    });

    test('holds the last value past the final event', () => {
        expect(gaugeAtFrame(timeline, 99999)).toEqual(0);
        expect(gaugeAtFrame(getGarbageTimeline(playerWith([receive(10, 1, 6)])), 99999))
            .toEqual(6);
    });

    test('the running maximum is kept for the bar scale', () => {
        expect(timeline.maxGauge).toEqual(4);
    });

    test('tankedAtFrame accumulates only the rows that reached the board', () => {
        expect(tankedAtFrame(timeline, 199)).toEqual(0);
        expect(tankedAtFrame(timeline, 200)).toEqual(3);
        expect(tankedAtFrame(timeline, 400)).toEqual(3);
        expect(tankedAtFrame(timeline, 500)).toEqual(4);
    });
});

describe('riseForecastAt', () => {
    const timeline = getGarbageTimeline(playerWith([
        receive(100, 1, 4),
        receive(120, 2, 2),
        tank(200, 1, 4, 3),
        tank(300, 2, 2, 8),
    ]));

    test('returns the tanks that actually follow the given frame, in order', () => {
        const rows = riseForecastAt(timeline, 150, 4);
        expect(rows).toHaveLength(1);
        expect(rows[0]).toEqual({ frame: 200, column: 3, size: 1, rows: 4 });
    });

    test('maxRows stops the lookahead after enough rows are collected', () => {
        expect(riseForecastAt(timeline, 150, 1)).toHaveLength(1);
        expect(riseForecastAt(timeline, 250, 1)[0].column).toEqual(8);
        // 4 行ぶんの tank だけでは 5 行に届かないので次の tank も入る
        expect(riseForecastAt(timeline, 150, 5)).toHaveLength(2);
    });

    test('is empty once no tank remains', () => {
        expect(riseForecastAt(timeline, 300, 1)).toEqual([]);
        expect(riseForecastAt(timeline, 9999, 4)).toEqual([]);
    });
});

describe('pendingParcelsAt', () => {
    const timeline = getGarbageTimeline(playerWith([
        receive(100, 1, 4),
        receive(120, 2, 2),
        tank(200, 1, 4, 3),
        cancel(250, 2, 1),
    ]));

    test('returns only the received-but-unresolved parcels, oldest first', () => {
        expect(pendingParcelsAt(timeline, 90)).toEqual([]);
        expect(pendingParcelsAt(timeline, 110).map(p => p.iid)).toEqual([1]);
        expect(pendingParcelsAt(timeline, 150).map(p => p.iid)).toEqual([1, 2]);
        // iid 1 は 200 で全量が盤面へ入るので消える
        expect(pendingParcelsAt(timeline, 200).map(p => p.iid)).toEqual([2]);
        expect(pendingParcelsAt(timeline, 250)).toEqual([
            { iid: 2, receivedFrame: 120, remaining: 1 },
        ]);
    });
});

describe('recentEventAt', () => {
    const timeline = getGarbageTimeline(playerWith([
        confirm(90, 1, 42, 88),
        receive(100, 1, 4),
        tank(200, 1, 4, 3),
    ]));

    test('reports the latest receive / cancel / tank but never a confirm', () => {
        expect(recentEventAt(timeline, 95)).toBeUndefined();
        expect(recentEventAt(timeline, 150)!.kind).toEqual('receive');
        expect(recentEventAt(timeline, 200)!.kind).toEqual('tank');
    });
});

describe('killerGarbageOf', () => {
    const finalLock = lockAt(500);

    test('reports the attack that landed at or after the final placement', () => {
        const killer = killerGarbageOf(playerWith(
            [confirm(480, 7, 42, 460), receive(490, 7, 4), tank(510, 7, 4, 2)],
            { locks: [finalLock], reason: 'garbagesmash' },
        ))!;
        expect(killer).toEqual({
            frame: 510, amount: 4, column: 2, senderFrame: 460, gameid: 42,
        });
    });

    test('is undefined when the last tank predates the final placement (topout)', () => {
        expect(killerGarbageOf(playerWith(
            [receive(100, 7, 4), tank(200, 7, 4, 2)],
            { locks: [finalLock], reason: 'topout' },
        ))).toBeUndefined();
    });

    test('is undefined for the winner even when garbage landed late', () => {
        expect(killerGarbageOf(playerWith(
            [receive(490, 7, 4), tank(510, 7, 4, 2)],
            { locks: [finalLock], reason: 'winner' },
        ))).toBeUndefined();
    });
});

describe('rounds without any garbage', () => {
    const player = playerWith([], { locks: [lockAt(100)], reason: 'topout' });
    const timeline = getGarbageTimeline(player);

    test('every query degrades to an empty answer instead of throwing', () => {
        expect(timeline.parcels).toEqual([]);
        expect(timeline.maxGauge).toEqual(0);
        expect(gaugeAtFrame(timeline, 0)).toEqual(0);
        expect(gaugeAtFrame(timeline, 9999)).toEqual(0);
        expect(tankedAtFrame(timeline, 9999)).toEqual(0);
        expect(pendingParcelsAt(timeline, 9999)).toEqual([]);
        expect(riseForecastAt(timeline, 0, 1)).toEqual([]);
        expect(recentEventAt(timeline, 9999)).toBeUndefined();
        expect(killerGarbageOf(player)).toBeUndefined();
    });
});

describe('garbageViewAt', () => {
    const player = playerWith([receive(100, 1, 4), tank(200, 1, 4, 6)]);

    test('carries the gauge, the actual next rise and the remaining row count', () => {
        const view = garbageViewAt(player, 150);
        expect(view.gauge).toEqual(4);
        expect(view.rise).toEqual({ frame: 200, column: 6, size: 1, rows: 4 });
        expect(view.rises).toEqual([{ frame: 200, column: 6, size: 1, rows: 4 }]);
        expect(view.moreRows).toEqual(3);
        expect(view.recent!.kind).toEqual('receive');
    });

    test('carries every reserved rise for segmented gauge rendering', () => {
        const multiple = playerWith([
            receive(100, 1, 3),
            receive(110, 2, 2),
            tank(200, 1, 3, 1),
            tank(220, 2, 2, 7),
        ]);

        const view = garbageViewAt(multiple, 150);
        expect(view.gauge).toEqual(5);
        expect(view.rises.map(rise => rise.rows)).toEqual([3, 2]);
        expect(view.rise!.column).toEqual(1);
        expect(view.moreRows).toEqual(4);
    });

    // FR-54 の切り出し条件と同じ判定。ゲージ 0 の地点では予告を出さない。
    test('shows no forecast while nothing is pending', () => {
        expect(garbageViewAt(player, 50).rise).toBeUndefined();
        expect(garbageViewAt(player, 50).gauge).toEqual(0);
        expect(garbageViewAt(player, 300).rise).toBeUndefined();
    });

    test('the bar scale falls back to the default cap', () => {
        expect(garbageCapOf(player)).toEqual(8);
        expect(garbageCapOf(playerWith([]))).toEqual(8);
    });

    test('the bar scale follows the round options when they set a cap', () => {
        const capped = { ...playerWith([]), resolvedOptions: { garbagecap: 4 } };
        expect(garbageCapOf(capped)).toEqual(4);
    });
});

import { GarbageQueueInitializeParams, GarbageQueueSnapshot } from '@haelp/teto/engine';
import { Piece, Rotation } from '../enums';
import { Field } from '../fumen/field';
import {
    InputReplayContext,
    InputReplayRules,
    advanceInputReplayContext,
    applyInputGarbageRows,
    cloneInputReplayContext,
    createInputReplayContext,
    createInputReplayContextFromSnapshot,
    inputGarbageView,
    inputReplayContextAt,
    selectCurrentGarbageParcels,
} from '../input_replay';

const options = (overrides: Partial<GarbageQueueInitializeParams> = {}): GarbageQueueInitializeParams => ({
    cap: { value: 3, marginTime: 0, increase: 0, absolute: 40, max: 40 },
    messiness: { change: 0, within: 0, nosame: false, timeout: 0, center: false },
    garbage: { speed: 20, holeSize: 1 },
    multiplier: { value: 1, increase: 0, marginTime: 0 },
    bombs: false,
    seed: 1234,
    boardWidth: 10,
    rounding: 'down',
    openerPhase: 0,
    specialBonus: false,
    ...overrides,
});

const rules = (overrides: Partial<InputReplayRules> = {}): InputReplayRules => ({
    spinBonuses: 'all-mini+',
    comboTable: 'none',
    garbageTargetBonus: 'none',
    b2bChaining: false,
    b2bCharging: false,
    b2bChargeAt: 4,
    b2bChargeBase: 3,
    allClearGarbage: 0,
    allClearB2b: 0,
    specialBonus: false,
    multiplier: 1,
    multiplierIncrease: 0,
    multiplierMargin: 0,
    garbageCap: 3,
    garbageCapIncrease: 0,
    garbageCapMargin: 0,
    garbageCapMax: 40,
    garbageSpeed: 20,
    roundMode: 'down',
    openerPhase: 0,
    ...overrides,
});

const snapshot = (amount: number, overrides: Partial<GarbageQueueSnapshot> = {}): GarbageQueueSnapshot => ({
    seed: 1234,
    lastTankTime: 0,
    lastColumn: null,
    sent: 0,
    hasChangedColumn: false,
    lastReceivedCount: 0,
    queue: amount === 0 ? [] : [{
        amount,
        frame: 0,
        size: 1,
        cid: 17,
        gameid: 9,
        confirmed: true,
    }],
    ...overrides,
});

const context = (
    amount: number,
    contextRules: InputReplayRules = rules(),
    stats: InputReplayContext['stats'] = {
        b2bChain: 0,
        renChain: 0,
        pieces: 0,
        lines: 0,
        perfectClears: 0,
    },
): InputReplayContext => createInputReplayContextFromSnapshot({
    stats,
    snapshot: snapshot(amount),
    frame: 0,
    options: options(),
    rules: contextRules,
});

const verticalI = { type: Piece.I, rotation: Rotation.Right, coordinate: { x: 9, y: 1 } };
const quadI = { type: Piece.I, rotation: Rotation.Right, coordinate: { x: 9, y: 2 } };

describe('INPUT replay battle context', () => {
    test('keeps every confirmed incoming parcel in application order when detaching a replay', () => {
        const original = snapshot(0, {
            queue: [
                { amount: 4, frame: 30, size: 1, cid: 3, gameid: 9, confirmed: true },
                { amount: 7, frame: 10, size: 1, cid: 1, gameid: 9, confirmed: false },
                { amount: 2, frame: 20, size: 1, cid: 2, gameid: 9, confirmed: true },
                { amount: 5, frame: 20, size: 1, cid: 4, gameid: 9, confirmed: true },
            ],
        });

        const selected = selectCurrentGarbageParcels(original);

        expect(selected.queue).toEqual([
            { amount: 2, frame: 20, size: 1, cid: 2, gameid: 9, confirmed: true },
            { amount: 5, frame: 20, size: 1, cid: 4, gameid: 9, confirmed: true },
            { amount: 4, frame: 30, size: 1, cid: 3, gameid: 9, confirmed: true },
        ]);
        expect(original.queue).toHaveLength(4);
        selected.queue[0].amount = 1;
        expect(original.queue[2].amount).toBe(2);
    });

    test('drops incoming parcels when none have been confirmed', () => {
        const selected = selectCurrentGarbageParcels(snapshot(0, {
            queue: [{ amount: 3, frame: 10, size: 1, cid: 1, gameid: 9, confirmed: false }],
        }));

        expect(selected.queue).toEqual([]);
    });

    test('uses pre-CURRENT replay totals without treating the prior lock as this INPUT result', () => {
        const first = snapshot(2);
        const second = snapshot(5, { seed: 4321 });
        const player: any = {
            resolvedOptions: { seed: 1234, garbagecap: 3, garbagecapmax: 40, garbagespeed: 20 },
            locks: [{
                frame: 30,
                piece: Piece.T,
                clear: { lines: 2, spin: 'normal', b2b: 2, ren: 3, perfectClear: false },
            }],
            terminal: { frame: 100 },
            visual: { garbage: [{ frame: 0, snapshot: first }, { frame: 40, snapshot: second }] },
        };

        const created = createInputReplayContext(player, 1, 45);

        expect(created.stats).toMatchObject({ b2bChain: 3, renChain: 4, pieces: 1, lines: 2 });
        expect(created.stats.lastAction).toBeUndefined();
        expect(created.garbage.last).toBeUndefined();
        expect(inputGarbageView(created).gauge).toBe(5);
        expect(created.garbage.snapshot).not.toBe(second);
    });

    test('uses the Replay-visible B2B/Combo at a stopped cursor without counting its lock in totals', () => {
        const player: any = {
            resolvedOptions: {},
            locks: [
                { frame: 30, piece: Piece.O, clear: { lines: 1, spin: 'none', b2b: 0, ren: 0, perfectClear: false } },
                { frame: 60, piece: Piece.I, clear: { lines: 4, spin: 'none', b2b: 1, ren: 2, perfectClear: false } },
            ],
            terminal: { frame: 100 },
        };

        const created = createInputReplayContext(player, 1, 59, 2);

        expect(created.stats).toMatchObject({
            b2bChain: 2,
            renChain: 3,
            pieces: 1,
            lines: 1,
            lastAction: undefined,
        });
    });

    test('previews from a cloned queue without consuming RNG state', () => {
        const original = context(5);
        const before = cloneInputReplayContext(original);

        const first = inputGarbageView(original);
        const second = inputGarbageView(original);

        expect(first).toEqual(second);
        expect(first.gauge).toBe(5);
        expect(first.nextTankRows).toHaveLength(3);
        expect(first.reservedTanks.map(rows => rows.length)).toEqual([3, 2]);
        expect(first.nextTankFrame).toBe(20);
        expect(original).toEqual(before);
    });

    test('cancels FIFO garbage on a damaging clear and does not rise', () => {
        const field = new Field({});
        for (let y = 0; y < 4; y += 1) {
            for (let x = 0; x < 9; x += 1) field.setToPlayField(x + y * 10, Piece.Gray);
        }
        const initial = context(3, rules(), {
            b2bChain: 1,
            renChain: 1,
            pieces: 4,
            lines: 8,
            perfectClears: 0,
        });

        const transition = advanceInputReplayContext(initial, field, quadI);

        expect(transition.placement).toMatchObject({ clearedLines: 4, garbageCleared: 4 });
        expect(transition).toMatchObject({ attack: 5, cancelled: 3, sent: 2, tankRows: [] });
        expect(transition.context.stats).toMatchObject({ b2bChain: 2, renChain: 2, pieces: 5, lines: 12 });
        expect(inputGarbageView(transition.context).gauge).toBe(0);
    });

    test('a zero-damage clear still blocks garbage rise', () => {
        const field = new Field({});
        for (let x = 0; x < 9; x += 1) field.setToPlayField(x, Piece.Gray);

        const transition = advanceInputReplayContext(context(5), field, verticalI);

        expect(transition.placement.clearedLines).toBe(1);
        expect(transition).toMatchObject({ attack: 0, cancelled: 0, sent: 0, tankRows: [] });
        expect(inputGarbageView(transition.context).gauge).toBe(5);
    });

    test('a no-clear lock tanks multiple ready rows up to the dynamic cap', () => {
        const noClearPiece = { type: Piece.O, rotation: Rotation.Spawn, coordinate: { x: 4, y: 1 } };

        const transition = advanceInputReplayContext(context(5), new Field({}), noClearPiece);

        expect(transition.placement.clearedLines).toBe(0);
        expect(transition.tankRows).toHaveLength(3);
        expect(transition.context.garbage.frame).toBe(20);
        expect(inputGarbageView(transition.context).gauge).toBe(2);
    });

    test('uses the virtual tank frame for a dynamically increasing cap', () => {
        const noClearPiece = { type: Piece.O, rotation: Rotation.Spawn, coordinate: { x: 4, y: 1 } };
        const dynamicRules = rules({
            garbageCap: 1,
            garbageCapIncrease: 3,
        });

        const transition = advanceInputReplayContext(context(5, dynamicRules), new Field({}), noClearPiece);

        expect(transition.context.garbage.frame).toBe(20);
        expect(transition.tankRows).toHaveLength(2);
        expect(inputGarbageView(transition.context).gauge).toBe(3);
    });

    test('emits B2B charge damage when an ordinary clear breaks a long chain', () => {
        const field = new Field({});
        for (let x = 0; x < 9; x += 1) field.setToPlayField(x, Piece.Gray);
        const chargingRules = rules({ b2bCharging: true });
        const initial = context(0, chargingRules, {
            b2bChain: 5,
            renChain: 0,
            pieces: 5,
            lines: 12,
            perfectClears: 0,
        });

        const transition = advanceInputReplayContext(initial, field, verticalI);

        expect(transition).toMatchObject({ attack: 4, cancelled: 0, sent: 4 });
        expect(transition.context.stats.b2bChain).toBe(0);
    });

    test('adds perfect-clear and garbage-line special bonuses in Engine order', () => {
        const field = new Field({});
        for (let y = 0; y < 4; y += 1) {
            for (let x = 0; x < 9; x += 1) field.setToPlayField(x + y * 10, Piece.Gray);
        }
        const bonusRules = rules({
            allClearGarbage: 10,
            allClearB2b: 1,
            specialBonus: true,
        });

        const transition = advanceInputReplayContext(context(0, bonusRules), field, quadI);

        expect(transition.placement.perfectClear).toBe(true);
        expect(transition.attack).toBe(15);
        expect(transition.context.stats.b2bChain).toBe(1);
    });

    test('deep-clones parcel, queue options and last placement data', () => {
        const original = context(2);
        original.stats.lastAction = {
            clearedLines: 1,
            spin: 'none',
            perfectClear: false,
            piece: Piece.I,
        };
        original.garbage.last = { attack: 1, cancelled: 1, sent: 0, risen: 0 };
        const cloned = cloneInputReplayContext(original);

        cloned.garbage.snapshot.queue[0].amount = 9;
        cloned.garbage.options.cap.value = 8;
        cloned.garbage.rules.multiplier = 2;
        cloned.garbage.last!.attack = 7;
        cloned.stats.lastAction!.clearedLines = 4;

        expect(original.garbage.snapshot.queue[0].amount).toBe(2);
        expect(original.garbage.options.cap.value).toBe(3);
        expect(original.garbage.rules.multiplier).toBe(1);
        expect(original.garbage.last.attack).toBe(1);
        expect(original.stats.lastAction.clearedLines).toBe(1);
    });

    test('applies tank rows in order and leaves the next one-row preview', () => {
        const applied = applyInputGarbageRows(new Field({}), [
            { column: 2, size: 1 },
            { column: 5, size: 1 },
        ], { column: 7, size: 2 });

        expect(applied.get(5, 0)).toBe(Piece.Empty);
        expect(applied.get(2, 1)).toBe(Piece.Empty);
        expect(applied.get(0, 0)).toBe(Piece.Gray);
        expect(applied.get(7, -1)).toBe(Piece.Empty);
        expect(applied.get(8, -1)).toBe(Piece.Empty);
        expect(applied.get(6, -1)).toBe(Piece.Gray);
    });

    test('finds only the latest reset boundary on the selected tree path', () => {
        const rootContext = context(1);
        const leftContext = context(2);
        const rightContext = context(4);
        const pages: any[] = [
            { internal: { inputReplayContext: rootContext } },
            { internal: { inputReplayContext: leftContext } },
            { internal: { inputReplayContext: rightContext } },
        ];
        const tree: any = {
            rootId: 'root',
            nodes: [
                { id: 'root', parentId: null, pageIndex: -1, childrenIds: ['p0'] },
                { id: 'p0', parentId: 'root', pageIndex: 0, childrenIds: ['p1', 'p2'] },
                { id: 'p1', parentId: 'p0', pageIndex: 1, childrenIds: [] },
                { id: 'p2', parentId: 'p0', pageIndex: 2, childrenIds: [] },
            ],
        };

        expect(inputGarbageView(inputReplayContextAt(pages, 2, tree)!).gauge).toBe(4);
        expect(inputGarbageView(inputReplayContextAt(pages, 1, tree)!).gauge).toBe(2);
    });
});

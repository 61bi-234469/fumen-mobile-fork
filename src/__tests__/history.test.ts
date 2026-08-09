import { decode, encode } from '../lib/fumen/fumen';
import { toFumenTask, toPage, toPrimitivePage } from '../history_task';

describe('history', () => {
    test('fumen', async () => {
        const init = await decode('v115@ehzhMeAgH');
        const task = toFumenTask(init.map(toPrimitivePage), 'v115@vhAVQJ', 0);

        // replay
        {
            const { pages, index } = await task.replay();
            const data = await encode(pages);
            expect(data).toEqual('vhAVQJ');
            expect(index).toEqual(0);
        }

        // revert
        {
            const { pages, index } = await task.revert();
            const data = await encode(pages);
            expect(data).toEqual('ehzhMeAgH');
            expect(index).toEqual(0);
        }
    });

    test('clones editor-only seven-bag working data', async () => {
        const [page] = await decode('v115@ehzhMeAgH');
        page.internal = {
            sevenBagGrayProgress: { bag: 2, pieces: 9, lines: 1, perfectClears: 0 },
            sevenBagGrayDisplay: { pieces: [1, 2, 3], rowMap: [0, 1, 2] },
        };

        const primitive = toPrimitivePage(page);
        page.internal.sevenBagGrayDisplay!.pieces[0] = 8;
        const restored = toPage(primitive);
        primitive.internal!.sevenBagGrayDisplay!.rowMap[0] = 9;

        expect(restored.internal).toEqual({
            sevenBagGrayProgress: { bag: 2, pieces: 9, lines: 1, perfectClears: 0 },
            sevenBagGrayDisplay: { pieces: [1, 2, 3], rowMap: [0, 1, 2] },
        });
    });

    test('deep-clones replay INPUT garbage state', async () => {
        const [page] = await decode('v115@ehzhMeAgH');
        page.internal = {
            inputReplayContext: {
                stats: {
                    b2bChain: 2,
                    renChain: 3,
                    pieces: 4,
                    lines: 5,
                    perfectClears: 0,
                    lastAction: { clearedLines: 1, spin: 'none', perfectClear: false },
                },
                garbage: {
                    frame: 20,
                    pieces: 4,
                    snapshot: {
                        seed: 1,
                        lastTankTime: 0,
                        lastColumn: null,
                        sent: 0,
                        hasChangedColumn: false,
                        lastReceivedCount: 0,
                        queue: [{
                            frame: 0,
                            amount: 3,
                            size: 1,
                            cid: 7,
                            gameid: 8,
                            confirmed: true,
                        }],
                    },
                    options: {
                        cap: { value: 3, marginTime: 0, increase: 0, absolute: 40, max: 40 },
                        messiness: { change: 0, within: 0, nosame: false, timeout: 0, center: false },
                        garbage: { speed: 20, holeSize: 1 },
                        multiplier: { value: 1, increase: 0, marginTime: 0 },
                        bombs: false,
                        seed: 1,
                        boardWidth: 10,
                        rounding: 'down',
                        openerPhase: 0,
                        specialBonus: false,
                    },
                    rules: {
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
                    },
                    last: { attack: 1, cancelled: 1, sent: 0, risen: 0 },
                },
            },
        };

        const primitive = toPrimitivePage(page);
        page.internal.inputReplayContext!.garbage.snapshot.queue[0].amount = 9;
        const restored = toPage(primitive);
        primitive.internal!.inputReplayContext!.garbage.options.cap.value = 8;
        primitive.internal!.inputReplayContext!.stats.lastAction!.clearedLines = 4;

        expect(restored.internal!.inputReplayContext!.garbage.snapshot.queue[0].amount).toBe(3);
        expect(restored.internal!.inputReplayContext!.garbage.options.cap.value).toBe(3);
        expect(restored.internal!.inputReplayContext!.stats.lastAction!.clearedLines).toBe(1);
    });

});

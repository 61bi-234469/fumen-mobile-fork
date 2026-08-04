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

});

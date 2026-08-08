import { resolveTtrmOptions } from '../options';
import { TtrmPlayerReplay } from '../types';

const playerReplay = (
    replayOptions: { [key: string]: any },
    endOptions?: { [key: string]: any },
): TtrmPlayerReplay => {
    return {
        frames: 0,
        events: endOptions !== undefined
            ? [{ frame: 0, type: 'end', data: { options: endOptions } }]
            : [{ frame: 0, type: 'end', data: {} }],
        options: replayOptions,
        results: {
            stats: { piecesplaced: 0, lines: 0, garbage: { sent: 0, received: 0, attack: 0 } },
            gameoverreason: 'winner',
        },
    };
};

describe('resolveTtrmOptions', () => {
    test('merge priority is defaults < end.data.options < replay.options', () => {
        const { options } = resolveTtrmOptions(playerReplay(
            { seed: 42, garbagecap: 4 },
            { garbagecap: 6, kickset: 'SRS' },
        ));
        expect(options.garbagecap).toEqual(4);    // replay.options wins
        expect(options.kickset).toEqual('SRS');   // end.data.options over defaults
        expect(options.bagtype).toEqual('7-bag'); // measured default
        expect(options.seed).toEqual(42);
    });

    test('fills required keys from defaults when end.data is empty', () => {
        const { options } = resolveTtrmOptions(playerReplay({ seed: 1 }));
        expect(options.boardwidth).toEqual(10);
        expect(options.boardheight).toEqual(20);
        expect(options.kickset).toEqual('SRS+');
        expect(options.garbagecap).toEqual(8);
        expect(options.passthrough).toEqual('zero');
    });

    test('records a warning when the same key differs between sources', () => {
        const { options, warnings } = resolveTtrmOptions(playerReplay(
            { garbagespeed: 10 },
            { garbagespeed: 20 },
        ));
        expect(options.garbagespeed).toEqual(10);
        expect(warnings).toHaveLength(1);
        expect(warnings[0]).toContain('garbagespeed');
    });

    test('no warning when values agree', () => {
        const { warnings } = resolveTtrmOptions(playerReplay(
            { garbagespeed: 20 },
            { garbagespeed: 20 },
        ));
        expect(warnings).toHaveLength(0);
    });
});

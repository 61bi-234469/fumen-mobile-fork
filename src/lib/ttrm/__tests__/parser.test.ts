import { MAX_TTRM_TEXT_LENGTH, parseTtrm, TtrmError } from '../parser';

const leagueWin = require('./fixtures/league_win.json');
const privateSwapped = require('./fixtures/private_swapped.json');

describe('parseTtrm', () => {
    test('parses the league fixture', () => {
        const file = parseTtrm(JSON.stringify(leagueWin));
        expect(file.version).toEqual(1);
        expect(file.gamemode).toEqual('league');
        expect(file.replay.rounds).toHaveLength(1);
        expect(file.replay.rounds[0]).toHaveLength(2);
    });

    test('parses the private room fixture', () => {
        const file = parseTtrm(JSON.stringify(privateSwapped));
        expect(file.replay.rounds[0].map(p => p.id)).toEqual(['player-a-id', 'player-b-id']);
    });

    test('unwraps nested replay wrappers (depth 1 and 2)', () => {
        for (const wrapped of [{ replay: leagueWin }, { replay: { replay: leagueWin } }]) {
            const file = parseTtrm(JSON.stringify(wrapped));
            expect(file.replay.rounds).toHaveLength(1);
            expect(file.version).toEqual(1);
        }
    });

    test('rejects invalid JSON with stage json', () => {
        try {
            parseTtrm('{ broken');
            fail('should throw');
        } catch (e) {
            expect(e).toBeInstanceOf(TtrmError);
            expect((e as TtrmError).stage).toEqual('json');
        }
    });

    test('rejects unknown version with stage version', () => {
        const copy = { ...leagueWin, version: 2 };
        try {
            parseTtrm(JSON.stringify(copy));
            fail('should throw');
        } catch (e) {
            expect((e as TtrmError).stage).toEqual('version');
        }
    });

    test('rejects files without rounds with stage structure', () => {
        try {
            parseTtrm(JSON.stringify({ version: 1, replay: {} }));
            fail('should throw');
        } catch (e) {
            expect((e as TtrmError).stage).toEqual('structure');
        }
    });

    test('rejects players without replay data with stage structure', () => {
        const copy = JSON.parse(JSON.stringify(leagueWin));
        delete copy.replay.rounds[0][1].replay.events;
        try {
            parseTtrm(JSON.stringify(copy));
            fail('should throw');
        } catch (e) {
            expect((e as TtrmError).stage).toEqual('structure');
        }
    });

    test('rejects oversized input with stage size', () => {
        const text = `{"pad":"${'x'.repeat(MAX_TTRM_TEXT_LENGTH)}"}`;
        try {
            parseTtrm(text);
            fail('should throw');
        } catch (e) {
            expect((e as TtrmError).stage).toEqual('size');
        }
    });

    // P1 レビュー対応: frame が数値でない/負/非整数だと simulator の tick ループが
    // 終了条件を満たせず Worker が無限ループするため、parser で必ず弾く。
    describe('rejects malformed events / frames with stage structure', () => {
        test('non-numeric event frame', () => {
            const copy = JSON.parse(JSON.stringify(leagueWin));
            copy.replay.rounds[0][0].replay.events[0].frame = 'not-a-number';
            try {
                parseTtrm(JSON.stringify(copy));
                fail('should throw');
            } catch (e) {
                expect((e as TtrmError).stage).toEqual('structure');
            }
        });

        test('negative event frame', () => {
            const copy = JSON.parse(JSON.stringify(leagueWin));
            copy.replay.rounds[0][0].replay.events[0].frame = -1;
            try {
                parseTtrm(JSON.stringify(copy));
                fail('should throw');
            } catch (e) {
                expect((e as TtrmError).stage).toEqual('structure');
            }
        });

        test('non-integer event frame', () => {
            const copy = JSON.parse(JSON.stringify(leagueWin));
            copy.replay.rounds[0][0].replay.events[0].frame = 1.5;
            try {
                parseTtrm(JSON.stringify(copy));
                fail('should throw');
            } catch (e) {
                expect((e as TtrmError).stage).toEqual('structure');
            }
        });

        test('event without a type', () => {
            const copy = JSON.parse(JSON.stringify(leagueWin));
            delete copy.replay.rounds[0][0].replay.events[0].type;
            try {
                parseTtrm(JSON.stringify(copy));
                fail('should throw');
            } catch (e) {
                expect((e as TtrmError).stage).toEqual('structure');
            }
        });

        test('non-object event', () => {
            const copy = JSON.parse(JSON.stringify(leagueWin));
            copy.replay.rounds[0][0].replay.events[0] = 'not-an-event';
            try {
                parseTtrm(JSON.stringify(copy));
                fail('should throw');
            } catch (e) {
                expect((e as TtrmError).stage).toEqual('structure');
            }
        });

        test('invalid replay.frames (non-integer / negative)', () => {
            for (const bad of [1.5, -1]) {
                const copy = JSON.parse(JSON.stringify(leagueWin));
                copy.replay.rounds[0][0].replay.frames = bad;
                try {
                    parseTtrm(JSON.stringify(copy));
                    fail('should throw');
                } catch (e) {
                    expect((e as TtrmError).stage).toEqual('structure');
                }
            }
        });
    });
});

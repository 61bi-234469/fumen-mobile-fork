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
});

jest.mock('../shortcuts', () => ({ isAnyModalOpen: () => false }));

import { pickDroppedReplayFile } from '../replay_file_drop';
import { Screens } from '../../lib/enums';

const file = (name: string) => ({ name } as File);

describe('pickDroppedReplayFile', () => {
    test('picks a .ttrm file from any screen, ignoring case', () => {
        const files = [file('notes.txt'), file('match.TTRM')];
        expect(pickDroppedReplayFile(files, Screens.Editor)!.name).toEqual('match.TTRM');
        expect(pickDroppedReplayFile(files, Screens.ListView)!.name).toEqual('match.TTRM');
    });

    test('leaves other files alone outside the Replay screen', () => {
        expect(pickDroppedReplayFile([file('replay.json')], Screens.Editor)).toBeUndefined();
        expect(pickDroppedReplayFile([], Screens.Editor)).toBeUndefined();
    });

    test('accepts any file on the Replay screen, like the file picker', () => {
        expect(pickDroppedReplayFile([file('replay.json')], Screens.Replay)!.name).toEqual('replay.json');
    });
});

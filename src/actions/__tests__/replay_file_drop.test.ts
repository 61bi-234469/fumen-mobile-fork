/**
 * @jest-environment jsdom
 */

let modalOpen = false;
jest.mock('../shortcuts', () => ({ isAnyModalOpen: () => modalOpen }));

import { initReplayFileDrop, pickDroppedReplayFile } from '../replay_file_drop';
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

describe('initReplayFileDrop', () => {
    const calls: string[] = [];
    let screen = Screens.Editor;
    const actions = {
        openReplayScreen: jest.fn(() => calls.push('open')),
        importTtrmFile: jest.fn(({ file: dropped }: { file: File }) => calls.push(`import:${dropped.name}`)),
    };

    beforeAll(() => {
        initReplayFileDrop(
            () => ({ mode: { screen } } as any),
            () => actions as any,
        );
    });

    beforeEach(() => {
        calls.length = 0;
        screen = Screens.Editor;
        modalOpen = false;
    });

    const drop = (types: string[], files: File[]) => {
        const event = new Event('drop', { cancelable: true }) as any;
        event.dataTransfer = { types, files };
        window.dispatchEvent(event);
        return event as Event;
    };

    test('opens the Replay screen once and then imports the dropped .ttrm', () => {
        const event = drop(['Files'], [file('match.ttrm')]);
        expect(event.defaultPrevented).toBe(true);
        expect(calls).toEqual(['open', 'import:match.ttrm']);
    });

    test('imports without switching screens when already on Replay', () => {
        screen = Screens.Replay;
        drop(['Files'], [file('replay.json')]);
        expect(calls).toEqual(['import:replay.json']);
    });

    test('lets in-app drags without files through untouched', () => {
        const event = drop(['text/plain'], []);
        expect(event.defaultPrevented).toBe(false);
        expect(calls).toEqual([]);
    });

    test('ignores images dragged from inside the page, which also carry Files', () => {
        screen = Screens.Replay;
        window.dispatchEvent(new Event('dragstart', { cancelable: true }));
        const event = drop(['Files', 'text/uri-list'], [file('image.png')]);
        expect(event.defaultPrevented).toBe(true);
        expect(calls).toEqual([]);

        window.dispatchEvent(new Event('dragend'));
        drop(['Files'], [file('replay.json')]);
        expect(calls).toEqual(['import:replay.json']);
    });

    test('still imports after an in-page drag was cancelled at dragstart', () => {
        screen = Screens.Replay;
        const start = new Event('dragstart', { cancelable: true });
        start.preventDefault();
        window.dispatchEvent(start);
        drop(['Files'], [file('replay.json')]);
        expect(calls).toEqual(['import:replay.json']);
    });

    test('ignores drops while a modal is open', () => {
        modalOpen = true;
        const event = drop(['Files'], [file('match.ttrm')]);
        expect(event.defaultPrevented).toBe(true);
        expect(calls).toEqual([]);
    });
});

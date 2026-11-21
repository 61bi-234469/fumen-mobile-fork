/** @jest-environment jsdom */

import { decode, encodeSync } from '../lib/fumen/fumen';
import { Page } from '../lib/fumen/types';

// memento はモジュールシングルトンなので、テストごとに読み込み直す
const loadMemento = () => {
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('../memento').memento as typeof import('../memento').memento;
};

describe('memento autosave', () => {
    let pagesA: Page[];
    let pagesB: Page[];
    let fumenA: string;
    let fumenB: string;

    beforeAll(async () => {
        pagesA = await decode('v115@vhAAgH');
        pagesB = [...pagesA, { ...pagesA[0], index: 1, field: { ref: 0 }, comment: { text: 'second' } }];
        fumenA = `v115@${encodeSync(pagesA)}`;
        fumenB = `v115@${encodeSync(pagesB)}`;
        expect(fumenA).not.toBe(fumenB);
    });

    beforeEach(() => {
        jest.useFakeTimers();
        localStorage.clear();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('builds and writes the latest pages on the next task', () => {
        const memento = loadMemento();
        const buildA = jest.fn(() => pagesA);
        const buildB = jest.fn(() => pagesB);

        memento.save(buildA);
        memento.save(buildB);
        expect(localStorage.getItem('data@1')).toBeNull();

        jest.runOnlyPendingTimers();
        expect(buildA).not.toHaveBeenCalled();
        expect(buildB).toHaveBeenCalledTimes(1);
        expect(localStorage.getItem('data@1')).toBe(fumenB);
    });

    test('flush writes a pending save synchronously with the given pages', () => {
        const memento = loadMemento();
        memento.setAutosaveSource('source-key');
        memento.save(() => pagesA);

        memento.flush(() => pagesB);
        expect(localStorage.getItem('data@1')).toBe(fumenB);
        expect(localStorage.getItem('data-source@1')).toBe('source-key');

        // The flushed save replaces the queued one.
        localStorage.removeItem('data@1');
        jest.runOnlyPendingTimers();
        expect(localStorage.getItem('data@1')).toBeNull();
    });

    test('loading another fumen while a save is pending flushes the new pages under the new source', () => {
        const memento = loadMemento();
        memento.setAutosaveSource('source-a');
        memento.save(() => pagesA);
        memento.setAutosaveSource('source-b');
        memento.save(() => pagesB);

        memento.flush(() => pagesB);
        expect(localStorage.getItem('data@1')).toBe(fumenB);
        expect(localStorage.getItem('data-source@1')).toBe('source-b');

        jest.runOnlyPendingTimers();
        expect(localStorage.getItem('data@1')).toBe(fumenB);
        expect(localStorage.getItem('data-source@1')).toBe('source-b');
    });

    test('flush leaves the stored data alone when nothing is pending', () => {
        const memento = loadMemento();
        localStorage.setItem('data@1', fumenA);
        const build = jest.fn(() => pagesB);

        memento.flush(build);
        expect(build).not.toHaveBeenCalled();
        expect(localStorage.getItem('data@1')).toBe(fumenA);
    });

    test('saveImmediately writes now and keeps the older queued save from overwriting it', () => {
        const memento = loadMemento();
        memento.save(() => pagesA);

        memento.saveImmediately(pagesB);
        expect(localStorage.getItem('data@1')).toBe(fumenB);

        jest.runOnlyPendingTimers();
        expect(localStorage.getItem('data@1')).toBe(fumenB);
    });

    test('a failing build is logged and does not break later saves', () => {
        const memento = loadMemento();
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
        try {
            memento.save(() => {
                throw new Error('build failed');
            });
            jest.runOnlyPendingTimers();
            expect(consoleError).toHaveBeenCalled();

            memento.save(() => pagesA);
            jest.runOnlyPendingTimers();
            expect(localStorage.getItem('data@1')).toBe(fumenA);
        } finally {
            consoleError.mockRestore();
        }
    });
});

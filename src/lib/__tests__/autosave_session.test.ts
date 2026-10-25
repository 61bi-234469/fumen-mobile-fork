/** @jest-environment jsdom */

import { chooseStartupFumen, rememberPageIndex, toUrlFumenKey } from '../autosave_session';
import { localStorageWrapper } from '../../memento';

describe('toUrlFumenKey', () => {
    test('returns the same key for the same fumen and different keys otherwise', () => {
        expect(toUrlFumenKey('v115@vhAAgH')).toBe(toUrlFumenKey('v115@vhAAgH'));
        expect(toUrlFumenKey('v115@vhAAgH')).not.toBe(toUrlFumenKey('v115@vhAAgI'));
    });
});

describe('chooseStartupFumen', () => {
    const urlFumen = 'v115@vhAAgH';
    const storedFumen = 'v115@bhD8JeAgH';

    test('opens the URL fumen when the saved data came from elsewhere', () => {
        expect(chooseStartupFumen({
            urlFumen,
            storedFumen,
            storedSourceUrlKey: undefined,
            storedPageIndex: 3,
            tabSourceUrlKey: toUrlFumenKey(urlFumen),
        })).toEqual({ fumen: urlFumen, restored: false, sourceUrlKey: toUrlFumenKey(urlFumen) });
    });

    test('restores the saved edits when the same tab reopens the same URL', () => {
        expect(chooseStartupFumen({
            urlFumen,
            storedFumen,
            storedSourceUrlKey: toUrlFumenKey(urlFumen),
            storedPageIndex: 3,
            tabSourceUrlKey: toUrlFumenKey(urlFumen),
        })).toEqual({ fumen: storedFumen, restored: true, pageIndex: 3, sourceUrlKey: toUrlFumenKey(urlFumen) });
    });

    test('opens the URL fumen as shared when a new tab opens the same URL', () => {
        expect(chooseStartupFumen({
            urlFumen,
            storedFumen,
            storedSourceUrlKey: toUrlFumenKey(urlFumen),
            storedPageIndex: 3,
            tabSourceUrlKey: undefined,
        })?.fumen).toBe(urlFumen);
    });

    test('opens a different URL fumen even when the saved data came from a URL', () => {
        expect(chooseStartupFumen({
            urlFumen,
            storedFumen,
            storedSourceUrlKey: toUrlFumenKey('v115@vhAAgI'),
            storedPageIndex: 3,
            tabSourceUrlKey: toUrlFumenKey('v115@vhAAgI'),
        })?.fumen).toBe(urlFumen);
    });

    test('restores the saved data and page without a URL fumen', () => {
        expect(chooseStartupFumen({
            storedFumen,
            urlFumen: undefined,
            storedSourceUrlKey: 'key',
            storedPageIndex: 2,
            tabSourceUrlKey: undefined,
        })).toEqual({ fumen: storedFumen, restored: true, pageIndex: 2, sourceUrlKey: 'key' });
    });

    test('returns undefined when there is nothing to open', () => {
        expect(chooseStartupFumen({
            urlFumen: undefined,
            storedFumen: undefined,
            storedSourceUrlKey: undefined,
            storedPageIndex: undefined,
            tabSourceUrlKey: undefined,
        })).toBeUndefined();
    });
});

describe('autosave storage', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    test('saves the source URL key with the data and removes it for other sources', () => {
        localStorageWrapper.saveFumen('v115@vhAAgH', 'key');
        expect(localStorageWrapper.loadFumenSourceUrlKey()).toBe('key');

        localStorageWrapper.saveFumen('v115@vhAAgH');
        expect(localStorageWrapper.loadFumenSourceUrlKey()).toBeUndefined();
        expect(localStorageWrapper.loadFumen()).toBe('v115@vhAAgH');
    });

    test('remembers the page index and ignores invalid values', () => {
        rememberPageIndex(4);
        expect(localStorageWrapper.loadPageIndex()).toBe(4);

        localStorage.setItem('data-page@1', '-1');
        expect(localStorageWrapper.loadPageIndex()).toBeUndefined();
        localStorage.setItem('data-page@1', 'abc');
        expect(localStorageWrapper.loadPageIndex()).toBeUndefined();
    });
});

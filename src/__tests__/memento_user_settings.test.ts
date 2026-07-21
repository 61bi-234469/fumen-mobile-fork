/** @jest-environment jsdom */

import { localStorageWrapper } from '../memento';

describe('user settings initial screen migration', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    test('migrates the legacy skipReaderMode true to editor', () => {
        localStorage.setItem('user-settings@1', JSON.stringify({ skipReaderMode: true }));

        expect(localStorageWrapper.loadUserSettings().initialScreen).toBe('editor');
    });

    test('falls back to reader when skipReaderMode is false', () => {
        localStorage.setItem('user-settings@1', JSON.stringify({ skipReaderMode: false }));

        expect(localStorageWrapper.loadUserSettings().initialScreen).toBe('reader');
    });

    test('prefers a valid initialScreen over the legacy key', () => {
        localStorage.setItem('user-settings@1', JSON.stringify({ initialScreen: 'tree', skipReaderMode: true }));

        expect(localStorageWrapper.loadUserSettings().initialScreen).toBe('tree');
    });

    test('rejects an invalid initialScreen and applies the legacy fallback', () => {
        localStorage.setItem('user-settings@1', JSON.stringify({ initialScreen: 'invalid', skipReaderMode: true }));

        expect(localStorageWrapper.loadUserSettings().initialScreen).toBe('editor');
    });
});

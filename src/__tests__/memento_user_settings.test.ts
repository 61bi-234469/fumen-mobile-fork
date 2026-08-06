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

describe('user settings FLAGS visibility', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    test('loads a boolean flagsHidden value', () => {
        localStorage.setItem('user-settings@1', JSON.stringify({ flagsHidden: false }));

        expect(localStorageWrapper.loadUserSettings().flagsHidden).toBe(false);
    });

    test('rejects a missing or invalid flagsHidden value', () => {
        expect(localStorageWrapper.loadUserSettings().flagsHidden).toBeUndefined();

        localStorage.setItem('user-settings@1', JSON.stringify({ flagsHidden: 'false' }));
        expect(localStorageWrapper.loadUserSettings().flagsHidden).toBeUndefined();
    });
});

describe('user settings PAINT palette design', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    test('loads a boolean paintPaletteMinoDesign value', () => {
        localStorage.setItem('user-settings@1', JSON.stringify({ paintPaletteMinoDesign: true }));

        expect(localStorageWrapper.loadUserSettings().paintPaletteMinoDesign).toBe(true);
    });

    test('rejects a missing or invalid paintPaletteMinoDesign value', () => {
        expect(localStorageWrapper.loadUserSettings().paintPaletteMinoDesign).toBeUndefined();

        localStorage.setItem('user-settings@1', JSON.stringify({ paintPaletteMinoDesign: 'true' }));
        expect(localStorageWrapper.loadUserSettings().paintPaletteMinoDesign).toBeUndefined();
    });
});

describe('user settings UTILS menu pinning', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    test('loads a boolean utilsMenuPinned value', () => {
        localStorage.setItem('user-settings@1', JSON.stringify({ utilsMenuPinned: true }));

        expect(localStorageWrapper.loadUserSettings().utilsMenuPinned).toBe(true);
    });

    test('keeps older settings undefined so the default (not pinned) applies', () => {
        expect(localStorageWrapper.loadUserSettings().utilsMenuPinned).toBeUndefined();

        localStorage.setItem('user-settings@1', JSON.stringify({ utilsMenuPinned: 'true' }));
        expect(localStorageWrapper.loadUserSettings().utilsMenuPinned).toBeUndefined();
    });
});

describe('user settings soft-drop priority', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    test('loads a boolean soft-drop priority value', () => {
        localStorage.setItem('user-settings@1', JSON.stringify({ pieceShortcutSoftDropPriority: true }));

        expect(localStorageWrapper.loadUserSettings().pieceShortcutSoftDropPriority).toBe(true);
    });

    test('keeps the default path undefined for older settings', () => {
        expect(localStorageWrapper.loadUserSettings().pieceShortcutSoftDropPriority).toBeUndefined();
    });
});

describe('user settings page rotation', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    test('loads the stored page rotation limit', () => {
        localStorage.setItem('user-settings@1', JSON.stringify({ pageRotationLimit: 30 }));

        expect(localStorageWrapper.loadUserSettings().pageRotationLimit).toBe(30);
    });

    test('keeps older settings undefined so the default (no limit) applies', () => {
        expect(localStorageWrapper.loadUserSettings().pageRotationLimit).toBeUndefined();

        localStorage.setItem('user-settings@1', JSON.stringify({ pageRotationLimit: '30' }));
        expect(localStorageWrapper.loadUserSettings().pageRotationLimit).toBeUndefined();
    });
});

/** @jest-environment jsdom */

import { loadPersistedReplaySelfPlayer, persistViewSettings } from '../view_settings';

describe('view settings with blocked storage', () => {
    const original = Object.getOwnPropertyDescriptor(window, 'localStorage');

    beforeEach(() => {
        // Browsers that block site data throw from the localStorage getter itself.
        Object.defineProperty(window, 'localStorage', {
            configurable: true,
            get: () => {
                throw new DOMException('blocked', 'SecurityError');
            },
        });
    });

    afterEach(() => {
        if (original) {
            Object.defineProperty(window, 'localStorage', original);
        }
    });

    test('reads fall back to defaults', () => {
        expect(loadPersistedReplaySelfPlayer()).toBeNull();
    });

    test('saving is skipped without throwing', () => {
        expect(() => persistViewSettings({} as any)).not.toThrow();
    });
});

import { clearAppCaches } from '../force_reload';

describe('force_reload', () => {
    const globalAny = global as any;
    const originalCaches = globalAny.caches;
    const originalNavigator = globalAny.navigator;
    let consoleError: jest.SpyInstance;

    const setServiceWorker = (value: any) => {
        globalAny.navigator = { serviceWorker: value };
    };

    beforeEach(() => {
        consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    });

    afterEach(() => {
        consoleError.mockRestore();
        globalAny.navigator = originalNavigator;
        globalAny.caches = originalCaches;
    });

    test('unregisters every service worker and deletes every cache', async () => {
        const unregister = jest.fn().mockResolvedValue(true);
        setServiceWorker({ getRegistrations: jest.fn().mockResolvedValue([{ unregister }, { unregister }]) });
        const deleteCache = jest.fn().mockResolvedValue(true);
        globalAny.caches = { keys: jest.fn().mockResolvedValue(['a', 'b']), delete: deleteCache };

        await clearAppCaches();

        expect(unregister).toHaveBeenCalledTimes(2);
        expect(deleteCache.mock.calls.map(call => call[0])).toEqual(['a', 'b']);
    });

    test('keeps cleaning and resolves when one of the two fails', async () => {
        setServiceWorker({ getRegistrations: jest.fn().mockRejectedValue(new Error('unavailable')) });
        const deleteCache = jest.fn().mockResolvedValue(true);
        globalAny.caches = { keys: jest.fn().mockResolvedValue(['a']), delete: deleteCache };

        await clearAppCaches();

        expect(deleteCache).toHaveBeenCalledWith('a');
        expect(consoleError).toHaveBeenCalled();
    });

    test('does nothing when neither API exists', async () => {
        setServiceWorker(undefined);
        globalAny.caches = undefined;

        await clearAppCaches();

        expect(consoleError).not.toHaveBeenCalled();
    });
});

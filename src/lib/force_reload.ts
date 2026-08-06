// このアプリはService Workerのプリキャッシュ(sw.js)から配信されるため、通常のリロードでは
// 古いビルドがそのまま再生成される。登録解除とCache Storageの削除まで済ませてから読み込み直す。

const unregisterServiceWorkers = async (): Promise<void> => {
    if (typeof navigator === 'undefined' || navigator.serviceWorker === undefined) {
        return;
    }
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map(registration => registration.unregister()));
};

const deleteCacheStorage = async (): Promise<void> => {
    if (typeof caches === 'undefined') {
        return;
    }
    const keys = await caches.keys();
    await Promise.all(keys.map(key => caches.delete(key)));
};

// 片方が失敗しても、もう片方の掃除とリロードは続ける
export const clearAppCaches = async (): Promise<void> => {
    const results = await Promise.all([
        unregisterServiceWorkers().catch(error => error as Error),
        deleteCacheStorage().catch(error => error as Error),
    ]);
    for (const result of results) {
        if (result !== undefined) {
            console.error(result);
        }
    }
};

export const forceReload = async (): Promise<void> => {
    await clearAppCaches();
    window.location.reload();
};

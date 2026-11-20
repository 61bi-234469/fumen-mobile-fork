// A save slower than about one frame makes the next ones wait for a pause in editing.
export const AUTOSAVE_SLOW_SAVE_MS = 16;
export const AUTOSAVE_DEBOUNCE_MS = 500;
// Continuous editing (e.g. fast INPUT play) still saves at least this often.
export const AUTOSAVE_MAX_WAIT_MS = 3000;

export interface AutosaveScheduler {
    // Queues a save. Only the latest queued save runs; earlier ones are dropped.
    schedule: (save: () => void) => void;
    // Runs the queued save now, or `replacement` in its place. Does nothing when no save is queued.
    flush: (replacement?: () => void) => void;
    // Drops the queued save, for callers that write the same data themselves.
    cancel: () => void;
}

interface SchedulerOptions {
    now?: () => number;
    setTimer?: (callback: () => void, delay: number) => unknown;
    clearTimer?: (timer: unknown) => void;
}

/**
 * Saves run on the next task while they are cheap, which keeps short fumens saving as before.
 * Once a save takes longer than AUTOSAVE_SLOW_SAVE_MS, later saves are debounced so that a long fumen
 * is not rebuilt and encoded on every edit.
 */
export const createAutosaveScheduler = ({
    now = () => Date.now(),
    setTimer = (callback, delay) => setTimeout(callback, delay),
    clearTimer = timer => clearTimeout(timer as ReturnType<typeof setTimeout>),
}: SchedulerOptions = {}): AutosaveScheduler => {
    let pending: (() => void) | undefined;
    let timer: unknown;
    let firstQueuedAt = 0;
    let lastCostMs = 0;

    const clear = () => {
        if (timer !== undefined) {
            clearTimer(timer);
            timer = undefined;
        }
    };

    const run = (save: () => void) => {
        clear();
        pending = undefined;
        const startedAt = now();
        try {
            save();
        } finally {
            lastCostMs = now() - startedAt;
        }
    };

    return {
        schedule: (save) => {
            const queuedAt = now();
            if (pending === undefined) {
                firstQueuedAt = queuedAt;
            }
            pending = save;
            clear();
            const delay = lastCostMs < AUTOSAVE_SLOW_SAVE_MS
                ? 0
                : Math.max(0, Math.min(AUTOSAVE_DEBOUNCE_MS, firstQueuedAt + AUTOSAVE_MAX_WAIT_MS - queuedAt));
            timer = setTimer(() => {
                timer = undefined;
                if (pending !== undefined) {
                    run(pending);
                }
            }, delay);
        },
        flush: (replacement) => {
            if (pending !== undefined) {
                run(replacement ?? pending);
            }
        },
        cancel: () => {
            clear();
            pending = undefined;
        },
    };
};

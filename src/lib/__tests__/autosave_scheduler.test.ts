import {
    AUTOSAVE_DEBOUNCE_MS,
    AUTOSAVE_MAX_WAIT_MS,
    AUTOSAVE_SLOW_SAVE_MS,
    createAutosaveScheduler,
} from '../autosave_scheduler';

// Manual clock and timers so that save costs and delays are exact.
const createHarness = () => {
    let time = 0;
    let nextId = 1;
    const timers = new Map<number, { at: number, callback: () => void }>();
    const delays: number[] = [];
    const scheduler = createAutosaveScheduler({
        now: () => time,
        setTimer: (callback, delay) => {
            const id = nextId;
            nextId += 1;
            timers.set(id, { callback, at: time + delay });
            delays.push(delay);
            return id;
        },
        clearTimer: (id) => {
            timers.delete(id as number);
        },
    });
    const advance = (ms: number) => {
        const until = time + ms;
        for (;;) {
            const due = Array.from(timers.entries())
                .filter(([, timer]) => timer.at <= until)
                .sort(([, a], [, b]) => a.at - b.at)[0];
            if (due === undefined) {
                break;
            }
            timers.delete(due[0]);
            time = due[1].at;
            due[1].callback();
        }
        // A slow save may already have moved the clock past `until`.
        time = Math.max(time, until);
    };
    // A save that takes `cost` ms on the manual clock.
    const save = (log: string[], name: string, cost = 0) => () => {
        log.push(name);
        time += cost;
    };
    return { scheduler, advance, save, delays, pendingTimers: () => timers.size };
};

describe('createAutosaveScheduler', () => {
    test('runs cheap saves on the next task and only the latest queued one', () => {
        const { scheduler, advance, save, delays } = createHarness();
        const log: string[] = [];

        scheduler.schedule(save(log, 'a'));
        scheduler.schedule(save(log, 'b'));
        expect(log).toEqual([]);

        advance(0);
        expect(log).toEqual(['b']);
        expect(delays).toEqual([0, 0]);
    });

    test('debounces after a slow save and still saves within the max wait', () => {
        const { scheduler, advance, save, delays } = createHarness();
        const log: string[] = [];

        scheduler.schedule(save(log, 'slow', AUTOSAVE_SLOW_SAVE_MS));
        advance(0);
        expect(log).toEqual(['slow']);

        // Edits arriving faster than the debounce keep postponing the save, up to the max wait.
        const step = AUTOSAVE_DEBOUNCE_MS - 100;
        let count = 0;
        while (log.length === 1) {
            scheduler.schedule(save(log, `edit${count}`));
            count += 1;
            advance(step);
        }
        expect(delays[1]).toBe(AUTOSAVE_DEBOUNCE_MS);
        expect(log[1]).toBe(`edit${count - 1}`);
        expect((count - 1) * step).toBeLessThanOrEqual(AUTOSAVE_MAX_WAIT_MS);
        expect(count * step).toBeGreaterThanOrEqual(AUTOSAVE_MAX_WAIT_MS);
    });

    test('returns to immediate saves once a save is cheap again', () => {
        const { scheduler, advance, save, delays } = createHarness();
        const log: string[] = [];

        scheduler.schedule(save(log, 'slow', AUTOSAVE_SLOW_SAVE_MS));
        advance(0);
        scheduler.schedule(save(log, 'cheap'));
        advance(AUTOSAVE_DEBOUNCE_MS);
        scheduler.schedule(save(log, 'next'));
        advance(0);

        expect(log).toEqual(['slow', 'cheap', 'next']);
        expect(delays).toEqual([0, AUTOSAVE_DEBOUNCE_MS, 0]);
    });

    test('flush runs the queued save now, or the replacement in its place', () => {
        const { scheduler, advance, save, pendingTimers } = createHarness();
        const log: string[] = [];

        scheduler.schedule(save(log, 'queued'));
        scheduler.flush();
        expect(log).toEqual(['queued']);
        expect(pendingTimers()).toBe(0);

        scheduler.schedule(save(log, 'queued2'));
        scheduler.flush(save(log, 'replacement'));
        advance(AUTOSAVE_MAX_WAIT_MS);
        expect(log).toEqual(['queued', 'replacement']);
    });

    test('flush does nothing without a queued save', () => {
        const { scheduler, save } = createHarness();
        const log: string[] = [];

        scheduler.flush(save(log, 'replacement'));
        expect(log).toEqual([]);
    });

    test('cancel drops the queued save', () => {
        const { scheduler, advance, save } = createHarness();
        const log: string[] = [];

        scheduler.schedule(save(log, 'queued'));
        scheduler.cancel();
        advance(AUTOSAVE_MAX_WAIT_MS);
        scheduler.flush(save(log, 'replacement'));
        expect(log).toEqual([]);
    });
});

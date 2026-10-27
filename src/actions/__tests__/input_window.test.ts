import { Field } from '../../lib/fumen/field';
import { Page } from '../../lib/fumen/types';
import { inputGarbageSegments } from '../../lib/input_replay';
import { computeInputStats } from '../../lib/input_stats';
import { State } from '../../states';

const calls: string[] = [];

jest.mock('../../actions', () => {
    const record = (name: string) => () => () => {
        (global as any).__inputWindowCalls.push(name);
        return undefined;
    };
    const setCommentText = ({ pageIndex, text }: { pageIndex: number, text: string }) => (state: any) => {
        (global as any).__inputWindowCalls.push(`comment:${text}`);
        state.fumen.pages[pageIndex].comment = { text };
        return undefined;
    };
    return {
        actions: {
            setCommentText,
            registerHistoryTask: record('registerHistoryTask'),
            reopenCurrentPage: record('reopen'),
        },
    };
});
jest.mock('../cold_clear', () => {
    const record = (name: string) => () => () => {
        (global as any).__inputWindowCalls.push(name);
        return undefined;
    };
    return {
        coldClearActions: {
            seedQueuePreviewFromSpawnedPiece: record('seed'),
            promoteQueueNextToCurrent: record('promote'),
            commitColdClearQueueComment: record('commit'),
        },
    };
});

import { inputWindowActions } from '../input_window';
import { inputGarbageActions } from '../input_garbage';

(global as any).__inputWindowCalls = calls;

const createState = (comment = ''): State => {
    const page: Page = {
        index: 0,
        field: { obj: new Field({}) },
        comment: { text: comment },
        flags: { lock: true, mirror: false, colorize: true, rise: false, quiz: false },
    };
    return {
        fumen: { pages: [page], currentIndex: 0 },
        mode: { rotationSystem: 'srsPlus' },
        tree: { enabled: false, nodes: [], rootId: null },
        modal: { inputWindow: false },
        temporary: {
            inputWindowTab: 'state', inputWindowQueueVisited: false, pieceQueueFocus: 'next', inputGarbageSegments: [],
        },
    } as unknown as State;
};

// Hyperapp merges an action's partial result into the state; the tests do the same.
const run = (state: State, action: (state: State) => any): State => {
    const partial = action(state);
    return partial === undefined ? state : { ...state, ...partial };
};

describe('inputWindowActions', () => {
    beforeEach(() => {
        calls.length = 0;
    });

    test('opens on the tapped tab and loads the page garbage as the draft', () => {
        const state = run(createState(), inputWindowActions.openInputWindow({ tab: 'garbage' }) as any);

        expect(state.modal.inputWindow).toBe(true);
        expect(state.temporary.inputWindowTab).toBe('garbage');
        expect(state.temporary.inputGarbageSegments).toEqual([]);
        expect(state.temporary.inputWindowQueueVisited).toBe(false);
        expect(calls).toEqual([]);
    });

    test('opening the queue tab seeds the queue and keeps the tapped slot focus', () => {
        const state = run(createState(), inputWindowActions.openInputWindow({ tab: 'queue', focus: 'hold' }) as any);

        expect(state.temporary.inputWindowTab).toBe('queue');
        expect(state.temporary.pieceQueueFocus).toBe('hold');
        expect(state.temporary.inputWindowQueueVisited).toBe(true);
        expect(calls).toEqual(['seed']);
    });

    test('leaving the garbage tab applies the draft so the State tab shows it', () => {
        let state = run(createState(), inputWindowActions.openInputWindow({ tab: 'garbage' }) as any);
        state = run(state, inputGarbageActions.updateInputGarbageDraft({
            segments: [{ amount: 3, column: 0 }],
        }) as any);
        state = run(state, inputWindowActions.selectInputWindowTab({ tab: 'state' }) as any);

        expect(state.temporary.inputWindowTab).toBe('state');
        const context = state.fumen.pages[0].internal?.inputReplayContext;
        expect(context === undefined ? [] : inputGarbageSegments(context)).toEqual([{ amount: 3, column: 0 }]);
        expect(calls).toEqual(['registerHistoryTask', 'reopen']);
    });

    test('closing commits the queue only after its tab was shown, and an untouched draft adds no history', () => {
        let state = run(createState(), inputWindowActions.openInputWindow({ tab: 'state' }) as any);
        state = run(state, inputWindowActions.closeInputWindow() as any);
        expect(state.modal.inputWindow).toBe(false);
        expect(calls).toEqual([]);

        state = run(state, inputWindowActions.openInputWindow({ tab: 'state' }) as any);
        state = run(state, inputWindowActions.selectInputWindowTab({ tab: 'queue' }) as any);
        state = run(state, inputWindowActions.closeInputWindow() as any);
        expect(calls).toEqual(['seed', 'promote', 'commit']);

        // Materialize's onCloseStart repeats the close after the button already closed the window.
        expect(inputWindowActions.closeInputWindow()(state)).toBeUndefined();
    });

    test('sets B2B and COMBO on the page and writes them into the queue comment in one history step', () => {
        let state = run(createState('#Q=[](T)IO'), inputWindowActions.openInputWindow({ tab: 'state' }) as any);
        state = run(state, inputWindowActions.setInputChainCounters({ b2bChain: 3, renChain: 2 }) as any);

        const stats = computeInputStats(state.fumen.pages, 0, 'srsPlus');
        expect([stats.b2bChain, stats.renChain]).toEqual([3, 2]);
        expect(state.fumen.pages[0].comment.text).toBe('b2b=3 combo=2 | #Q=[](T)IO');
        expect(calls).toEqual(['registerHistoryTask', 'comment:b2b=3 combo=2 | #Q=[](T)IO', 'reopen']);

        calls.length = 0;
        expect(inputWindowActions.setInputChainCounters({ b2bChain: 3 })(state)).toBeUndefined();
        expect(calls).toEqual([]);
    });

    test('caps B2B at the rules of the selected rotation system', () => {
        const srs = { ...createState(), mode: { rotationSystem: 'srs' } } as unknown as State;
        const state = run(srs, inputWindowActions.setInputChainCounters({ b2bChain: 5 }) as any);

        expect(computeInputStats(state.fumen.pages, 0, 'srs').b2bChain).toBe(1);
    });
});

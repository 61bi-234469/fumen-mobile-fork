import { modeActions } from '../screen';
import { Field } from '../../lib/fumen/field';
import type { State } from '../../states';
import { createInputReplayContext } from '../../lib/input_replay';

jest.mock('../../actions', () => ({ actions: {}, main: {} }));
jest.mock('../../states', () => ({ resources: { konva: { stage: { isReady: false } } } }));

const createState = (): State => ({
    mode: { sevenBagGrayEnabled: false } as State['mode'],
    fumen: {
        pages: [{
            index: 0,
            field: { obj: new Field({}) },
            comment: { text: '#Q=[](T)IOLJSZ' },
            flags: { lock: true, mirror: false, colorize: true, rise: false, quiz: true },
            internal: {
                sevenBagGrayProgress: { bag: 3, pieces: 10, lines: 2, perfectClears: 1 },
                sevenBagGrayDisplay: { pieces: [1], rowMap: [0] },
                sevenBagGrayWorkspace: true,
            },
        }],
    } as State['fumen'],
} as State);

describe('changeSevenBagGrayEnabled', () => {
    test('preserves replay data while clearing seven-bag data without mutating the source', () => {
        const state = createState();
        const context = createInputReplayContext({
            resolvedOptions: {}, locks: [], terminal: { frame: 0 },
        } as any, 0, 0);
        state.fumen.pages[0].internal!.inputReplayContext = context;
        const next = modeActions.changeSevenBagGrayEnabled({ enable: true })(state) as State;

        expect(next.fumen.pages[0].internal).toEqual({ inputReplayContext: context });
        expect(state.fumen.pages[0].internal!.sevenBagGrayWorkspace).toBe(true);
    });

    test('drops stale working data when seven-bag gray is enabled without changing comments', () => {
        const next = modeActions.changeSevenBagGrayEnabled({ enable: true })(createState()) as State;
        const page = next.fumen.pages[0];

        expect(page.comment.text).toBe('#Q=[](T)IOLJSZ');
        expect(page.flags.quiz).toBe(true);
        expect(page.internal).toBeUndefined();
    });

    test('drops stale working data when seven-bag gray is disabled without changing comments', () => {
        const state = createState();
        state.mode.sevenBagGrayEnabled = true;
        const next = modeActions.changeSevenBagGrayEnabled({ enable: false })(state) as State;

        expect(next.fumen.pages[0].comment.text).toBe('#Q=[](T)IOLJSZ');
        expect(next.fumen.pages[0].flags.quiz).toBe(true);
        expect(next.fumen.pages[0].internal).toBeUndefined();
    });
});

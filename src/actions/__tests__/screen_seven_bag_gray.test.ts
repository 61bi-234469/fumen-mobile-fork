import { modeActions } from '../screen';
import { Field } from '../../lib/fumen/field';
import type { State } from '../../states';

jest.mock('../../actions', () => ({ actions: {}, main: {} }));
jest.mock('../../states', () => ({ resources: { konva: { stage: { isReady: false } } } }));

const createState = (): State => ({
    mode: { sevenBagGrayEnabled: true } as State['mode'],
    fumen: {
        pages: [{
            index: 0,
            field: { obj: new Field({}) },
            comment: {},
            flags: { lock: true, mirror: false, colorize: true, rise: false, quiz: false },
            internal: {
                hiddenComment: '#Q=[](T)IOLJSZ',
                sevenBagGrayProgress: { bag: 3, pieces: 10, lines: 2, perfectClears: 1 },
                sevenBagGrayDisplay: { pieces: [1], rowMap: [0] },
            },
        }],
    } as State['fumen'],
} as State);

describe('changeSevenBagGrayEnabled', () => {
    test('drops stale working data when seven-bag gray is disabled', () => {
        const next = modeActions.changeSevenBagGrayEnabled({ enable: false })(createState()) as State;
        const page = next.fumen.pages[0];

        expect(page.comment.text).toBe('#Q=[](T)IOLJSZ');
        expect(page.internal).toBeUndefined();
    });
});

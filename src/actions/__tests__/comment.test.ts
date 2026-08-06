import { commentActions } from '../comment';
import { actions } from '../../actions';
import { encode, decode } from '../../lib/fumen/fumen';
import { Field } from '../../lib/fumen/field';
import { resolvePageCommentText } from '../../lib/pages';

jest.mock('../../actions', () => ({
    actions: {
        registerHistoryTask: jest.fn(() => () => undefined),
        reopenCurrentPage: jest.fn(() => () => undefined),
    },
}));

jest.mock('../../states', () => ({ resources: {} }));

const createState = () => ({
    mode: { sevenBagGrayEnabled: true },
    fumen: {
        pages: [{
            index: 0,
            field: { obj: new Field({}) },
            comment: { text: '' },
            flags: { lock: true, mirror: false, colorize: true, rise: false, quiz: false },
        }],
    },
});

describe('comment actions with seven-bag gray enabled', () => {
    test('commits quiz comments through the normal serialized-comment path', async () => {
        const next = commentActions.setCommentText({ text: '#Q=[](T)IOLJSZ', pageIndex: 0 })(
            createState() as any,
        ) as any;

        expect(next.fumen.pages[0].comment).toEqual({ text: '#Q=[](T)IOLJSZ' });
        expect(next.fumen.pages[0].flags.quiz).toBe(true);
        expect(actions.registerHistoryTask).toHaveBeenCalled();

        const encoded = await encode(next.fumen.pages);
        const decoded = await decode(`v115@${encoded}`);
        expect(resolvePageCommentText(decoded, 0)).toBe('#Q=[](T)IOLJSZ');
    });
});

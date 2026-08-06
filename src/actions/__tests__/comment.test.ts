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

const createMultiPageState = () => ({
    mode: { sevenBagGrayEnabled: false },
    fumen: {
        currentIndex: 2,
        pages: [{
            index: 0,
            field: { obj: new Field({}) },
            comment: { text: 'first' },
            flags: { lock: true, mirror: false, colorize: true, rise: false, quiz: false },
        }, {
            index: 1,
            field: {},
            comment: { ref: 0 },
            flags: { lock: true, mirror: false, colorize: true, rise: false, quiz: false },
        }, {
            index: 2,
            field: {},
            comment: { text: '#Q=[](T)IOLJSZ' },
            flags: { lock: true, mirror: false, colorize: true, rise: false, quiz: true },
        }, {
            index: 3,
            field: {},
            comment: { ref: 2 },
            flags: { lock: true, mirror: false, colorize: true, rise: false, quiz: true },
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

describe('resetAllCommentTexts', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('empties every page comment and drops the quiz flags', () => {
        const next = commentActions.resetAllCommentTexts()(createMultiPageState() as any) as any;
        const pages = next.fumen.pages;

        expect(pages[0].comment).toEqual({ text: '' });
        expect(pages.slice(1).every((page: any) => page.comment.ref === 0)).toBe(true);
        expect(pages.every((page: any) => page.flags.quiz === false)).toBe(true);
        expect(pages.every((page: any, index: number) => resolvePageCommentText(pages, index) === '')).toBe(true);
        expect(actions.registerHistoryTask).toHaveBeenCalled();
    });

    test('registers no history task when every comment is already empty', () => {
        const next = commentActions.resetAllCommentTexts()(createState() as any) as any;

        expect(next.fumen).toBeUndefined();
        expect(actions.registerHistoryTask).not.toHaveBeenCalled();
    });
});

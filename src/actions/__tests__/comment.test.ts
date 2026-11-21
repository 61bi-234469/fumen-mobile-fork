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

describe('setCommentText and the following comments', () => {
    const flags = { lock: true, mirror: false, colorize: true, rise: false, quiz: false };
    const createPages = (comments: any[]) => comments.map((comment, index) => ({
        index,
        comment,
        field: index === 0 ? { obj: new Field({}) } : { ref: 0 },
        flags: { ...flags },
    }));
    const commitX = (comments: any[]) => {
        const state = { mode: {}, fumen: { currentIndex: 1, pages: createPages(comments) } };
        const next = commentActions.setCommentText({ text: 'X', pageIndex: 1 })(state as any) as any;
        return [0, 1, 2, 3].map(index => resolvePageCommentText(next.fumen.pages, index));
    };

    test('turns the next comment page into a ref when it repeats the committed text', () => {
        expect(commitX([{ text: 'A' }, { text: 'B' }, { ref: 1 }, { text: 'X' }])).toEqual(['A', 'X', 'X', 'X']);
    });

    test('leaves a later page alone when an earlier page has its own comment', () => {
        expect(commitX([{ text: 'A' }, { text: 'B' }, { text: 'C' }, { text: 'X' }])).toEqual(['A', 'X', 'C', 'X']);
        expect(commitX([{ text: 'A' }, { text: 'B' }, { text: '' }, { text: 'X' }])).toEqual(['A', 'X', '', 'X']);
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

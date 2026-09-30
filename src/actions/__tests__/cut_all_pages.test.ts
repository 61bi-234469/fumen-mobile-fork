import { Field } from '../../lib/fumen/field';
import { decode, encode } from '../../lib/fumen/fumen';
import { Page } from '../../lib/fumen/types';
import { createTreeFromPages, extractTreeFromPages } from '../../lib/fumen/tree_utils';
import { resources } from '../../states';

const loadNewFumen = jest.fn();
const finishCutAllPages = jest.fn();
const copyTextToClipboard = jest.fn();
const toast = jest.fn();

jest.mock('../../actions', () => ({
    actions: { commitCommentText: () => () => undefined },
    main: {
        loadNewFumen: (...args: unknown[]) => loadNewFumen(...args),
        finishCutAllPages: (...args: unknown[]) => finishCutAllPages(...args),
    },
}));

jest.mock('../../states', () => ({ resources: {} }));

jest.mock('../memento', () => ({
    mementoActions: {},
}));

jest.mock('../../lib/clipboard_copy', () => ({
    copyTextToClipboard: (...args: unknown[]) => copyTextToClipboard(...args),
}));

// tslint:disable-next-line:no-var-requires
const { pageActions } = require('../pages');

const flags = { lock: false, mirror: false, colorize: true, rise: false, quiz: false };

const createPages = (): Page[] => Array.from({ length: 3 }, (_, index) => ({
    index,
    field: index === 0 ? { obj: new Field({}) } : { ref: 0 },
    comment: index === 0 ? { text: 'hello' } : { ref: 0 },
    flags: { ...flags },
}));

const createState = (pages: Page[], tree?: ReturnType<typeof createTreeFromPages>) => ({
    fumen: { pages, currentIndex: 0 },
    history: { undoCount: 0, redoCount: 0 },
    tree: tree !== undefined
        ? { enabled: true, nodes: tree.nodes, rootId: tree.rootId }
        : { enabled: false, nodes: [], rootId: null },
}) as any;

const flushPromises = () => new Promise(resolve => setTimeout(resolve, 0));

describe('pageActions.finishCutAllPages', () => {
    beforeEach(() => {
        loadNewFumen.mockReset();
        toast.mockReset();
        resources.comment = undefined;
        (global as any).M = { toast };
    });

    afterAll(() => {
        resources.comment = undefined;
        delete (global as any).M;
    });

    const copiedOf = async (pages: Page[]) => `v115@${await encode(pages)}`;

    test('clears the fumen when nothing changed while the copy was pending', async () => {
        const pages = createPages();
        const copied = await copiedOf(pages);
        pageActions.finishCutAllPages({ copied, pageCount: 3 })(createState(pages));
        await flushPromises();

        expect(loadNewFumen).toHaveBeenCalledTimes(1);
    });

    test('keeps a comment edited in place while the copy was pending', async () => {
        const pages = createPages();
        const copied = await copiedOf(pages);
        // Comment commits rewrite the page inside the same array, so neither the array nor undoCount has to change.
        pages[0].comment = { text: 'edited' };
        pageActions.finishCutAllPages({ copied, pageCount: 3 })(createState(pages));
        await flushPromises();

        expect(loadNewFumen).not.toHaveBeenCalled();
    });

    test('keeps a comment that is still being typed', async () => {
        const pages = createPages();
        const copied = await copiedOf(pages);
        resources.comment = { pageIndex: 0, text: 'typing' };
        pageActions.finishCutAllPages({ copied, pageCount: 3 })(createState(pages));
        await flushPromises();

        expect(loadNewFumen).not.toHaveBeenCalled();
    });

    test('keeps a different fumen loaded while the copy was pending', async () => {
        const copied = await copiedOf(createPages());
        const otherPages = createPages().slice(0, 1);
        pageActions.finishCutAllPages({ copied, pageCount: 3 })(createState(otherPages));
        await flushPromises();

        expect(loadNewFumen).not.toHaveBeenCalled();
    });
});

describe('pageActions.cutAllPages', () => {
    beforeEach(() => {
        finishCutAllPages.mockReset();
        copyTextToClipboard.mockReset();
        copyTextToClipboard.mockResolvedValue(true);
        (global as any).M = { toast };
    });

    afterAll(() => {
        delete (global as any).M;
    });

    test('embeds the tree so the cut fumen can restore its branches', async () => {
        const pages = createPages();
        const tree = createTreeFromPages(pages);
        pageActions.cutAllPages()(createState(pages, tree));
        await flushPromises();

        expect(finishCutAllPages).toHaveBeenCalledTimes(1);
        const { copied, pageCount } = finishCutAllPages.mock.calls[0][0];
        expect(copyTextToClipboard).toHaveBeenCalledWith(copied);
        expect(pageCount).toBe(3);

        const restored = extractTreeFromPages(await decode(copied));
        expect(restored.tree).not.toBeNull();
        expect(restored.tree!.nodes).toHaveLength(tree.nodes.length);
        expect(restored.cleanedPages[0].comment.text).toBe('hello');
    });

    test('copies without tree data when tree mode is off', async () => {
        pageActions.cutAllPages()(createState(createPages()));
        await flushPromises();

        const { copied } = finishCutAllPages.mock.calls[0][0];
        const decoded = await decode(copied);
        expect(decoded[0].comment.text).toBe('hello');
    });
});

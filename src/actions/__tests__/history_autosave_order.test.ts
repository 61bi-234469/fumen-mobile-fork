import { Screens } from '../../lib/enums';
import { Field } from '../../lib/fumen/field';
import { Page } from '../../lib/fumen/types';

// registerHistoryTask autosaves from the state it receives (saveToMemento in ./memento),
// so the pages and tree in that state must already be the result of the operation.
jest.mock('../../actions', () => {
    const noop = () => () => undefined;
    return {
        actions: {
            registerHistoryTask: () => (state: unknown) => {
                (global as any).__historyStates.push(state);
                return undefined;
            },
            reopenCurrentPage: noop,
            openPage: noop,
            applyPageRotation: noop,
            cancelSpawnMinoPick: noop,
            commitCommentText: noop,
        },
        main: {},
    };
});

jest.mock('../../memento', () => ({
    memento: { register: jest.fn(() => 1), save: jest.fn(), setAutosaveSource: jest.fn() },
    localStorageWrapper: { saveViewSettings: jest.fn(), savePageIndex: jest.fn() },
}));

jest.mock('../../states', () => ({
    resources: { konva: { stage: { isReady: false } }, modals: {} },
}));

jest.mock('../../env', () => ({ PageEnv: { Version: 'test', Debug: false } }));

jest.mock('../cold_clear', () => ({
    getCurrentColdClearQueueComment: () => null,
    getColdClearQueueCommentAt: () => null,
}));

jest.mock('../../lib/toast', () => ({ showToast: jest.fn() }));

const historyStates: any[] = [];
(global as any).__historyStates = historyStates;

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { listViewActions } = require('../list_view');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { utilsActions } = require('../utils');

const flags = { lock: false, mirror: false, colorize: true, rise: false, quiz: false };
const keyPage = (index: number, text: string): Page => ({
    index, field: { obj: new Field({}) }, comment: { text }, flags: { ...flags },
});

const createState = (pages: Page[]) => ({
    fumen: { pages, currentIndex: 0, maxPage: pages.length, guideLineColor: true },
    mode: { screen: Screens.ListView, rotationSystem: 'srsPlus', sevenBagGrayEnabled: false },
    events: { inferences: [] },
    listView: { dragState: { draggingIndex: null, dropTargetIndex: null } },
    tree: { enabled: false, nodes: [], rootId: null, activeNodeId: null, viewMode: 0, grayAfterLineClear: false,
        operationScope: 'node', scale: 1 },
    history: { undoCount: 0, redoCount: 0 },
    cache: {},
}) as any;

const commentsOf = (pages: Page[]) => pages.map(page => page.comment.text);

beforeEach(() => {
    historyStates.length = 0;
});

describe('history registration comes after the new pages are applied', () => {
    test('List reorder', () => {
        const state = createState([keyPage(0, 'a'), keyPage(1, 'b'), keyPage(2, 'c')]);

        const next = listViewActions.reorderPage({ fromIndex: 0, toSlotIndex: 3 })(state) as any;

        expect(commentsOf(next.fumen.pages)).toEqual(['b', 'c', 'a']);
        expect(historyStates).toHaveLength(1);
        expect(historyStates[0].fumen.pages).toBe(next.fumen.pages);
    });

    test('appending pages from the clipboard to the end', () => {
        const state = createState([keyPage(0, 'a')]);

        const next = listViewActions.addPagesFromClipboard({ pages: [keyPage(0, 'x')] })(state) as any;

        expect(commentsOf(next.fumen.pages)).toEqual(['a', 'x']);
        expect(historyStates).toHaveLength(1);
        expect(historyStates[0].fumen.pages).toBe(next.fumen.pages);
    });

    test('appending from a URL with a tree view mode keeps the previous view mode in the history entry', () => {
        const state = createState([keyPage(0, 'a')]);

        const next = listViewActions.addPagesFromClipboard({
            pages: [keyPage(0, 'x')], treeViewModeParam: 1,
        })(state) as any;

        expect(next.tree.viewMode).toBe(1);
        expect(historyStates).toHaveLength(1);
        expect(historyStates[0].tree.viewMode).toBe(0);
        expect(historyStates[0].fumen.pages).toBe(next.fumen.pages);
    });

    test('inserting pages after the current page', () => {
        const state = createState([keyPage(0, 'a'), keyPage(1, 'b')]);

        const next = utilsActions.appendPages({ pages: [keyPage(0, 'x')], pageIndex: 1 })(state) as any;

        expect(commentsOf(next.fumen.pages)).toEqual(['a', 'x', 'b']);
        expect(historyStates).toHaveLength(1);
        expect(historyStates[0].fumen.pages).toBe(next.fumen.pages);
    });
});

/**
 * @jest-environment jsdom
 */
import { Field } from '../../lib/fumen/field';
import { encode } from '../../lib/fumen/fumen';
import { Screens } from '../../lib/enums';
import { flattenTreeToPageIndices } from '../../lib/fumen/tree_utils';

jest.mock('../../actions', () => {
    const noop = () => () => undefined;
    return {
        actions: {
            registerHistoryTask: ({ task }: any) => () => {
                (global as any).__tasks.push(task);
                return undefined;
            },
            reopenCurrentPage: noop,
            openPage: noop,
            applyPageRotation: noop,
            cancelSpawnMinoPick: noop,
            commitCommentText: noop,
            fixInferencePiece: noop,
            clearInferencePiece: noop,
            clearRectSelection: noop,
            setHistoryCount: noop,
            setComment: noop,
            setField: noop,
            setFieldColor: noop,
            setSentLine: noop,
            setHold: noop,
            setNext: noop,
            setPages: ({ pages }: any) => (state: any) => ({ fumen: { ...state.fumen, pages } }),
            // Like the real action, syncs the first page's colorize flag to the rotation system
            changeRotationSystem: ({ rotationSystem }: any) => (state: any) => ({
                fumen: {
                    ...state.fumen,
                    pages: state.fumen.pages.map((page: any, index: number) => index === 0
                        ? { ...page, flags: { ...page.flags, colorize: rotationSystem !== 'classic' } }
                        : page),
                },
            }),
        },
        main: {},
    };
});

jest.mock('../../memento', () => ({
    memento: {
        register: jest.fn((task: any) => {
            (global as any).__tasks.push(task);
            return 1;
        }),
        save: jest.fn(),
        setAutosaveSource: jest.fn(),
    },
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

jest.mock('../../lib/cold_clear/ColdClearWrapper', () => ({
    ColdClearWrapper: jest.fn().mockImplementation(() => ({})),
}));

const mockShowToast = jest.fn();
jest.mock('../../lib/toast', () => ({ showToast: (...args: any[]) => mockShowToast(...args) }));

(global as any).__tasks = [];

// tslint:disable-next-line:no-var-requires
const { utilsActions } = require('../utils');
// tslint:disable-next-line:no-var-requires
const { mementoActions } = require('../memento');
// tslint:disable-next-line:no-var-requires
const { treeOperationActions } = require('../tree_operations');
// tslint:disable-next-line:no-var-requires
const { pageActions } = require('../pages');
// tslint:disable-next-line:no-var-requires
const { listViewActions } = require('../list_view');

const flags = { lock: false, mirror: false, colorize: true, rise: false, quiz: false };
const keyPage = (index: number, text: string) => ({
    index,
    field: { obj: new Field({}) },
    comment: { text },
    flags: { ...flags },
});

// a -> (b, c): page 2 starts the second branch of page 0
const createState = (): any => ({
    fumen: { pages: [keyPage(0, 'a'), keyPage(1, 'b'), keyPage(2, 'c')], currentIndex: 2, maxPage: 3 },
    mode: { screen: Screens.Editor, rotationSystem: 'srs', sevenBagGrayEnabled: false },
    events: { inferences: [] },
    play: { status: 'pause' },
    cache: {},
    listView: { dragState: { draggingIndex: null, dropTargetIndex: null } },
    tree: {
        rootId: 'v',
        nodes: [
            { id: 'v', parentId: null, pageIndex: -1, childrenIds: ['a'] },
            { id: 'a', parentId: 'v', pageIndex: 0, childrenIds: ['b', 'c'] },
            { id: 'b', parentId: 'a', pageIndex: 1, childrenIds: [] },
            { id: 'c', parentId: 'a', pageIndex: 2, childrenIds: [] },
        ],
        enabled: true,
        activeNodeId: 'c',
        viewMode: 0,
        dragState: {},
        scale: 1,
        grayAfterLineClear: false,
        operationScope: 'node',
    },
});

const merge = (state: any, next: any) => ({ ...state, ...next });
const parentPageOf = (tree: any, pageIndex: number) => {
    const node = tree.nodes.find((n: any) => n.pageIndex === pageIndex);
    return tree.nodes.find((n: any) => n.id === node.parentId)?.pageIndex;
};
const lastTask = () => (global as any).__tasks[(global as any).__tasks.length - 1];
const restore = (state: any, result: any) => merge(
    state,
    mementoActions.loadPagesViaHistory({ ...result, undoCount: 0, redoCount: 0 })(state),
);

beforeEach(() => {
    (global as any).__tasks = [];
    mockShowToast.mockClear();
});

describe('undo and redo restore the tree with the pages', () => {
    test('appending pages in Tree mode', () => {
        const appended = merge(createState(), utilsActions.appendPages({
            pages: [keyPage(0, 'x')], pageIndex: 3,
        })(createState()));
        const task = lastTask();

        const undone = restore(appended, task.revert(appended.fumen.pages));
        expect(undone.fumen.pages).toHaveLength(3);
        expect(parentPageOf(undone.tree, 1)).toBe(0);
        expect(parentPageOf(undone.tree, 2)).toBe(0);

        const redone = restore(undone, task.replay(undone.fumen.pages));
        expect(redone.fumen.pages).toHaveLength(4);
        expect(flattenTreeToPageIndices(redone.tree)).toEqual([0, 1, 2, 3]);
    });

    test('adding pages that turn Tree mode on', () => {
        const state = createState();
        state.tree = { ...state.tree, enabled: false, rootId: null, nodes: [], activeNodeId: null };

        const added = merge(state, listViewActions.addPagesFromClipboard({
            pages: [keyPage(0, 'x')], treeEnabledParam: true,
        })(state));
        expect(added.tree.enabled).toBe(true);
        const task = lastTask();

        const undone = restore(added, task.revert(added.fumen.pages));
        expect(undone.fumen.pages).toHaveLength(3);
        expect(undone.tree.enabled).toBe(false);

        const redone = restore(undone, task.replay(undone.fumen.pages));
        expect(redone.fumen.pages).toHaveLength(4);
        expect(redone.tree.enabled).toBe(true);
        expect(flattenTreeToPageIndices(redone.tree)).toEqual([0, 1, 2, 3]);
    });

    test('turning Tree mode off', () => {
        const disabled = merge(createState(), treeOperationActions.toggleTreeMode()(createState()));
        const task = lastTask();

        const undone = restore(disabled, task.revert(disabled.fumen.pages));
        expect(undone.tree.enabled).toBe(true);
        expect(undone.tree.nodes).toHaveLength(4);

        const redone = restore(undone, task.replay(undone.fumen.pages));
        expect(redone.tree.enabled).toBe(false);
        expect(redone.tree.nodes).toHaveLength(0);
    });
});

describe('undo and redo of loading a fumen restore Tree mode on both sides', () => {
    const loadFrom = async (state: any, treeEnabledParam?: boolean) => {
        const pages = [keyPage(0, 'n0'), keyPage(1, 'n1')];
        const loadedFumen = `v115@${await encode(pages)}`;
        const loaded = merge(state, utilsActions.loadPages({ pages, loadedFumen, treeEnabledParam })(state));
        return { loaded, task: lastTask() };
    };

    test('a fumen without a tree loaded while Tree mode was on', async () => {
        const { loaded, task } = await loadFrom(createState());
        expect(loaded.tree.enabled).toBe(false);

        const undone = restore(loaded, await task.revert());
        expect(undone.tree.enabled).toBe(true);
        expect(undone.tree.nodes).toHaveLength(4);

        const redone = restore(undone, await task.replay());
        expect(redone.fumen.pages).toHaveLength(2);
        expect(redone.tree.enabled).toBe(false);
    });

    test('a fumen loaded with Tree mode turned on by a parameter', async () => {
        const state = createState();
        state.tree = { ...state.tree, enabled: false, rootId: null, nodes: [], activeNodeId: null };
        const { loaded, task } = await loadFrom(state, true);
        expect(loaded.tree.enabled).toBe(true);

        const undone = restore(loaded, await task.revert());
        expect(undone.tree.enabled).toBe(false);

        const redone = restore(undone, await task.replay());
        expect(redone.tree.enabled).toBe(true);
        expect(flattenTreeToPageIndices(redone.tree)).toEqual([0, 1]);
    });

    test('redo restores the pages as the load left them, not the decoded fumen', async () => {
        const state = createState();
        state.mode = { ...state.mode, rotationSystem: 'classic' };
        const { task } = await loadFrom(state);

        const replayed = await task.replay();
        expect(replayed.pages[0].flags.colorize).toBe(false);
    });
});

describe('changeToRef in Tree mode', () => {
    test('keeps a page that starts a branch as a Key page', () => {
        const state = createState();

        const next = pageActions.changeToRef({ index: 2 })(state);

        expect(next).toBeUndefined();
        expect(state.fumen.pages[2].field.obj).toBeDefined();
        expect(mockShowToast).toHaveBeenCalledTimes(1);
    });

    test('converts a page whose parent is the previous page', () => {
        const state = createState();

        const next = merge(state, pageActions.changeToRef({ index: 1 })(state));

        expect(next.fumen.pages[1].field).toEqual({ ref: 0 });
        expect(mockShowToast).not.toHaveBeenCalled();
    });
});

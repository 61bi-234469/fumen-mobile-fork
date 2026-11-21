/**
 * @jest-environment jsdom
 */
import { Field } from '../../lib/fumen/field';
import { Screens } from '../../lib/enums';

// Records which page index each cleanup ran on, and each reopen, in call order
jest.mock('../../actions', () => {
    const record = (name: string) => () => (state: any) => {
        (global as any).__calls.push(`${name}@${state.fumen.currentIndex}`);
        return undefined;
    };
    const noop = () => () => undefined;
    return {
        actions: {
            fixInferencePiece: record('fixInferencePiece'),
            clearInferencePiece: record('clearInferencePiece'),
            clearRectSelection: record('clearRectSelection'),
            commitCommentText: record('commitCommentText'),
            cancelSpawnMinoPick: record('cancelSpawnMinoPick'),
            reopenCurrentPage: record('reopenCurrentPage'),
            openPage: ({ index }: { index: number }) => (state: any) => {
                (global as any).__calls.push(`openPage(${index})@${state.fumen.currentIndex}`);
                return undefined;
            },
            registerHistoryTask: () => () => {
                (global as any).__order.push('registerHistoryTask');
                return undefined;
            },
            applyPageRotation: noop,
            setListViewSettingsOpened: noop,
            changeRotationSystem: () => () => {
                (global as any).__order.push('changeRotationSystem');
                return undefined;
            },
            setPages: ({ pages }: any) => (state: any) => ({ fumen: { ...state.fumen, pages } }),
        },
        main: { changeScreen: jest.fn() },
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

jest.mock('../../lib/cold_clear/ColdClearWrapper', () => ({
    ColdClearWrapper: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('../../lib/toast', () => ({ showToast: jest.fn() }));

(global as any).__calls = [];
(global as any).__order = [];

// tslint:disable-next-line:no-var-requires
const { utilsActions } = require('../utils');
// tslint:disable-next-line:no-var-requires
const { listViewActions } = require('../list_view');
// tslint:disable-next-line:no-var-requires
const { treeOperationActions } = require('../tree_operations');

const flags = { lock: false, mirror: false, colorize: true, rise: false, quiz: false };
const keyPage = (index: number, text: string) => ({
    index,
    field: { obj: new Field({}) },
    comment: { text },
    flags: { ...flags },
});

const createState = (overrides: any = {}): any => ({
    fumen: { pages: [keyPage(0, 'a'), keyPage(1, 'b'), keyPage(2, 'c')], currentIndex: 1, maxPage: 3 },
    mode: { screen: overrides.screen ?? Screens.Editor, rotationSystem: 'srs', sevenBagGrayEnabled: false },
    events: { inferences: [] },
    listView: { dragState: { draggingIndex: null, dropTargetIndex: null } },
    rectSelect: { status: 'none' },
    tree: {
        rootId: overrides.treeEnabled ? 'v' : null,
        nodes: overrides.treeEnabled ? [
            { id: 'v', parentId: null, pageIndex: -1, childrenIds: ['a'] },
            { id: 'a', parentId: 'v', pageIndex: 0, childrenIds: ['b'] },
            { id: 'b', parentId: 'a', pageIndex: 1, childrenIds: ['c'] },
            { id: 'c', parentId: 'b', pageIndex: 2, childrenIds: [] },
        ] : [],
        enabled: overrides.treeEnabled ?? false,
        activeNodeId: overrides.treeEnabled ? 'b' : null,
        viewMode: 0,
        dragState: {},
        scale: 1,
        grayAfterLineClear: false,
        operationScope: 'node',
    },
});

const leftPage = (index: number) => [
    `fixInferencePiece@${index}`,
    `clearInferencePiece@${index}`,
    `clearRectSelection@${index}`,
    `commitCommentText@${index}`,
    `cancelSpawnMinoPick@${index}`,
];
const calls = () => (global as any).__calls as string[];

beforeEach(() => {
    (global as any).__calls = [];
    (global as any).__order = [];
});

describe('operations that move currentIndex themselves leave the current page first', () => {
    test('List reorder opens the moved page afterwards', () => {
        listViewActions.reorderPage({ fromIndex: 1, toSlotIndex: 3 })(createState());

        expect(calls()).toEqual([...leftPage(1), 'reopenCurrentPage@2']);
    });

    test('inserting pages from the clipboard or Append', () => {
        utilsActions.appendPages({ pages: [keyPage(0, 'x')], pageIndex: 2 })(createState());

        expect(calls()).toEqual([...leftPage(1), 'reopenCurrentPage@2']);
    });

    test('adding pages to the end from the List menu', () => {
        listViewActions.addPagesFromClipboard({ pages: [keyPage(0, 'x')] })(createState());

        expect(calls()).toEqual([...leftPage(1), 'reopenCurrentPage@3']);
    });

    test('selecting another List card', () => {
        const state = createState({ screen: Screens.ListView });

        const next = listViewActions.activatePageInListView({ pageIndex: 2 })(state);

        expect(calls()).toEqual(leftPage(1));
        expect(next.fumen.currentIndex).toBe(2);
    });

    test('opening a card from the List opens it through openPage', () => {
        listViewActions.navigateToPageFromListView({ pageIndex: 2 })(createState({ screen: Screens.ListView }));

        expect(calls()).toEqual(['openPage(2)@1']);
    });

    test('starting a drag on the full-screen Tree', () => {
        const state = createState({ screen: Screens.ListView, treeEnabled: true });

        const next = treeOperationActions.startTreeDrag({ sourceNodeId: 'c' })(state);

        expect(calls()).toEqual(leftPage(1));
        expect(next.fumen.currentIndex).toBe(2);
    });
});

test('loading another fumen drops the old page-local state', () => {
    utilsActions.loadPages({ pages: [keyPage(0, 'n')], loadedFumen: 'v115@vhAAgH' })(createState());

    expect(calls().slice(0, 3)).toEqual(['clearInferencePiece@1', 'clearRectSelection@1', 'cancelSpawnMinoPick@1']);
    // The colorize sync must reach the autosave that registering schedules
    expect((global as any).__order).toEqual(['changeRotationSystem', 'registerHistoryTask']);
});

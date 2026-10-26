/**
 * @jest-environment jsdom
 */
import { Piece, Rotation, Screens } from '../../lib/enums';
import { Field } from '../../lib/fumen/field';
import { decode, encode } from '../../lib/fumen/fumen';
import { Page } from '../../lib/fumen/types';
import { createDefaultInputReplayContext, withInputGarbageSegments } from '../../lib/input_replay';
import {
    extractInputSnapshotsFromPages, findInputSnapshotTokens, parseInputSnapshotToken, serializeInputSnapshot,
} from '../../lib/input_snapshot';
import { createTreeFromPages, extractTreeFromPages } from '../../lib/fumen/tree_utils';
import { resolvePageCommentText } from '../../lib/pages';

// jest.mock factories cannot close over module variables, so the recorder is shared through global.
const calls: { [name: string]: any[] } = {};

jest.mock('../../actions', () => {
    const names = [
        'setPages', 'registerHistoryTask', 'changeRotationSystem', 'openPage', 'selectPieceLayout',
        'reopenCurrentPage', 'applyPageRotation', 'cancelSpawnMinoPick', 'setHistoryCount', 'commitCommentText',
    ];
    const actions: { [name: string]: any } = {};
    for (const name of names) {
        actions[name] = (data?: any) => () => {
            const store = (global as any).__inputSnapshotCalls as { [name: string]: any[] };
            (store[name] = store[name] ?? []).push(data);
            return undefined;
        };
    }
    return { actions, main: { openReceivedInputSnapshot: jest.fn() } };
});

jest.mock('../../memento', () => ({
    memento: {
        register: jest.fn(() => 1),
        save: jest.fn(),
        setAutosaveSource: jest.fn(),
    },
    localStorageWrapper: {
        saveViewSettings: jest.fn(),
        savePageIndex: jest.fn(),
    },
}));

jest.mock('../../states', () => ({
    resources: { konva: { stage: { isReady: false } }, modals: {} },
}));

jest.mock('../../env', () => ({ PageEnv: { Version: 'test', Debug: false } }));

jest.mock('../cold_clear', () => ({
    getCurrentColdClearQueueComment: () => null,
    getColdClearQueueCommentAt: () => null,
}));

const toastMock = jest.fn();
jest.mock('../../lib/toast', () => ({ showToast: (...args: any[]) => toastMock(...args) }));

const copyMock = jest.fn(async (_: string) => true);
jest.mock('../../lib/clipboard_copy', () => ({ copyTextToClipboard: (text: string) => copyMock(text) }));

(global as any).__inputSnapshotCalls = calls;

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { utilsActions } = require('../utils');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { mementoActions, toPagesForStorage } = require('../memento');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { pageActions } = require('../pages');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { main } = require('../../actions');

const flags = { lock: true, mirror: false, colorize: true, rise: false, quiz: false };
const page = (overrides: Partial<Page> = {}): Page => ({
    index: 0, field: { obj: new Field({}) }, comment: { text: '' }, flags: { ...flags }, ...overrides,
});

const context = () => withInputGarbageSegments(
    createDefaultInputReplayContext({ b2bChain: 3, renChain: 2, pieces: 5, lines: 4, perfectClears: 0 }, 42),
    [{ amount: 3, column: 6 }],
);

const createState = (pages: Page[], overrides: any = {}) => ({
    fumen: { pages, currentIndex: 0, maxPage: pages.length, guideLineColor: true },
    mode: { screen: Screens.Reader, rotationSystem: 'srsPlus', sevenBagGrayEnabled: false, initialScreen: 'reader',
        openTreeScreenOnTreeData: true },
    events: {
        inferences: [],
        lastInputPlacement: { clearedLines: 1, spin: 'none', perfectClear: false },
        lastPieceManipulation: { direction: 'cw', kickIndex: 4 },
    },
    editorUi: { primaryTool: 'piece', pieceLayout: 'play' },
    tree: { enabled: false, nodes: [], rootId: null, activeNodeId: null, viewMode: 0, grayAfterLineClear: false,
        operationScope: 'node', scale: 1 },
    history: { undoCount: 0, redoCount: 0 },
    cache: {},
    ...overrides,
}) as any;

const tokenPage = (openInput: boolean): Page => page({
    comment: { text: `${serializeInputSnapshot(context(), { openInput, rotationSystem: 'srs' })} | #Q=[](T)IO` },
});

beforeEach(() => {
    for (const key of Object.keys(calls)) delete calls[key];
    toastMock.mockClear();
    copyMock.mockClear();
    (main.openReceivedInputSnapshot as jest.Mock).mockClear();
    jest.useFakeTimers();
});

afterEach(() => {
    jest.useRealTimers();
});

describe('loadPages with INPUT state tokens', () => {
    test('restores the context, removes the token and opens a dedicated URL in INPUT', () => {
        const state = createState([page()]);
        const next = utilsActions.loadPages({ pages: [tokenPage(true)], loadedFumen: 'v115@x' })(state);

        const [{ pages, open }] = calls.setPages;
        expect(pages[0].comment.text).toBe('#Q=[](T)IO');
        expect(pages[0].flags.quiz).toBe(true);
        expect(pages[0].internal.inputReplayContext.garbage.columns).toBeDefined();
        expect(open).toBe(false);
        expect(next.mode.screen).toBe(Screens.Editor);
        expect(next.events.lastInputPlacement).toBeUndefined();
        expect(next.events.lastPieceManipulation).toBeUndefined();

        jest.runAllTimers();
        expect(main.openReceivedInputSnapshot).toHaveBeenCalledWith(expect.objectContaining({ index: 0 }));
    });

    test('restores an autosaved context without switching the screen', () => {
        const state = createState([page()]);
        const next = utilsActions.loadPages({ pages: [tokenPage(false)], loadedFumen: 'v115@x' })(state);
        expect(calls.setPages[0].open).toBe(true);
        expect(calls.setPages[0].pages[0].internal.inputReplayContext).toBeDefined();
        expect(next.mode?.screen).not.toBe(Screens.Editor);
        jest.runAllTimers();
        expect(main.openReceivedInputSnapshot).not.toHaveBeenCalled();
    });

    test('leaves a fumen without tokens as it was', () => {
        const input = [page({ comment: { text: 'hello' } })];
        utilsActions.loadPages({ pages: input, loadedFumen: 'v115@x' })(createState([page()]));
        expect(calls.setPages[0].pages[0]).toBe(input[0]);
        expect(calls.setPages[0].open).toBe(true);
    });

    test('opens the received page in the INPUT layout and reports a different rotation system', () => {
        const snapshot = (parseInputSnapshotToken(findInputSnapshotTokens(tokenPage(true).comment.text!)[0]) as any)
            .snapshot;
        utilsActions.openReceivedInputSnapshot({ snapshot, index: 0 })(createState([page()]));
        expect(calls.openPage).toEqual([{ index: 0 }]);
        expect(calls.selectPieceLayout).toEqual([{ layout: 'play' }]);
        expect(toastMock).toHaveBeenCalledTimes(1);
    });
});

describe('other receiving paths', () => {
    test('Insert restores the context and keeps the screen', () => {
        const state = createState([page(), page({ index: 1, field: { ref: 0 }, comment: { ref: 0 } })]);
        const next = utilsActions.appendPages({ pages: [tokenPage(true)], pageIndex: 1 })(state);
        expect(next.fumen.pages[1].internal.inputReplayContext).toBeDefined();
        expect(next.fumen.pages[1].comment.text).toBe('#Q=[](T)IO');
        expect(next.mode).toBeUndefined();
    });

    test('Redo of a whole load reads the tokens of the decoded fumen', () => {
        const state = createState([page()]);
        mementoActions.loadPagesViaHistory({ pages: [tokenPage(true)], index: 0, undoCount: 1, redoCount: 0 })(state);
        const [{ pages }] = calls.setPages;
        expect(pages[0].internal.inputReplayContext).toBeDefined();
        expect(pages[0].comment.text).not.toContain('isnap=');
    });
});

describe('autosave and share URL', () => {
    test('autosave embeds each page context and generic pages stay untouched', () => {
        const plain = page({ comment: { text: 'plain' } });
        const withContext = page({ index: 1, field: { ref: 0 }, comment: { ref: 0 },
            internal: { inputReplayContext: context() } });
        const stored = toPagesForStorage(createState([plain, withContext]));
        expect(stored[0]).toBe(plain);
        expect(findInputSnapshotTokens(stored[1].comment.text)).toHaveLength(1);
        expect(stored[1].comment.text.endsWith('| plain')).toBe(true);
        expect(withContext.comment).toEqual({ ref: 0 });
    });

    test('autosave with a tree keeps quiz progress and leaves #TREE= only on the first page', async () => {
        jest.useRealTimers();
        const quiz = { ...flags, quiz: true };
        const pages: Page[] = [
            page({ comment: { text: '#Q=[](T)IOLJ' }, flags: { ...quiz },
                piece: { type: Piece.T, rotation: Rotation.Spawn, coordinate: { x: 1, y: 0 } } }),
            page({ index: 1, field: { ref: 0 }, comment: { ref: 0 }, flags: { ...quiz },
                piece: { type: Piece.I, rotation: Rotation.Spawn, coordinate: { x: 5, y: 0 } },
                internal: { inputReplayContext: context() } }),
            page({ index: 2, field: { ref: 0 }, comment: { ref: 0 }, flags: { ...quiz } }),
        ];
        const tree = createTreeFromPages(pages);
        const state = createState(pages, {
            tree: { ...createState(pages).tree, enabled: true, nodes: tree.nodes, rootId: tree.rootId },
        });
        const decoded = await decode(`v115@${await encode(toPagesForStorage(state))}`);
        const { cleanedPages, tree: restoredTree } = extractTreeFromPages(decoded);
        const restored = extractInputSnapshotsFromPages(cleanedPages).pages;
        expect(restoredTree).not.toBeNull();
        pages.forEach((_, index) => {
            expect(resolvePageCommentText(restored, index)).toBe(resolvePageCommentText(pages, index));
            expect(restored[index].flags.quiz).toBe(true);
            expect(resolvePageCommentText(restored, index)).not.toContain('#TREE=');
        });
        expect(restored[1].internal?.inputReplayContext).toBeDefined();
    });

    test('copies a single-page URL that opens INPUT with the current counters', async () => {
        jest.useRealTimers();
        const current = page({
            index: 1,
            field: { ref: 0 },
            comment: { text: 'inputRotation=cw b2b=1 | #Q=[](T)IO' },
            piece: { type: Piece.T, rotation: Rotation.Right, coordinate: { x: 7, y: 2 } },
            internal: { inputReplayContext: context() },
        });
        const state = createState([page(), current], {
            fumen: { pages: [page(), current], currentIndex: 1, maxPage: 2, guideLineColor: true },
        });
        pageActions.copyInputShareUrlToClipboard()(state);
        await new Promise(resolve => setTimeout(resolve, 50));

        expect(copyMock).toHaveBeenCalledTimes(1);
        const url = new URL(copyMock.mock.calls[0][0]);
        const fumen = new URLSearchParams(url.hash.slice(2)).get('d')!;
        const [shared] = await decode(fumen);
        expect(shared.comment.text).not.toContain('inputRotation=');
        expect(shared.piece).toEqual({ type: Piece.T, rotation: Rotation.Spawn, coordinate: { x: 4, y: 20 } });
        const parsed = parseInputSnapshotToken(findInputSnapshotTokens(shared.comment.text!)[0]) as any;
        expect(parsed.snapshot.openInput).toBe(true);
        expect(parsed.snapshot.context.stats.b2bChain).toBe(3);
        expect(shared.comment.text).toContain('b2b=3 combo=2');
    });

    test('the generic page copy never carries the token', async () => {
        jest.useRealTimers();
        const state = createState([
            page({ comment: { text: '#Q=[](T)IO' }, internal: { inputReplayContext: context() } }),
        ]);
        pageActions.copyCurrentPageToClipboard()(state);
        await new Promise(resolve => setTimeout(resolve, 50));
        const [copied] = await decode(copyMock.mock.calls[0][0]);
        expect(copied.comment.text).toBe('#Q=[](T)IO');
    });
});

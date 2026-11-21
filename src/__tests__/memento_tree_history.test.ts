/** @jest-environment jsdom */

import { OperationTask } from '../history_task';
import { Page } from '../lib/fumen/types';
import { Field } from '../lib/fumen/field';

// updatePageComment registers through this stand-in for mementoActions.registerHistoryTask
jest.mock('../actions', () => ({
    actions: {
        registerHistoryTask: ({ task, mergeKey }: any) => () => {
            (global as any).__memento.register(task, mergeKey);
            return undefined;
        },
    },
    main: {},
}));
jest.mock('../states', () => ({ resources: { konva: { stage: { isReady: false } }, modals: {} } }));
jest.mock('../env', () => ({ PageEnv: { Version: 'test', Debug: false } }));

// memento is a module singleton, so each test loads a fresh one
const loadMemento = () => {
    jest.resetModules();
    // tslint:disable-next-line:no-var-requires
    return require('../memento').memento as typeof import('../memento').memento;
};

const createTask = (key: string, results: { replay?: boolean, revert?: boolean } = {}): OperationTask => ({
    key,
    replay: (pages: Page[]) => ({ pages, index: 0, treeDisabled: results.replay }),
    revert: (pages: Page[]) => ({ pages, index: 0, treeDisabled: results.revert }),
    fixed: false,
});

describe('multi-step undo and redo keep a Tree mode change made by an earlier step', () => {
    // [0]base [1]spawn A [2]turn Tree mode off [3]move [4]spawn B
    const register = (memento: ReturnType<typeof loadMemento>) => {
        memento.register(createTask('base'));
        memento.register(createTask('spawnA'), undefined, undefined, true);
        memento.register(createTask('treeOff', { replay: true, revert: false }));
        memento.register(createTask('move'));
        memento.register(createTask('spawnB'), undefined, undefined, true);
    };

    test('redo to the next spawn turns Tree mode off', async () => {
        const memento = loadMemento();
        register(memento);

        const undone = await memento.undoToPieceSpawn([], { currentPieceSpawned: true });
        expect(undone!.treeDisabled).toBe(false);

        const redone = await memento.redoToPieceSpawn([]);
        expect(redone!.undoCount).toBe(4);
        expect(redone!.treeDisabled).toBe(true);
    });
});

describe('multi-step undo keeps the tree that an earlier step restored', () => {
    const page = (text: string): Page => ({
        index: 0,
        field: { obj: new Field({}) },
        comment: { text },
        flags: { lock: true, mirror: false, colorize: true, rise: false, quiz: false },
    });
    const tree = {
        rootId: 'v',
        version: 1 as const,
        nodes: [
            { id: 'v', parentId: null, pageIndex: -1, childrenIds: ['a'] },
            { id: 'a', parentId: 'v', pageIndex: 0, childrenIds: [] },
        ],
    };

    test('a page-only step after undoing Tree mode off does not drop the tree', async () => {
        // tslint:disable-next-line:no-var-requires
        const { embedTreeInPages, extractTreeFromPages } = require('../lib/fumen/tree_utils');
        const memento = loadMemento();
        // [0]base [1]spawn A [2]move (rewrites the first page) [3]turn Tree mode off [4]spawn B
        memento.register(createTask('base'));
        memento.register(createTask('spawnA'), undefined, undefined, true);
        memento.register({
            key: 'move',
            fixed: false,
            replay: (pages: Page[]) => ({ pages: [page('moved')], index: 0 }),
            revert: (pages: Page[]) => ({ pages: [page('')], index: 0 }),
        });
        memento.register({
            key: 'treeOff',
            fixed: false,
            replay: (pages: Page[]) => ({ pages: [page('moved')], index: 0, treeDisabled: true }),
            revert: (pages: Page[]) => ({
                pages: embedTreeInPages([page('moved')], tree, true), index: 0, treeDisabled: false,
            }),
        });
        memento.register(createTask('spawnB'), undefined, undefined, true);

        const undone = await memento.undoToPieceSpawn([page('moved')], { currentPieceSpawned: true });

        expect(undone!.treeDisabled).toBe(false);
        const restored = extractTreeFromPages(undone!.pages);
        expect(restored.tree?.nodes).toHaveLength(2);
        expect(restored.cleanedPages[0].comment.text).toBe('');
    });
});

describe('multi-step undo rebuilds a carried tree that no longer fits the pages', () => {
    test('a page removed by an earlier operation', async () => {
        // tslint:disable-next-line:no-var-requires
        const { embedTreeInPages, extractTreeFromPages } = require('../lib/fumen/tree_utils');
        const page = (index: number): Page => ({
            index,
            field: index === 0 ? { obj: new Field({}) } : { ref: 0 },
            comment: index === 0 ? { text: '' } : { ref: 0 },
            flags: { lock: true, mirror: false, colorize: true, rise: false, quiz: false },
        });
        const twoPageTree = {
            rootId: 'v',
            version: 1 as const,
            nodes: [
                { id: 'v', parentId: null, pageIndex: -1, childrenIds: ['a'] },
                { id: 'a', parentId: 'v', pageIndex: 0, childrenIds: ['b'] },
                { id: 'b', parentId: 'a', pageIndex: 1, childrenIds: [] },
            ],
        };
        const memento = loadMemento();
        // [0]base [1]spawn A [2]duplicate (page-only) [3]turn Tree mode off [4]spawn B
        memento.register(createTask('base'));
        memento.register(createTask('spawnA'), undefined, undefined, true);
        memento.register({
            key: 'duplicate',
            fixed: false,
            replay: () => ({ pages: [page(0), page(1)], index: 1 }),
            revert: () => ({ pages: [page(0)], index: 0 }),
        });
        memento.register({
            key: 'treeOff',
            fixed: false,
            replay: () => ({ pages: [page(0), page(1)], index: 1, treeDisabled: true }),
            revert: () => ({
                pages: embedTreeInPages([page(0), page(1)], twoPageTree, true), index: 1, treeDisabled: false,
            }),
        });
        memento.register(createTask('spawnB'), undefined, undefined, true);

        const undone = await memento.undoToPieceSpawn([page(0), page(1)], { currentPieceSpawned: true });

        const restored = extractTreeFromPages(undone!.pages);
        expect(undone!.pages).toHaveLength(1);
        expect(restored.tree.nodes.filter((node: any) => node.pageIndex >= 0).map((node: any) => node.pageIndex))
            .toEqual([0]);
    });
});

describe('List card comment edits', () => {
    const pageWithComment = (index: number, text: string): Page => ({
        index,
        field: index === 0 ? { obj: new Field({}) } : { ref: 0 },
        comment: { text },
        flags: { lock: true, mirror: false, colorize: true, rise: false, quiz: false },
    });

    test('merge per card while typing and stay apart across cards', async () => {
        const memento = loadMemento();
        (global as any).__memento = memento;
        // tslint:disable-next-line:no-var-requires
        const { listViewActions } = require('../actions/list_view');
        const state: any = { fumen: { pages: [pageWithComment(0, ''), pageWithComment(1, '')], currentIndex: 0 } };
        const pages = state.fumen.pages;
        memento.register(createTask('base'));

        const typeOn = (pageIndex: number, comment: string) => {
            listViewActions.updatePageComment({ pageIndex, comment })(state);
        };
        typeOn(0, 'a');
        typeOn(0, 'ab');
        typeOn(1, 'x');
        typeOn(0, 'abc');

        const comments = () => pages.map((page: Page) => page.comment.text);
        await memento.undo(pages);
        expect(comments()).toEqual(['ab', 'x']);
        await memento.undo(pages);
        expect(comments()).toEqual(['ab', '']);
        await memento.undo(pages);
        expect(comments()).toEqual(['', '']);

        await memento.redo(pages);
        expect(comments()).toEqual(['ab', '']);
        await memento.redo(pages);
        await memento.redo(pages);
        expect(comments()).toEqual(['abc', 'x']);
    });
});

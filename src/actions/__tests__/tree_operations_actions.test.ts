import { Field } from '../../lib/fumen/field';
import { decode, encode } from '../../lib/fumen/fumen';
import { Page } from '../../lib/fumen/types';
import { Piece } from '../../lib/enums';
import { createSpawnMove } from '../../lib/piece';
import { PageFieldOperation, Pages, resolvePageCommentText } from '../../lib/pages';
import {
    AddMode,
    SerializedTree,
    TreeOperationScope,
    TreeViewMode,
    initialTreeDragState,
} from '../../lib/fumen/tree_types';
import { addBranchNode, createTreeFromPages, findNode, findNodeByPageIndex } from '../../lib/fumen/tree_utils';
import { toPrimitivePage } from '../../history_task';

jest.mock('../../actions', () => ({
    actions: {
        commitRectSelection: jest.fn(() => () => undefined),
        removeUnsettledItems: jest.fn(() => () => undefined),
        commitCommentText: jest.fn(() => () => undefined),
        reopenCurrentPage: jest.fn(() => () => undefined),
        registerHistoryTask: jest.fn(() => () => undefined),
    },
    main: {},
}));

jest.mock('../../memento', () => ({
    localStorageWrapper: {
        saveViewSettings: jest.fn(),
    },
}));

jest.mock('../../states', () => ({
    resources: {
        konva: {
            stage: {
                isReady: false,
            },
        },
        modals: {},
    },
}));

jest.mock('../../env', () => ({
    PageEnv: {
        Version: 'test',
        Debug: false,
    },
}));

jest.mock('../memento', () => ({
    mementoActions: {
        registerHistoryTask: jest.fn(() => () => undefined),
    },
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { removePagesByIndices, treeOperationActions } = require('../tree_operations');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const mockedActions = require('../../actions').actions;

const defaultFlags = {
    lock: false,
    mirror: false,
    colorize: true,
    rise: false,
    quiz: false,
};

const createChainPages = (): Page[] => [
    {
        index: 0,
        field: { obj: new Field({}) },
        comment: { text: 'a' },
        flags: { ...defaultFlags },
    },
    {
        index: 1,
        field: { ref: 0 },
        comment: { ref: 0 },
        flags: { ...defaultFlags },
    },
];

const createBaseState = () => {
    const pages = createChainPages();
    const tree = createTreeFromPages(pages);
    const p1Node = findNodeByPageIndex(tree, 1);

    return {
        fumen: {
            pages,
            currentIndex: 1,
            maxPage: pages.length,
            guideLineColor: true,
        },
        tree: {
            enabled: true,
            nodes: tree.nodes,
            rootId: tree.rootId,
            activeNodeId: p1Node!.id,
            addMode: AddMode.Branch,
            viewMode: TreeViewMode.Tree,
            dragState: initialTreeDragState,
            operationScope: 'node',
            grayAfterLineClear: false,
            scale: 1.0,
            autoFocusPending: false,
        },
    } as any;
};

const createQuizState = () => {
    const pages: Page[] = [
        {
            index: 0,
            field: { obj: new Field({}) },
            comment: { text: '#Q=[](I)OT' },
            flags: { ...defaultFlags, quiz: true },
        },
        {
            index: 1,
            field: { ref: 0 },
            comment: { ref: 0 },
            flags: { ...defaultFlags, quiz: true },
        },
    ];
    const tree = createTreeFromPages(pages);
    const p1Node = findNodeByPageIndex(tree, 1);

    return {
        fumen: {
            pages,
            currentIndex: 1,
            maxPage: pages.length,
            guideLineColor: true,
        },
        tree: {
            enabled: true,
            nodes: tree.nodes,
            rootId: tree.rootId,
            activeNodeId: p1Node!.id,
            addMode: AddMode.Branch,
            viewMode: TreeViewMode.Tree,
            dragState: initialTreeDragState,
            operationScope: 'node',
            grayAfterLineClear: false,
            scale: 1.0,
            autoFocusPending: false,
        },
    } as any;
};

const createPlacedQuizState = () => {
    const state = createQuizState();
    state.fumen.pages[1] = {
        ...state.fumen.pages[1],
        flags: { ...state.fumen.pages[1].flags, lock: true },
        piece: createSpawnMove(Piece.I, false),
    };
    return state;
};

describe('tree node navigation', () => {
    test('activates a node and synchronizes the current editor page', () => {
        const state = createBaseState();
        const tree = { nodes: state.tree.nodes, rootId: state.tree.rootId, version: 1 as const };
        const firstNode = findNodeByPageIndex(tree, 0)!;

        const next = treeOperationActions.activateTreeNode({ nodeId: firstNode.id })(state) as any;

        expect(next.tree.activeNodeId).toBe(firstNode.id);
        expect(next.fumen.currentIndex).toBe(0);
    });

    test('selects the linked page when navigating from its page number', () => {
        const state = createBaseState();
        const tree = { nodes: state.tree.nodes, rootId: state.tree.rootId, version: 1 as const };
        const firstNode = findNodeByPageIndex(tree, 0)!;

        const next = treeOperationActions.selectTreeNode({ nodeId: firstNode.id })(state) as any;

        expect(next.tree.activeNodeId).toBe(firstNode.id);
        expect(next.fumen.currentIndex).toBe(0);
    });
});

describe('addBranchFromCurrentNode', () => {
    test('adds a new page referencing the active node comment', () => {
        const state = createBaseState();
        const next = treeOperationActions.addBranchFromCurrentNode()(state) as any;

        expect(next.fumen.pages).toHaveLength(3);
        expect(next.fumen.currentIndex).toBe(2);
        expect(next.fumen.pages[2].comment).toEqual({ ref: 0 });
        expect(next.fumen.pages[2].flags.quiz).toBe(false);
        expect(next.tree.nodes).toHaveLength(state.tree.nodes.length + 1);

        const newNode = findNodeByPageIndex({ nodes: next.tree.nodes, rootId: next.tree.rootId, version: 1 }, 2);
        expect(newNode).toBeDefined();
        expect(next.tree.activeNodeId).toBe(newNode!.id);
    });

    test('uses the quiz state after the current page operation', () => {
        const state = createPlacedQuizState();
        const next = treeOperationActions.addBranchFromCurrentNode()(state) as any;

        expect(next.fumen.pages[2].comment).toEqual({ text: '#Q=[](O)T' });
        expect(next.fumen.pages[2].flags.quiz).toBe(true);
        const expectedField = new Pages(state.fumen.pages).getField(1, PageFieldOperation.All);
        expect(next.fumen.pages[2].field.obj.equals(expectedField)).toBe(true);
    });
});

describe('forkSevenBagGrayInputPage', () => {
    test('creates an independent pre-placement page without a tree', () => {
        const state = createBaseState();
        state.tree.enabled = false;
        state.fumen.currentIndex = 0;
        state.fumen.pages[0] = {
            ...state.fumen.pages[0],
            field: { obj: new Field({}) },
            piece: createSpawnMove(Piece.T, false),
            comment: { text: '#Q=[](T)I' },
            internal: {
                sevenBagGrayProgress: { bag: 2, pieces: 2, lines: 0, perfectClears: 0 },
            },
        };

        const next = treeOperationActions.forkSevenBagGrayInputPage()(state) as any;
        const workspace = next.fumen.pages[2];

        expect(next.fumen.currentIndex).toBe(2);
        expect(workspace.field.obj).toBeDefined();
        expect(workspace.field.ref).toBeUndefined();
        expect(workspace.piece).toEqual(state.fumen.pages[0].piece);
        expect(workspace.comment).toEqual({ text: '#Q=[](T)I' });
        expect(workspace.internal).toMatchObject({
            sevenBagGrayProgress: { bag: 2, pieces: 2, lines: 0, perfectClears: 0 },
            sevenBagGrayWorkspace: true,
        });
    });

    test('branches the workspace before an existing later tree branch', () => {
        const state = createBaseState();
        const extraPage: Page = {
            index: 2,
            field: { ref: 0 },
            comment: { ref: 0 },
            flags: { ...defaultFlags },
        };
        state.fumen.pages.push(extraPage);
        state.fumen.maxPage = 3;
        const tree = { nodes: state.tree.nodes, rootId: state.tree.rootId, version: 1 as const };
        const p0 = findNodeByPageIndex(tree, 0)!;
        const p1 = findNodeByPageIndex(tree, 1)!;
        state.tree.nodes = state.tree.nodes.map((node: any) => {
            if (node.id === p0.id) return { ...node, childrenIds: [p1.id, 'later'] };
            if (node.id === p1.id) return { ...node, childrenIds: [] };
            return node;
        }).concat({ id: 'later', pageIndex: 2, parentId: p0.id, childrenIds: [] });
        state.fumen.pages[1] = {
            ...state.fumen.pages[1],
            piece: createSpawnMove(Piece.T, false),
        };

        const next = treeOperationActions.forkSevenBagGrayInputPage()(state) as any;
        const nextTree = { nodes: next.tree.nodes, rootId: next.tree.rootId, version: 1 as const };
        const workspaceNode = findNode(nextTree, next.tree.activeNodeId)!;

        expect(next.fumen.currentIndex).toBe(workspaceNode.pageIndex);
        expect(workspaceNode.pageIndex).toBe(2);
        expect(next.fumen.pages[2].internal!.sevenBagGrayWorkspace).toBe(true);
        expect(next.fumen.pages[3].comment).toEqual({ ref: 0 });
        expect(findNode(nextTree, p1.id)!.childrenIds).toEqual([workspaceNode.id]);
    });
});

describe('insertNodeAfterCurrent', () => {
    test('inserts the new node between the target node and its first child', () => {
        const state = createBaseState();
        const tree = { nodes: state.tree.nodes, rootId: state.tree.rootId, version: 1 as const };
        const p0Node = findNodeByPageIndex(tree, 0);
        const p1Node = findNodeByPageIndex(tree, 1);

        const next = treeOperationActions.insertNodeAfterCurrent({ parentNodeId: p0Node!.id })(state) as any;

        const nextTree = { nodes: next.tree.nodes, rootId: next.tree.rootId, version: 1 as const };
        const newNode = findNodeByPageIndex(nextTree, 1);
        expect(newNode).toBeDefined();

        const updatedP0 = findNode(nextTree, p0Node!.id);
        expect(updatedP0!.childrenIds).toEqual([newNode!.id]);
        expect(newNode!.childrenIds).toEqual([p1Node!.id]);

        const shiftedP1 = findNode(nextTree, p1Node!.id);
        expect(shiftedP1!.pageIndex).toBe(2);
    });

    test('uses the quiz state after the current page operation', () => {
        const state = createPlacedQuizState();
        const tree = { nodes: state.tree.nodes, rootId: state.tree.rootId, version: 1 as const };
        const p1Node = findNodeByPageIndex(tree, 1)!;

        const next = treeOperationActions.insertNodeAfterCurrent({ parentNodeId: p1Node.id })(state) as any;

        expect(next.fumen.pages[2].comment).toEqual({ text: '#Q=[](O)T' });
        expect(next.fumen.pages[2].flags.quiz).toBe(true);
    });
});

describe('copyTreeNode', () => {
    test('adds the copy as the next sibling directly after the source node', () => {
        const state = createBaseState();
        const tree = { nodes: state.tree.nodes, rootId: state.tree.rootId, version: 1 as const };
        const p1Node = findNodeByPageIndex(tree, 1);

        const next = treeOperationActions.copyTreeNode({ nodeId: p1Node!.id })(state) as any;

        expect(next.fumen.pages).toHaveLength(3);

        const nextTree = { nodes: next.tree.nodes, rootId: next.tree.rootId, version: 1 as const };
        const p0Node = findNodeByPageIndex(nextTree, 0);
        const copiedNode = next.tree.nodes.find((n: any) => n.parentId === p1Node!.parentId
            && n.pageIndex !== undefined && n.pageIndex >= 0 && findNode(nextTree, n.id)?.id !== p1Node!.id);

        expect(p0Node!.childrenIds).toHaveLength(2);
        expect(p0Node!.childrenIds[0]).toBe(p1Node!.id);
        expect(copiedNode).toBeDefined();
        expect(p0Node!.childrenIds[1]).toBe(copiedNode!.id);
    });

    test('materializes the effective quiz comment for a copied node', () => {
        const state = createQuizState();
        const tree = { nodes: state.tree.nodes, rootId: state.tree.rootId, version: 1 as const };
        const sourceNode = findNodeByPageIndex(tree, 1)!;

        const next = treeOperationActions.copyTreeNode({ nodeId: sourceNode.id })(state) as any;

        expect(next.fumen.pages[2].comment).toEqual({ text: '#Q=[](I)OT' });
        expect(next.fumen.pages[2].flags.quiz).toBe(true);
    });
});

describe('removeCurrentTreeNode', () => {
    test('removes a middle node along with its descendants and re-activates the parent', () => {
        const pages: Page[] = [
            ...createChainPages(),
            {
                index: 2,
                field: { ref: 0 },
                comment: { ref: 0 },
                flags: { ...defaultFlags },
            },
        ];
        const tree = createTreeFromPages(pages);
        const p1Node = findNodeByPageIndex(tree, 1);
        const p0Node = findNodeByPageIndex(tree, 0);

        const state = {
            fumen: {
                pages,
                currentIndex: 1,
                maxPage: pages.length,
                guideLineColor: true,
            },
            tree: {
                enabled: true,
                nodes: tree.nodes,
                rootId: tree.rootId,
                activeNodeId: p1Node!.id,
                addMode: AddMode.Branch,
                viewMode: TreeViewMode.Tree,
                dragState: initialTreeDragState,
                operationScope: 'node',
                grayAfterLineClear: false,
                scale: 1.0,
                autoFocusPending: false,
            },
        } as any;

        const next = treeOperationActions.removeCurrentTreeNode()(state) as any;

        expect(next.fumen.pages).toHaveLength(1);
        expect(next.tree.activeNodeId).toBe(p0Node!.id);
    });
});

const createThreeChainState = (operationScope: TreeOperationScope) => {
    const pages: Page[] = [
        ...createChainPages(),
        {
            index: 2,
            field: { ref: 0 },
            comment: { ref: 0 },
            flags: { ...defaultFlags },
        },
    ];
    const tree = createTreeFromPages(pages);
    const p1Node = findNodeByPageIndex(tree, 1);

    return {
        fumen: {
            pages,
            currentIndex: 1,
            maxPage: pages.length,
            guideLineColor: true,
        },
        tree: {
            operationScope,
            enabled: true,
            nodes: tree.nodes,
            rootId: tree.rootId,
            activeNodeId: p1Node!.id,
            addMode: AddMode.Branch,
            viewMode: TreeViewMode.Tree,
            dragState: initialTreeDragState,
            grayAfterLineClear: false,
            scale: 1.0,
            autoFocusPending: false,
        },
    } as any;
};

type FieldPhases = {
    none: Field;
    command: Field;
    all: Field;
};

const getFieldPhases = (pages: Page[], pageIndex: number): FieldPhases => {
    const pagesObj = new Pages(pages);
    return {
        none: pagesObj.getField(pageIndex, PageFieldOperation.None),
        command: pagesObj.getField(pageIndex, PageFieldOperation.Command),
        all: pagesObj.getField(pageIndex, PageFieldOperation.All),
    };
};

const expectFieldPhases = (actual: FieldPhases, expected: FieldPhases) => {
    expect(actual.none.equals(expected.none)).toBe(true);
    expect(actual.command.equals(expected.command)).toBe(true);
    expect(actual.all.equals(expected.all)).toBe(true);
};

const expectResolvableBackwardRefs = (pages: Page[]) => {
    pages.forEach((page, index) => {
        if (page.field.ref !== undefined) {
            expect(page.field.ref).toBeLessThan(index);
            expect(pages[page.field.ref].field.obj).toBeDefined();
        }
        if (page.comment.ref !== undefined) {
            expect(page.comment.ref).toBeLessThan(index);
            expect(pages[page.comment.ref].comment.text).toBeDefined();
        }
    });
};

const createFieldPreservationPages = (): Page[] => [
    {
        index: 0,
        field: { obj: new Field({}) },
        comment: { text: 'root' },
        flags: { ...defaultFlags },
    },
    {
        index: 1,
        field: { ref: 0 },
        comment: { text: 'removed comment' },
        flags: { ...defaultFlags, lock: true },
        piece: createSpawnMove(Piece.I, false),
    },
    {
        index: 2,
        field: { ref: 0 },
        comment: { ref: 1 },
        flags: { ...defaultFlags, lock: true },
        piece: createSpawnMove(Piece.O, false),
    },
    {
        index: 3,
        field: { ref: 0 },
        comment: { ref: 1 },
        flags: { ...defaultFlags },
    },
];

const createTreeState = (
    pages: Page[],
    tree: SerializedTree,
    activeNodeId: string,
    operationScope: TreeOperationScope = 'node',
) => ({
    fumen: {
        pages,
        currentIndex: findNode(tree, activeNodeId)?.pageIndex ?? 0,
        maxPage: pages.length,
        guideLineColor: true,
    },
    tree: {
        operationScope,
        activeNodeId,
        enabled: true,
        nodes: tree.nodes,
        rootId: tree.rootId,
        addMode: AddMode.Branch,
        viewMode: TreeViewMode.Tree,
        dragState: initialTreeDragState,
        grayAfterLineClear: false,
        scale: 1.0,
        autoFocusPending: false,
    },
}) as any;

beforeEach(() => {
    mockedActions.commitRectSelection.mockClear();
    mockedActions.removeUnsettledItems.mockClear();
    mockedActions.commitCommentText.mockClear();
    mockedActions.reopenCurrentPage.mockClear();
});

describe('tree editor boundary', () => {
    const expectSettled = () => {
        expect(mockedActions.commitRectSelection).toHaveBeenCalledTimes(1);
        expect(mockedActions.removeUnsettledItems).toHaveBeenCalledTimes(1);
        expect(mockedActions.commitCommentText).toHaveBeenCalledTimes(1);
        expect(mockedActions.commitRectSelection.mock.invocationCallOrder[0])
            .toBeLessThan(mockedActions.removeUnsettledItems.mock.invocationCallOrder[0]);
        expect(mockedActions.removeUnsettledItems.mock.invocationCallOrder[0])
            .toBeLessThan(mockedActions.commitCommentText.mock.invocationCallOrder[0]);
    };

    test('settles before tree navigation and reopens the selected page', () => {
        const state = createBaseState();
        const tree = { nodes: state.tree.nodes, rootId: state.tree.rootId, version: 1 as const };
        const firstNode = findNodeByPageIndex(tree, 0)!;

        treeOperationActions.selectTreeNode({ nodeId: firstNode.id })(state);

        expectSettled();
        expect(mockedActions.reopenCurrentPage).toHaveBeenCalledTimes(1);
    });

    test('settles before add, copy, delete, and drag operations', () => {
        const addState = createBaseState();
        treeOperationActions.addBranchFromCurrentNode()(addState);
        expectSettled();

        mockedActions.commitRectSelection.mockClear();
        mockedActions.removeUnsettledItems.mockClear();
        mockedActions.commitCommentText.mockClear();
        const copyState = createBaseState();
        const copyTree = { nodes: copyState.tree.nodes, rootId: copyState.tree.rootId, version: 1 as const };
        treeOperationActions.copyTreeNode({ nodeId: findNodeByPageIndex(copyTree, 1)!.id })(copyState);
        expectSettled();

        mockedActions.commitRectSelection.mockClear();
        mockedActions.removeUnsettledItems.mockClear();
        mockedActions.commitCommentText.mockClear();
        const deleteState = createBaseState();
        const deleteTree = { nodes: deleteState.tree.nodes, rootId: deleteState.tree.rootId, version: 1 as const };
        treeOperationActions.removeTreeNode({ nodeId: findNodeByPageIndex(deleteTree, 1)!.id })(deleteState);
        expectSettled();

        mockedActions.commitRectSelection.mockClear();
        mockedActions.removeUnsettledItems.mockClear();
        mockedActions.commitCommentText.mockClear();
        const dragState = createThreeChainState('node');
        const dragTree = { nodes: dragState.tree.nodes, rootId: dragState.tree.rootId, version: 1 as const };
        const sourceNode = findNodeByPageIndex(dragTree, 2)!;
        const targetNode = findNodeByPageIndex(dragTree, 0)!;
        dragState.tree.dragState = {
            ...initialTreeDragState,
            sourceNodeId: sourceNode.id,
            targetButtonParentId: targetNode.id,
            targetButtonType: 'branch',
        };
        treeOperationActions.executeTreeDrop()(dragState);
        expectSettled();
    });
});

describe('removeTreeNode', () => {
    test('preserves promoted fields, comments, refs, encoding, and source state', async () => {
        const pages = createFieldPreservationPages();
        const tree = createTreeFromPages(pages);
        const removedNode = findNodeByPageIndex(tree, 1)!;
        const survivingNodes = [0, 2, 3].map(index => findNodeByPageIndex(tree, index)!);
        const expectedFields = new Map(survivingNodes.map(node => [
            node.id,
            getFieldPhases(pages, node.pageIndex),
        ]));
        const sourceBefore = pages.map(toPrimitivePage);
        const originalKeyPageCount = pages.filter(page => page.field.obj !== undefined).length;
        const state = createTreeState(pages, tree, removedNode.id);

        const next = treeOperationActions.removeTreeNode({ nodeId: removedNode.id })(state) as any;
        const nextPages: Page[] = next.fumen.pages;
        const nextTree: SerializedTree = {
            nodes: next.tree.nodes,
            rootId: next.tree.rootId,
            version: 1,
        };

        survivingNodes.forEach((node) => {
            const nextNode = findNode(nextTree, node.id)!;
            expectFieldPhases(getFieldPhases(nextPages, nextNode.pageIndex), expectedFields.get(node.id)!);
        });
        const promotedNode = findNode(nextTree, survivingNodes[1].id)!;
        expect(resolvePageCommentText(nextPages, promotedNode.pageIndex)).toBe('removed comment');
        expect(resolvePageCommentText(nextPages, promotedNode.pageIndex + 1)).toBe('removed comment');
        expectResolvableBackwardRefs(nextPages);
        expect(nextPages.filter(page => page.field.obj !== undefined).length)
            .toBeLessThanOrEqual(originalKeyPageCount + 1);
        expect(pages.map(toPrimitivePage)).toEqual(sourceBefore);

        const encoded = await encode(nextPages);
        const decoded = await decode(`v115@${encoded}`);
        expect(decoded).toHaveLength(nextPages.length);
        decoded.forEach((_page, index) => {
            expect(new Pages(decoded).getField(index, PageFieldOperation.None)
                .equals(new Pages(nextPages).getField(index, PageFieldOperation.None))).toBe(true);
        });
    });

    test('preserves both promoted child branches with one boundary key page', () => {
        const pages = [
            ...createFieldPreservationPages(),
            {
                index: 4,
                field: { ref: 0 },
                comment: { ref: 1 },
                flags: { ...defaultFlags, lock: true },
                piece: createSpawnMove(Piece.T, false),
            },
        ];
        const chain = createTreeFromPages(pages);
        const p0 = findNodeByPageIndex(chain, 0)!;
        const removed = findNodeByPageIndex(chain, 1)!;
        const childA = findNodeByPageIndex(chain, 2)!;
        const grandchildA = findNodeByPageIndex(chain, 3)!;
        const childB = findNodeByPageIndex(chain, 4)!;
        const tree: SerializedTree = {
            ...chain,
            nodes: chain.nodes.map((node) => {
                if (node.id === removed.id) return { ...node, childrenIds: [childA.id, childB.id] };
                if (node.id === childA.id) return { ...node, parentId: removed.id, childrenIds: [grandchildA.id] };
                if (node.id === grandchildA.id) return { ...node, parentId: childA.id, childrenIds: [] };
                if (node.id === childB.id) return { ...node, parentId: removed.id, childrenIds: [] };
                if (node.id === p0.id) return { ...node, childrenIds: [removed.id] };
                return node;
            }),
        };
        const survivors = [p0, childA, grandchildA, childB];
        const expectedFields = new Map(survivors.map(node => [node.id, getFieldPhases(pages, node.pageIndex)]));
        const state = createTreeState(pages, tree, removed.id);

        const next = treeOperationActions.removeTreeNode({ nodeId: removed.id })(state) as any;
        const nextTree: SerializedTree = {
            nodes: next.tree.nodes,
            rootId: next.tree.rootId,
            version: 1,
        };

        survivors.forEach((node) => {
            const nextNode = findNode(nextTree, node.id)!;
            expectFieldPhases(getFieldPhases(next.fumen.pages, nextNode.pageIndex), expectedFields.get(node.id)!);
        });
        expect(findNode(nextTree, p0.id)!.childrenIds).toEqual([childA.id, childB.id]);
        expect(next.fumen.pages.filter((page: Page) => page.field.obj !== undefined)).toHaveLength(2);
        expectResolvableBackwardRefs(next.fumen.pages);
    });

    test('preserves fields across non-contiguous descending page removal', () => {
        const pages: Page[] = [
            {
                index: 0,
                field: { obj: new Field({}) },
                comment: { text: 'root' },
                flags: { ...defaultFlags },
            },
            ...[Piece.I, Piece.O, Piece.T, Piece.L, Piece.J].map((piece, offset): Page => ({
                index: offset + 1,
                field: { ref: 0 },
                comment: { ref: 0 },
                flags: { ...defaultFlags, lock: true },
                piece: createSpawnMove(piece, false),
            })),
        ];
        const removed = new Set([1, 4]);
        const survivingIndices = pages.map(page => page.index).filter(index => !removed.has(index));
        const expectedFields = survivingIndices.map(index => getFieldPhases(pages, index));
        const sourceBefore = pages.map(toPrimitivePage);

        const nextPages: Page[] = removePagesByIndices(pages, Array.from(removed));

        expectedFields.forEach((expected, index) => {
            expectFieldPhases(getFieldPhases(nextPages, index), expected);
        });
        expect(nextPages.filter(page => page.field.obj !== undefined)).toHaveLength(3);
        expectResolvableBackwardRefs(nextPages);
        expect(pages.map(toPrimitivePage)).toEqual(sourceBefore);
    });

    test('preserves fumen-wide colorize when deleting the first node', () => {
        const pages = createFieldPreservationPages();
        pages[0].flags.colorize = false;
        const tree = createTreeFromPages(pages);
        const removed = findNodeByPageIndex(tree, 0)!;
        const promoted = findNodeByPageIndex(tree, 1)!;
        const expected = getFieldPhases(pages, promoted.pageIndex);
        const state = createTreeState(pages, tree, removed.id);

        const next = treeOperationActions.removeTreeNode({ nodeId: removed.id })(state) as any;
        const nextTree: SerializedTree = {
            nodes: next.tree.nodes,
            rootId: next.tree.rootId,
            version: 1,
        };
        const nextPromoted = findNode(nextTree, promoted.id)!;

        expect(next.fumen.pages[0].flags.colorize).toBe(false);
        expectFieldPhases(getFieldPhases(next.fumen.pages, nextPromoted.pageIndex), expected);
    });

    test('materializes only quiz refs whose replay span crosses a removed page', () => {
        const pages: Page[] = [
            {
                index: 0,
                field: { obj: new Field({}) },
                comment: { text: '#Q=[](I)OT' },
                flags: { ...defaultFlags, quiz: true },
            },
            {
                index: 1,
                field: { ref: 0 },
                comment: { ref: 0 },
                flags: { ...defaultFlags, lock: true, quiz: true },
                piece: createSpawnMove(Piece.I, false),
            },
            {
                index: 2,
                field: { ref: 0 },
                comment: { ref: 0 },
                flags: { ...defaultFlags, lock: true, quiz: true },
                piece: createSpawnMove(Piece.O, false),
            },
            {
                index: 3,
                field: { ref: 0 },
                comment: { text: '#Q=[](I)OT' },
                flags: { ...defaultFlags, quiz: true },
            },
            {
                index: 4,
                field: { ref: 0 },
                comment: { ref: 3 },
                flags: { ...defaultFlags, quiz: true },
            },
        ];
        const tree = createTreeFromPages(pages);
        const p1Node = findNodeByPageIndex(tree, 1)!;
        const state = {
            fumen: { pages, currentIndex: 1, maxPage: pages.length, guideLineColor: true },
            tree: {
                enabled: true,
                nodes: tree.nodes,
                rootId: tree.rootId,
                activeNodeId: p1Node.id,
                addMode: AddMode.Branch,
                viewMode: TreeViewMode.Tree,
                dragState: initialTreeDragState,
                operationScope: 'node',
                grayAfterLineClear: false,
                scale: 1.0,
                autoFocusPending: false,
            },
        } as any;

        const next = treeOperationActions.removeTreeNode({ nodeId: p1Node.id })(state) as any;

        expect(next.fumen.pages[1].comment).toEqual({ text: '#Q=[](O)T' });
        expect(next.fumen.pages[3].comment).toEqual({ ref: 2 });
    });

    test('removes only the leaf node in subtree scope', () => {
        const state = createThreeChainState('subtree');
        const tree = { nodes: state.tree.nodes, rootId: state.tree.rootId, version: 1 as const };
        const leafNode = findNodeByPageIndex(tree, 2);

        const next = treeOperationActions.removeTreeNode({ nodeId: leafNode!.id })(state) as any;

        expect(next.fumen.pages).toHaveLength(2);
        const nextTree = { nodes: next.tree.nodes, rootId: next.tree.rootId, version: 1 as const };
        expect(findNode(nextTree, leafNode!.id)).toBeUndefined();
    });

    test('removes only the node and promotes children when the setting is off', () => {
        const state = createThreeChainState('node');
        const tree = { nodes: state.tree.nodes, rootId: state.tree.rootId, version: 1 as const };
        const p0Node = findNodeByPageIndex(tree, 0);
        const p1Node = findNodeByPageIndex(tree, 1);
        const p2Node = findNodeByPageIndex(tree, 2);

        const next = treeOperationActions.removeTreeNode({ nodeId: p1Node!.id })(state) as any;

        expect(next.fumen.pages).toHaveLength(2);
        const nextTree = { nodes: next.tree.nodes, rootId: next.tree.rootId, version: 1 as const };
        expect(findNode(nextTree, p1Node!.id)).toBeUndefined();

        // The old p2 node is re-parented under p0 and now points at page index 1
        const promoted = findNode(nextTree, p2Node!.id);
        expect(promoted).toBeDefined();
        expect(promoted!.parentId).toBe(p0Node!.id);
        expect(promoted!.pageIndex).toBe(1);
    });

    test('removes the whole subtree when the setting is on', () => {
        const state = createThreeChainState('subtree');
        const tree = { nodes: state.tree.nodes, rootId: state.tree.rootId, version: 1 as const };
        const p0Node = findNodeByPageIndex(tree, 0);
        const p1Node = findNodeByPageIndex(tree, 1);

        const next = treeOperationActions.removeTreeNode({ nodeId: p1Node!.id })(state) as any;

        expect(next.fumen.pages).toHaveLength(1);
        expect(next.tree.activeNodeId).toBe(p0Node!.id);
        expect(next.fumen.currentIndex).toBe(0);
    });

    test('rejects a removal that would delete every page', () => {
        const state = createThreeChainState('subtree');
        const tree = { nodes: state.tree.nodes, rootId: state.tree.rootId, version: 1 as const };
        const p0Node = findNodeByPageIndex(tree, 0);

        const next = treeOperationActions.removeTreeNode({ nodeId: p0Node!.id })(state);

        expect(next).toBeUndefined();
    });

    test('removes descendants while keeping the selected node', () => {
        const state = createThreeChainState('descendants');
        const tree = { nodes: state.tree.nodes, rootId: state.tree.rootId, version: 1 as const };
        const p1Node = findNodeByPageIndex(tree, 1)!;
        const extraPage = {
            ...state.fumen.pages[2],
            index: 3,
        };
        const branched = addBranchNode(tree, p1Node.id, 3).tree;
        state.fumen.pages = [...state.fumen.pages, extraPage];
        state.fumen.maxPage = state.fumen.pages.length;
        state.tree.nodes = branched.nodes;

        const next = treeOperationActions.removeTreeNode({ nodeId: p1Node.id })(state) as any;
        const nextTree = { nodes: next.tree.nodes, rootId: next.tree.rootId, version: 1 as const };

        expect(next.fumen.pages).toHaveLength(2);
        expect(findNode(nextTree, p1Node.id)).toBeDefined();
        expect(next.tree.activeNodeId).toBe(p1Node.id);
        expect(findNodeByPageIndex(nextTree, 2)).toBeUndefined();
    });
});

describe('executeTreeDrop onto own parent insert button', () => {
    test('is a no-op that only clears the drag state (no delete)', () => {
        const state = createThreeChainState('node');
        const tree = { nodes: state.tree.nodes, rootId: state.tree.rootId, version: 1 as const };
        const p1Node = findNodeByPageIndex(tree, 1);
        const p2Node = findNodeByPageIndex(tree, 2);

        state.tree.dragState = {
            ...initialTreeDragState,
            sourceNodeId: p2Node!.id,
            targetNodeId: null,
            dropSlotIndex: null,
            targetButtonParentId: p1Node!.id,
            targetButtonType: 'insert',
        };

        const next = treeOperationActions.executeTreeDrop()(state) as any;

        expect(next.fumen).toBeUndefined();
        expect(next.tree.dragState.sourceNodeId).toBeNull();
        expect(next.tree.nodes).toBe(state.tree.nodes);
    });
});

describe('executeTreeDrop with descendants scope', () => {
    test('moves multiple child subtrees to a branch in order', () => {
        const state = createThreeChainState('descendants');
        const tree = { nodes: state.tree.nodes, rootId: state.tree.rootId, version: 1 as const };
        const sourceNode = findNodeByPageIndex(tree, 1)!;
        const targetNode = findNodeByPageIndex(tree, 0)!;
        const extraPage = {
            ...state.fumen.pages[2],
            index: 3,
        };
        state.fumen.pages = [...state.fumen.pages, extraPage];
        state.fumen.maxPage = state.fumen.pages.length;
        state.tree.nodes = addBranchNode(tree, sourceNode.id, 3).tree.nodes;
        state.tree.dragState = {
            ...initialTreeDragState,
            sourceNodeId: sourceNode.id,
            targetButtonParentId: targetNode.id,
            targetButtonType: 'branch',
            operationScope: 'descendants',
        };

        const next = treeOperationActions.executeTreeDrop()(state) as any;
        const nextTree = { nodes: next.tree.nodes, rootId: next.tree.rootId, version: 1 as const };
        const nextSource = findNode(nextTree, sourceNode.id)!;
        const nextTarget = findNode(nextTree, targetNode.id)!;

        expect(nextSource.childrenIds).toEqual([]);
        expect(nextTarget.childrenIds).toEqual([
            sourceNode.id,
            findNodeByPageIndex(nextTree, 2)!.id,
            findNodeByPageIndex(nextTree, 3)!.id,
        ]);
        expect(next.fumen.pages).toHaveLength(4);
    });

    test('allows multiple descendants onto a leaf Insert target', () => {
        const state = createThreeChainState('descendants');
        const tree = { nodes: state.tree.nodes, rootId: state.tree.rootId, version: 1 as const };
        const sourceNode = findNodeByPageIndex(tree, 1)!;
        state.fumen.pages = [
            ...state.fumen.pages,
            { ...state.fumen.pages[2], index: 3 },
            { ...state.fumen.pages[2], index: 4 },
        ];
        state.fumen.maxPage = state.fumen.pages.length;
        const branched = addBranchNode(tree, sourceNode.id, 3).tree;
        const withLeafTargetResult = addBranchNode(branched, tree.rootId!, 4);
        const targetNode = withLeafTargetResult.newNodeId;
        const withLeafTarget = withLeafTargetResult.tree;
        state.tree.nodes = withLeafTarget.nodes;
        state.tree.dragState = {
            ...initialTreeDragState,
            sourceNodeId: sourceNode.id,
            targetButtonParentId: targetNode,
            targetButtonType: 'insert',
            operationScope: 'descendants',
        };

        const next = treeOperationActions.executeTreeDrop()(state) as any;
        const nextTree = { nodes: next.tree.nodes, rootId: next.tree.rootId, version: 1 as const };

        expect(findNode(nextTree, sourceNode.id)?.childrenIds).toEqual([]);
        expect(findNode(nextTree, targetNode)?.childrenIds).toEqual([
            findNodeByPageIndex(nextTree, 3)!.id,
            findNodeByPageIndex(nextTree, 4)!.id,
        ]);
        expect(next.fumen.pages).toHaveLength(5);
    });
});

import { Field } from '../../lib/fumen/field';
import { Page } from '../../lib/fumen/types';
import { AddMode, TreeViewMode, initialTreeDragState } from '../../lib/fumen/tree_types';
import { createTreeFromPages, findNode, findNodeByPageIndex } from '../../lib/fumen/tree_utils';

jest.mock('../../actions', () => ({
    actions: {},
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
const { treeOperationActions } = require('../tree_operations');

const defaultFlags = {
    lock: false,
    mirror: false,
    colorize: true,
    rise: false,
    quiz: false,
    srs: true,
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
            buttonDropMovesSubtree: false,
            grayAfterLineClear: false,
            treeViewNavLockUntil: 0,
            scale: 1.0,
            autoFocusPending: false,
        },
    } as any;
};

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
                buttonDropMovesSubtree: false,
                grayAfterLineClear: false,
                treeViewNavLockUntil: 0,
                scale: 1.0,
                autoFocusPending: false,
            },
        } as any;

        const next = treeOperationActions.removeCurrentTreeNode()(state) as any;

        expect(next.fumen.pages).toHaveLength(1);
        expect(next.tree.activeNodeId).toBe(p0Node!.id);
    });
});

describe('executeTreeDrop via delete badge', () => {
    test('removes the dragged leaf node and clears the drag state', () => {
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
        const leafNode = findNodeByPageIndex(tree, 2);

        const state = {
            fumen: {
                pages,
                currentIndex: 2,
                maxPage: pages.length,
                guideLineColor: true,
            },
            tree: {
                enabled: true,
                nodes: tree.nodes,
                rootId: tree.rootId,
                activeNodeId: leafNode!.id,
                addMode: AddMode.Branch,
                viewMode: TreeViewMode.Tree,
                dragState: {
                    ...initialTreeDragState,
                    sourceNodeId: leafNode!.id,
                    targetNodeId: null,
                    dropSlotIndex: null,
                    targetButtonParentId: leafNode!.id,
                    targetButtonType: 'delete',
                },
                buttonDropMovesSubtree: false,
                grayAfterLineClear: false,
                treeViewNavLockUntil: 0,
                scale: 1.0,
                autoFocusPending: false,
            },
        } as any;

        const next = treeOperationActions.executeTreeDrop()(state) as any;

        expect(next.fumen.pages).toHaveLength(2);
        expect(next.tree.dragState.sourceNodeId).toBeNull();
    });
});

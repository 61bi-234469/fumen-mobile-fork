import { Field } from '../../lib/fumen/field';
import { Page } from '../../lib/fumen/types';
import { AddMode, TreeOperationScope, TreeViewMode, initialTreeDragState } from '../../lib/fumen/tree_types';
import { addBranchNode, createTreeFromPages, findNode, findNodeByPageIndex } from '../../lib/fumen/tree_utils';

jest.mock('../../actions', () => ({
    actions: {
        reopenCurrentPage: () => () => undefined,
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
const { treeOperationActions } = require('../tree_operations');

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

describe('removeTreeNode', () => {
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

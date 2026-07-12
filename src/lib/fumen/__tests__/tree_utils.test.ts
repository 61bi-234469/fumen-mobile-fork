import { SerializedTree } from '../tree_types';
import {
    canMoveScope,
    findNode,
    moveDescendantsToInsertPosition,
    moveDescendantsToParent,
    moveNodeToParent,
    moveSubtreeToParent,
} from '../tree_utils';

const buildTree = (): SerializedTree => ({
    nodes: [
        { id: 'virtual-root', parentId: null, pageIndex: -1, childrenIds: ['a', 'd'] },
        { id: 'a', parentId: 'virtual-root', pageIndex: 0, childrenIds: ['b'] },
        { id: 'b', parentId: 'a', pageIndex: 1, childrenIds: ['c'] },
        { id: 'c', parentId: 'b', pageIndex: 2, childrenIds: [] },
        { id: 'd', parentId: 'virtual-root', pageIndex: 3, childrenIds: [] },
    ],
    rootId: 'virtual-root',
    version: 2,
});

const buildBranchingTree = (): SerializedTree => ({
    ...buildTree(),
    nodes: [
        ...buildTree().nodes,
        { id: 'e', parentId: 'b', pageIndex: 4, childrenIds: [] },
    ].map(node => node.id === 'b'
        ? { ...node, childrenIds: ['c', 'e'] }
        : node),
});

describe('tree_utils root ghost movement', () => {
    test('moves a single node to the virtual root as a top-level branch', () => {
        const moved = moveNodeToParent(buildTree(), 'b', 'virtual-root');

        expect(findNode(moved, 'virtual-root')?.childrenIds).toEqual(['a', 'd', 'b']);
        expect(findNode(moved, 'a')?.childrenIds).toEqual(['c']);
        expect(findNode(moved, 'b')?.parentId).toBe('virtual-root');
        expect(findNode(moved, 'b')?.childrenIds).toEqual([]);
        expect(findNode(moved, 'c')?.parentId).toBe('a');
    });

    test('moves a subtree to the virtual root as a top-level branch', () => {
        const moved = moveSubtreeToParent(buildTree(), 'b', 'virtual-root');

        expect(findNode(moved, 'virtual-root')?.childrenIds).toEqual(['a', 'd', 'b']);
        expect(findNode(moved, 'a')?.childrenIds).toEqual([]);
        expect(findNode(moved, 'b')?.parentId).toBe('virtual-root');
        expect(findNode(moved, 'b')?.childrenIds).toEqual(['c']);
        expect(findNode(moved, 'c')?.parentId).toBe('b');
    });
});

describe('tree operation scopes', () => {
    test('moves descendant subtrees to a branch in their original order', () => {
        const tree = buildBranchingTree();

        const moved = moveDescendantsToParent(tree, 'b', 'virtual-root');

        expect(findNode(moved, 'virtual-root')?.childrenIds).toEqual(['a', 'd', 'c', 'e']);
        expect(findNode(moved, 'b')?.childrenIds).toEqual([]);
        expect(findNode(moved, 'c')?.parentId).toBe('virtual-root');
        expect(findNode(moved, 'e')?.parentId).toBe('virtual-root');
    });

    test('moves the only descendant subtree to an insert position', () => {
        const moved = moveDescendantsToInsertPosition(buildTree(), 'b', 'd');

        expect(findNode(moved, 'b')?.childrenIds).toEqual([]);
        expect(findNode(moved, 'd')?.childrenIds).toEqual(['c']);
        expect(findNode(moved, 'c')?.parentId).toBe('d');
    });

    test('moves multiple descendant subtrees to a leaf insert position', () => {
        const moved = moveDescendantsToInsertPosition(buildBranchingTree(), 'b', 'd');

        expect(findNode(moved, 'b')?.childrenIds).toEqual([]);
        expect(findNode(moved, 'd')?.childrenIds).toEqual(['c', 'e']);
        expect(findNode(moved, 'c')?.parentId).toBe('d');
        expect(findNode(moved, 'e')?.parentId).toBe('d');
    });

    test('leaves a leaf unchanged for descendant-only movement', () => {
        const tree = buildTree();

        expect(moveDescendantsToParent(tree, 'c', 'virtual-root')).toBe(tree);
        expect(moveDescendantsToInsertPosition(tree, 'c', 'd')).toBe(tree);
    });

    test('applies scope-specific drop constraints', () => {
        expect(canMoveScope(buildTree(), 'b', 'd', 'node', 'branch')).toBe(true);
        expect(canMoveScope(buildTree(), 'b', 'c', 'subtree', 'branch')).toBe(false);
        expect(canMoveScope(buildTree(), 'b', 'a', 'descendants', 'insert')).toBe(false);
        expect(canMoveScope(buildTree(), 'b', 'c', 'descendants', 'branch')).toBe(false);
        expect(canMoveScope(buildTree(), 'b', 'd', 'descendants', 'insert')).toBe(true);
        expect(canMoveScope(buildBranchingTree(), 'b', 'd', 'descendants', 'insert')).toBe(true);
        expect(canMoveScope(buildBranchingTree(), 'b', 'a', 'descendants', 'insert')).toBe(false);
        expect(canMoveScope(buildTree(), 'c', 'd', 'descendants', 'branch')).toBe(false);
    });
});

import { SerializedTree, TreeOperationScope } from '../tree_types';
import {
    canMoveScope,
    findNode,
    moveChildToSlot,
    moveDescendantsToInsertPosition,
    moveDescendantsToParent,
    moveNodeToParent,
    moveSubtreeToParent,
    resolveLaneReorderUnit,
    validateTree,
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

// Lanes (top to bottom): A B C D E F / G / H I / J K / L M / N O
const laneTreeChildren: { [id: string]: string[] } = {
    root: ['A', 'N'],
    A: ['B'], B: ['C', 'L'], C: ['D', 'H', 'J'], D: ['E'], E: ['F', 'G'], F: [], G: [],
    H: ['I'], I: [], J: ['K'], K: [], L: ['M'], M: [], N: ['O'], O: [],
};

const buildTreeFromChildren = (children: { [id: string]: string[] }): SerializedTree => {
    const parentOf: { [id: string]: string } = {};
    Object.keys(children).forEach(id => children[id].forEach((childId) => {
        parentOf[childId] = id;
    }));
    const realIds = Object.keys(children).filter(id => id !== 'root');
    return {
        nodes: Object.keys(children).map(id => ({
            id,
            parentId: parentOf[id] ?? null,
            pageIndex: realIds.indexOf(id),
            childrenIds: [...children[id]],
        })),
        rootId: 'root',
        version: 2,
    };
};

describe('lane reorder unit', () => {
    const tree = buildTreeFromChildren(laneTreeChildren);
    const unitOf = (nodeId: string, scope: TreeOperationScope) => {
        const unit = resolveLaneReorderUnit(tree, nodeId, scope);
        return unit === null ? null : `${unit.unitNodeId} in ${unit.parentNodeId} at ${unit.index}`;
    };

    test.each<[string, TreeOperationScope, string | null]>([
        // node, subtree: the nearest fork to the left of the grabbed node
        ['I', 'node', 'H in C at 1'],
        ['H', 'node', 'H in C at 1'],
        ['E', 'node', 'D in C at 0'],
        ['D', 'node', 'D in C at 0'],
        ['C', 'node', 'C in B at 0'],
        ['G', 'node', 'G in E at 1'],
        ['N', 'node', 'N in root at 1'],
        ['A', 'node', 'A in root at 0'],
        ['I', 'subtree', 'H in C at 1'],
        ['E', 'subtree', 'D in C at 0'],
        ['D', 'subtree', 'D in C at 0'],
        ['C', 'subtree', 'C in B at 0'],
        ['A', 'subtree', 'A in root at 0'],
        // descendants: the main line of the first fork at or after the grabbed node
        ['E', 'descendants', 'F in E at 0'],
        ['D', 'descendants', 'F in E at 0'],
        ['C', 'descendants', 'D in C at 0'],
        ['A', 'descendants', 'C in B at 0'],
        ['H', 'descendants', null],
        ['I', 'descendants', null],
        ['N', 'descendants', null],
    ])('grabbing %s with scope %s moves %s', (nodeId, scope, expected) => {
        expect(unitOf(nodeId, scope)).toBe(expected);
    });

    test('never moves the grabbed node under the descendants scope', () => {
        tree.nodes.filter(node => node.id !== 'root').forEach((node) => {
            const unit = resolveLaneReorderUnit(tree, node.id, 'descendants');
            if (unit === null) return;
            let ancestor = findNode(tree, node.id);
            while (ancestor) {
                expect(ancestor.id).not.toBe(unit.unitNodeId);
                ancestor = ancestor.parentId !== null ? findNode(tree, ancestor.parentId) : undefined;
            }
        });
    });

    test.each([
        ['two top-level branches', tree],
        ['a single top-level branch', buildTreeFromChildren({ ...laneTreeChildren, root: ['A'], N: [], O: [] })],
    ])('moves the same branch under the node and subtree scopes (%s)', (_, target) => {
        target.nodes.forEach((node) => {
            expect(resolveLaneReorderUnit(target, node.id, 'node'))
                .toEqual(resolveLaneReorderUnit(target, node.id, 'subtree'));
        });
    });

    test('resolves nothing left of every fork on a single top-level branch', () => {
        const single = buildTreeFromChildren({ ...laneTreeChildren, root: ['A'], N: [], O: [] });

        expect(resolveLaneReorderUnit(single, 'A', 'node')).toBeNull();
        expect(resolveLaneReorderUnit(single, 'B', 'node')).toBeNull();
    });

    test('resolves nothing for the virtual root, unknown ids, and a tree without forks', () => {
        const chain = buildTreeFromChildren({ root: ['A'], A: ['B'], B: [] });
        (['node', 'subtree', 'descendants'] as TreeOperationScope[]).forEach((scope) => {
            expect(resolveLaneReorderUnit(tree, 'root', scope)).toBeNull();
            expect(resolveLaneReorderUnit(tree, 'missing', scope)).toBeNull();
            expect(resolveLaneReorderUnit(chain, 'A', scope)).toBeNull();
            expect(resolveLaneReorderUnit(chain, 'B', scope)).toBeNull();
        });
    });
});

describe('moveChildToSlot', () => {
    const tree = buildTreeFromChildren(laneTreeChildren);
    const childrenAfter = (childId: string, slotIndex: number) => (
        findNode(moveChildToSlot(tree, 'C', childId, slotIndex), 'C')?.childrenIds
    );

    test('inserts the child at the slot and closes the gap it left', () => {
        expect(childrenAfter('H', 0)).toEqual(['H', 'D', 'J']);
        expect(childrenAfter('H', 3)).toEqual(['D', 'J', 'H']);
        expect(childrenAfter('D', 2)).toEqual(['H', 'D', 'J']);
        expect(childrenAfter('D', 3)).toEqual(['H', 'J', 'D']);
        expect(childrenAfter('J', 0)).toEqual(['J', 'D', 'H']);
        expect(childrenAfter('J', 1)).toEqual(['D', 'J', 'H']);
    });

    test('returns the same tree for the two slots around the child and for invalid slots', () => {
        [1, 2, -1, 4, 1.5, Number.NaN].forEach((slotIndex) => {
            expect(moveChildToSlot(tree, 'C', 'H', slotIndex)).toBe(tree);
        });
        expect(moveChildToSlot(tree, 'C', 'K', 0)).toBe(tree);
        expect(moveChildToSlot(tree, 'missing', 'H', 0)).toBe(tree);
    });

    test('changes no parent and keeps the tree valid', () => {
        const moved = moveChildToSlot(tree, 'root', 'A', 2);

        expect(findNode(moved, 'root')?.childrenIds).toEqual(['N', 'A']);
        moved.nodes.forEach((node) => {
            expect(node.parentId).toBe(findNode(tree, node.id)?.parentId);
        });
        expect(validateTree(moved).valid).toBe(true);
    });
});

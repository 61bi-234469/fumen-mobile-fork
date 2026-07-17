import {
    getBranchButtonOffset,
    getDeleteButtonOffset,
    getDragHandleOffset,
    getInsertButtonOffset,
    getNodeOccupiedHeight,
    getTreeCopyButtonDropTarget,
    TREE_BUTTON_HIT_RADIUS,
    TREE_DELETE_BUTTON_HIT_RADIUS,
    TREE_DELETE_BUTTON_SIZE,
    TREE_ADD_BUTTON_SIZE,
    TREE_DROP_BUTTON_SIZE,
    TREE_DRAG_HANDLE_HIT_RADIUS,
    TREE_NODE_FOOTER_HEIGHT,
    TREE_NODE_WIDTH,
} from '../tree_view_layout';
import { SerializedTree } from '../tree_types';

describe('tree_view_layout node control geometry', () => {
    const nodeHeight = 310; // full thumbnail (230) + extra height (80)

    test('add buttons follow the outgoing horizontal line and its branch curve', () => {
        const insert = getInsertButtonOffset(nodeHeight);
        const branch = getBranchButtonOffset(nodeHeight);
        const center = nodeHeight / 2;

        expect(insert.y).toBe(center);
        expect(insert.y).toBeLessThan(branch.y);
        expect(insert.x).toBe(branch.x);
    });

    test('a lone insert button stays at the connection-line level', () => {
        expect(getInsertButtonOffset(nodeHeight).y).toBe(nodeHeight / 2);
    });

    test('add buttons expose at least a 44px effective tap target', () => {
        expect(TREE_BUTTON_HIT_RADIUS * 2).toBeGreaterThanOrEqual(44);
        expect(TREE_DELETE_BUTTON_HIT_RADIUS * 2).toBeGreaterThanOrEqual(40);
    });

    test('drop targets visibly expand beyond the normal add buttons', () => {
        expect(TREE_DROP_BUTTON_SIZE).toBeGreaterThan(TREE_ADD_BUTTON_SIZE);
        expect(TREE_BUTTON_HIT_RADIUS * 2).toBeGreaterThanOrEqual(44);
    });

    test('delete button sits outside the field area at the card edge', () => {
        const deleteOffset = getDeleteButtonOffset();

        expect(deleteOffset.x - TREE_DELETE_BUTTON_SIZE / 2).toBeGreaterThan(TREE_NODE_WIDTH - 10);
    });

    test('occupied height covers the footer controls below the card', () => {
        const occupied = getNodeOccupiedHeight(nodeHeight);
        const handle = getDragHandleOffset(nodeHeight);

        expect(occupied).toBeGreaterThanOrEqual(nodeHeight + TREE_NODE_FOOTER_HEIGHT);
        expect(handle.y + TREE_DRAG_HANDLE_HIT_RADIUS).toBeLessThanOrEqual(occupied + 1);
    });

    test('add button hit areas stay within the occupied height even for small cards', () => {
        const smallHeight = 100; // trimmed thumbnail card
        const branch = getBranchButtonOffset(smallHeight);

        expect(branch.y + TREE_BUTTON_HIT_RADIUS).toBeLessThanOrEqual(getNodeOccupiedHeight(smallHeight));
        const insert = getInsertButtonOffset(smallHeight);
        expect(insert.y - TREE_BUTTON_HIT_RADIUS).toBeGreaterThanOrEqual(0);
    });
});

describe('tree_view_layout copy-position drop target', () => {
    const tree: SerializedTree = {
        rootId: 'virtual-root',
        version: 1,
        nodes: [
            { id: 'parent', parentId: 'virtual-root', pageIndex: 0, childrenIds: ['source', 'target'] },
            { id: 'source', parentId: 'parent', pageIndex: 1, childrenIds: [] },
            { id: 'target', parentId: 'parent', pageIndex: 2, childrenIds: [] },
            { id: 'virtual-root', parentId: null, pageIndex: -1, childrenIds: ['parent'] },
        ],
    };

    test('maps the blue plus position to the parent branch operation', () => {
        expect(getTreeCopyButtonDropTarget(tree, 'target', 'source', 'node'))
            .toEqual({ nodeId: 'parent', type: 'branch' });
    });

    test('does not expose the parent branch when it is hidden for a lone child', () => {
        const loneChildTree: SerializedTree = {
            ...tree,
            nodes: tree.nodes.map(node => node.id === 'parent'
                ? { ...node, childrenIds: ['source'] }
                : node.id === 'target'
                    ? { ...node, parentId: 'virtual-root' }
                    : node),
        };

        expect(getTreeCopyButtonDropTarget(loneChildTree, 'source', 'source', 'node'))
            .toBeNull();
    });
});

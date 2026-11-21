import {
    calculateTreeViewLayout,
    findTreeDropTarget,
    findTreeLaneDropSlot,
    getBranchButtonOffset,
    getDeleteButtonOffset,
    getDragHandleOffset,
    getInsertButtonOffset,
    getNodeOccupiedHeight,
    getRootGhostRect,
    getTreeCopyButtonDropTarget,
    getTreeLaneReorderGuides,
    TREE_BUTTON_HIT_RADIUS,
    TREE_LANE_SLOT_BUTTON_GUARD,
    TREE_PADDING,
    TREE_VERTICAL_GAP,
    TREE_DELETE_BUTTON_HIT_RADIUS,
    TREE_DELETE_BUTTON_SIZE,
    TREE_ADD_BUTTON_SIZE,
    TREE_DROP_BUTTON_SIZE,
    TREE_DRAG_HANDLE_HIT_RADIUS,
    TREE_NODE_FOOTER_HEIGHT,
    TREE_NODE_WIDTH,
} from '../tree_view_layout';
import { SerializedTree } from '../tree_types';
import { Field } from '../field';
import { Page } from '../types';

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

describe('tree_view_layout lane reorder', () => {
    // Lanes: 0 = a b c / 1 = d / 2 = e f / 3 = g, forked at b ([c, e, g]) and at c ([-, d])
    const tree: SerializedTree = {
        rootId: 'root',
        version: 2,
        nodes: [
            { id: 'root', parentId: null, pageIndex: -1, childrenIds: ['a'] },
            { id: 'a', parentId: 'root', pageIndex: 0, childrenIds: ['b'] },
            { id: 'b', parentId: 'a', pageIndex: 1, childrenIds: ['c', 'e', 'g'] },
            { id: 'c', parentId: 'b', pageIndex: 2, childrenIds: ['x', 'd'] },
            { id: 'x', parentId: 'c', pageIndex: 3, childrenIds: [] },
            { id: 'd', parentId: 'c', pageIndex: 4, childrenIds: [] },
            { id: 'e', parentId: 'b', pageIndex: 5, childrenIds: ['f'] },
            { id: 'f', parentId: 'e', pageIndex: 6, childrenIds: [] },
            { id: 'g', parentId: 'b', pageIndex: 7, childrenIds: [] },
        ],
    };
    const pages: Page[] = Array.from({ length: 8 }, (_, index) => ({
        index,
        field: index === 0 ? { obj: new Field({}) } : { ref: 0 },
        comment: { text: '' },
        flags: { lock: false, mirror: false, colorize: true, rise: false, quiz: false },
    }));
    const layout = calculateTreeViewLayout(tree, pages, false);
    // Grabbing f moves the e branch (lane 2) among b's children [c, e, g].
    const guides = getTreeLaneReorderGuides(tree, layout, 'f', 'node')!;

    test('puts one line in every gap around the sibling branches', () => {
        const lane = (index: number) => TREE_PADDING + layout.laneOffsets[index];

        expect(guides.unit).toEqual({ unitNodeId: 'e', parentNodeId: 'b', index: 1 });
        expect(guides.slotYs).toEqual([
            lane(0) - TREE_VERTICAL_GAP / 2,
            lane(2) - TREE_VERTICAL_GAP / 2,
            lane(3) - TREE_VERTICAL_GAP / 2,
            lane(3) + layout.laneHeights[3] + TREE_VERTICAL_GAP / 2,
        ]);
        expect(guides.lineStartX).toBeLessThan(layout.nodeLayouts.get('e')!.x);
        expect(guides.lineStartX).toBeGreaterThan(layout.nodeLayouts.get('b')!.x + TREE_NODE_WIDTH);
    });

    test.each([false, true])('keeps every line clear of cards and their footer controls (trim %s)', (trim) => {
        const trimmedLayout = calculateTreeViewLayout(tree, pages, trim);
        tree.nodes.filter(node => node.pageIndex >= 0).forEach((node) => {
            const lines = getTreeLaneReorderGuides(tree, trimmedLayout, node.id, 'subtree');
            if (lines === null) return;
            lines.slotYs.forEach((y) => {
                trimmedLayout.nodeLayouts.forEach((nodeLayout) => {
                    const overlaps = nodeLayout.y <= y && y <= nodeLayout.y + nodeLayout.occupiedHeight;
                    expect(overlaps).toBe(false);
                });
            });
        });
    });

    test('has no guides when no branch can be reordered', () => {
        expect(getTreeLaneReorderGuides(tree, layout, 'a', 'node')).toBeNull();
        expect(getTreeLaneReorderGuides(tree, layout, 'g', 'descendants')).toBeNull();
    });

    test('selects the line above for the upper half of a band and the line below for the lower half', () => {
        const [top, aboveE, aboveG, bottom] = guides.slotYs;

        // Band of the c branch (lanes 0-1): upper half -> slot 0; lower half -> slot 1 (no-op beside e)
        expect(findTreeLaneDropSlot(guides, top + 1)).toBe(0);
        expect(findTreeLaneDropSlot(guides, aboveE - 1)).toBeNull();
        // Own band
        expect(findTreeLaneDropSlot(guides, (aboveE + aboveG) / 2)).toBeNull();
        // Band of g: upper half -> slot 2 (no-op beside e); lower half -> slot 3
        expect(findTreeLaneDropSlot(guides, aboveG + 1)).toBeNull();
        expect(findTreeLaneDropSlot(guides, bottom - 1)).toBe(3);
    });

    test('reaches the outer slots within one lane gap beyond the range, and nothing farther out', () => {
        const [top, , , bottom] = guides.slotYs;

        expect(findTreeLaneDropSlot(guides, top - TREE_VERTICAL_GAP)).toBe(0);
        expect(findTreeLaneDropSlot(guides, top - TREE_VERTICAL_GAP - 1)).toBeNull();
        expect(findTreeLaneDropSlot(guides, bottom + TREE_VERTICAL_GAP)).toBe(3);
        expect(findTreeLaneDropSlot(guides, bottom + TREE_VERTICAL_GAP + 1)).toBeNull();
    });

    describe('combined drop target', () => {
        const target = (x: number, y: number, options?: { allowLaneSlot?: boolean }) => (
            findTreeDropTarget(tree, layout, x, y, 'f', 'node', options)
        );
        const gLayout = layout.nodeLayouts.get('g')!;
        const cLayout = layout.nodeLayouts.get('c')!;
        // Lower half of g's band, on the card body away from every button
        const slotPoint = { x: gLayout.x + 30, y: gLayout.y + gLayout.height * 0.75 };

        test('resolves a lane slot from the height alone, whatever the x position', () => {
            expect(target(slotPoint.x, slotPoint.y)).toEqual({ kind: 'lane', slotIndex: 3 });
            // Left of the guide lines, e.g. straight below the handle of the fork itself
            expect(target(2, slotPoint.y)).toEqual({ kind: 'lane', slotIndex: 3 });
            expect(target(5000, slotPoint.y)).toEqual({ kind: 'lane', slotIndex: 3 });
        });

        test('prefers an add button and keeps a guard ring around it', () => {
            const insert = getInsertButtonOffset(cLayout.height);
            const center = { x: cLayout.x + insert.x, y: cLayout.y + insert.y };

            expect(target(center.x, center.y)).toEqual({ kind: 'button', nodeId: 'c', type: 'insert' });
            const justOutside = TREE_BUTTON_HIT_RADIUS + 1;
            expect(target(center.x, center.y - justOutside)).toBeNull();
            const beyondGuard = TREE_BUTTON_HIT_RADIUS + TREE_LANE_SLOT_BUTTON_GUARD + 1;
            expect(target(center.x, center.y - beyondGuard)).toEqual({ kind: 'lane', slotIndex: 0 });
        });

        test('returns only buttons when lane slots are not allowed', () => {
            expect(target(slotPoint.x, slotPoint.y, { allowLaneSlot: false })).toBeNull();
        });

        test('lets the root add frame win inside it and falls back to the slot just outside', () => {
            const ghost = getRootGhostRect(layout.contentHeight);

            expect(target(ghost.x + ghost.width / 2, ghost.y + 1))
                .toEqual({ kind: 'button', nodeId: 'root', type: 'branch' });
            // Above the frame: still within one lane gap below the last line
            expect(target(ghost.x + ghost.width / 2, ghost.y - 1)).toEqual({ kind: 'lane', slotIndex: 3 });
        });
    });
});

import {
    getBranchButtonOffset,
    getChildCountBadgeOffset,
    getDeleteButtonOffset,
    getDragHandleOffset,
    getInsertButtonOffset,
    getNodeOccupiedHeight,
    TREE_BUTTON_HIT_RADIUS,
    TREE_DELETE_BUTTON_HIT_RADIUS,
    TREE_CHILD_COUNT_BADGE_RADIUS,
    TREE_DRAG_HANDLE_HIT_RADIUS,
    TREE_NODE_FOOTER_HEIGHT,
} from '../tree_view_layout';

describe('tree_view_layout node control geometry', () => {
    const nodeHeight = 310; // full thumbnail (230) + extra height (80)

    test('two add buttons are placed symmetrically around the card center', () => {
        const insert = getInsertButtonOffset(nodeHeight, true);
        const branch = getBranchButtonOffset(nodeHeight);
        const center = nodeHeight / 2;

        expect(center - insert.y).toBeCloseTo(branch.y - center);
        expect(insert.y).toBeLessThan(branch.y);
        expect(insert.x).toBe(branch.x);
    });

    test('a lone insert button stays at the connection-line level', () => {
        expect(getInsertButtonOffset(nodeHeight, false).y).toBe(nodeHeight / 2);
    });

    test('add buttons expose at least a 44px effective tap target', () => {
        expect(TREE_BUTTON_HIT_RADIUS * 2).toBeGreaterThanOrEqual(44);
        expect(TREE_DELETE_BUTTON_HIT_RADIUS * 2).toBeGreaterThanOrEqual(40);
    });

    test('delete button (top-right) and child-count badge (top-left) do not overlap', () => {
        const deleteOffset = getDeleteButtonOffset();
        const badgeOffset = getChildCountBadgeOffset();
        const distance = Math.hypot(deleteOffset.x - badgeOffset.x, deleteOffset.y - badgeOffset.y);

        expect(distance).toBeGreaterThan(TREE_DELETE_BUTTON_HIT_RADIUS + TREE_CHILD_COUNT_BADGE_RADIUS);
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
        const insert = getInsertButtonOffset(smallHeight, true);
        expect(insert.y - TREE_BUTTON_HIT_RADIUS).toBeGreaterThanOrEqual(0);
    });
});

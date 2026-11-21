import { Page } from './types';
import {
    LaneReorderUnit,
    SerializedTree,
    TreeDropTarget,
    TreeLayout,
    TreeNodeId,
    TreeOperationScope,
} from './tree_types';
import {
    calculateTreeLayout,
    canMoveScope,
    findNode,
    getDescendants,
    isVirtualNode,
    resolveLaneReorderUnit,
} from './tree_utils';
import { getThumbnailHeight, THUMBNAIL_HEIGHT, THUMBNAIL_WIDTH } from '../thumbnail';

export const TREE_THUMBNAIL_WIDTH = THUMBNAIL_WIDTH;
export const TREE_THUMBNAIL_HEIGHT = THUMBNAIL_HEIGHT;
export const TREE_NODE_WIDTH = TREE_THUMBNAIL_WIDTH + 20;
export const TREE_NODE_RADIUS = 8;
export const TREE_HORIZONTAL_GAP = 50;
export const TREE_VERTICAL_GAP = 30;
export const TREE_PADDING = 20;
export const TREE_SCROLL_PADDING_RIGHT = 150;
export const TREE_SCROLL_PADDING_BOTTOM = 150;

// Header strip at the top of the card: drag handle, page number, delete.
export const TREE_NODE_HEADER_HEIGHT = 24;
// The handle stays easy to grab: its hit area reaches above the card and a
// little below the strip, without touching the thumbnail.
export const TREE_NODE_HEADER_HIT_ABOVE = 10;
export const TREE_NODE_HEADER_HIT_BELOW = 4;
export const TREE_THUMBNAIL_TOP = TREE_NODE_HEADER_HEIGHT + 6;

export const TREE_COMMENT_MARGIN_X = 8;
// Measured from the card top, excluding the thumbnail height.
export const TREE_COMMENT_TOP_OFFSET = TREE_THUMBNAIL_TOP + 8;
export const TREE_COMMENT_HEIGHT = 40;
export const TREE_COMMENT_BOTTOM_PADDING = 8;
export const TREE_COMMENT_WIDTH = TREE_NODE_WIDTH - TREE_COMMENT_MARGIN_X * 2;
export const TREE_NODE_EXTRA_HEIGHT =
    TREE_COMMENT_TOP_OFFSET + TREE_COMMENT_HEIGHT + TREE_COMMENT_BOTTOM_PADDING;

// Insert (primary, on the outgoing connection) and Branch (secondary, below it).
export const TREE_ADD_BUTTON_SIZE = 24;
export const TREE_BRANCH_BUTTON_SIZE = 22;
export const TREE_DROP_BUTTON_SIZE = 32;
export const TREE_BUTTON_X = TREE_NODE_WIDTH + TREE_HORIZONTAL_GAP / 2;

// Insert/Branch grow only slightly while dragging, while the invisible hit area
// still provides the 44px mobile target size.
export const TREE_BUTTON_HIT_RADIUS = 22;
// Branch starts where the Insert hit area ends, so a tap on the visible Branch
// button never resolves to Insert.
export const TREE_BRANCH_BUTTON_OFFSET_Y = TREE_BUTTON_HIT_RADIUS + TREE_ADD_BUTTON_SIZE / 2;

// Delete icon (right end of the header strip)
export const TREE_DELETE_BUTTON_HIT_RADIUS = 20;

// Page number pill (center of the header strip)
export const TREE_PAGE_LINK_HEIGHT = 17;

// Copy button (straddles the bottom edge, centered)
export const TREE_COPY_BUTTON_SIZE = 22;
export const TREE_COPY_BUTTON_MARGIN_BOTTOM = -6;
export const TREE_COPY_BUTTON_HIT_RADIUS = TREE_COPY_BUTTON_SIZE / 2 + 6;

// Lane reorder: a pointer this close outside a valid drop button's hit area never
// resolves to a lane slot, so a slightly missed button does not reorder lanes.
export const TREE_LANE_SLOT_BUTTON_GUARD = 22;

// Footer strip occupied by the copy button below the card.
// Included in the lane height so adjacent lanes never overlap this control.
export const TREE_NODE_FOOTER_HEIGHT =
    TREE_COPY_BUTTON_MARGIN_BOTTOM + TREE_COPY_BUTTON_SIZE / 2 + TREE_COPY_BUTTON_HIT_RADIUS;

// Node-relative geometry for the controls, shared between rendering (fumen_graph.tsx)
// and hit-testing (drop targets here, touch taps in views/list_view.ts).
// Insert sits on the outgoing horizontal connection, halfway to the next column.
// Branch sits below it, near the downward curve.
export const getInsertButtonOffset = (nodeHeight: number) =>
    ({ x: TREE_BUTTON_X, y: nodeHeight / 2 });
export const getBranchButtonOffset = (nodeHeight: number) =>
    ({ x: TREE_BUTTON_X, y: nodeHeight / 2 + TREE_BRANCH_BUTTON_OFFSET_Y });
export const getDeleteButtonOffset = () =>
    ({ x: TREE_NODE_WIDTH - 14, y: TREE_NODE_HEADER_HEIGHT / 2 });
export const getCopyButtonOffset = (nodeHeight: number) =>
    ({ x: TREE_NODE_WIDTH / 2, y: nodeHeight + TREE_COPY_BUTTON_MARGIN_BOTTOM + TREE_COPY_BUTTON_SIZE / 2 });

interface TreeNodeRect {
    x: number;
    y: number;
    width: number;
    height: number;
}

/** Grab area of the drag handle: the header strip plus its margins. */
export const getDragHandleRect = (): TreeNodeRect => ({
    x: 0,
    y: -TREE_NODE_HEADER_HIT_ABOVE,
    width: TREE_NODE_WIDTH,
    height: TREE_NODE_HEADER_HIT_ABOVE + TREE_NODE_HEADER_HEIGHT + TREE_NODE_HEADER_HIT_BELOW,
});

/** Page number pill; it grows with the number of digits. */
export const getPageLinkRect = (pageNumber: number): TreeNodeRect => {
    const width = 14 + `#${pageNumber}`.length * 8;
    return {
        width,
        x: (TREE_NODE_WIDTH - width) / 2,
        y: (TREE_NODE_HEADER_HEIGHT - TREE_PAGE_LINK_HEIGHT) / 2,
        height: TREE_PAGE_LINK_HEIGHT,
    };
};

export const isInsideTreeNodeRect = (rect: TreeNodeRect, x: number, y: number): boolean =>
    x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;

/**
 * Resolve the blue copy-position drop target for a node while another node is
 * being dragged. The copy position is visually attached to the node, but its
 * operation is the same as dropping onto that node's parent branch button.
 */
export const getTreeCopyButtonDropTarget = (
    tree: SerializedTree,
    nodeId: TreeNodeId,
    sourceNodeId: TreeNodeId,
    scope: TreeOperationScope,
): { nodeId: TreeNodeId; type: 'branch' } | null => {
    const node = findNode(tree, nodeId);
    if (!node || isVirtualNode(node) || node.parentId === null) return null;

    const parentNode = findNode(tree, node.parentId);
    if (!parentNode) return null;

    const sourceNode = findNode(tree, sourceNodeId);
    const hideBranchButton = sourceNode?.parentId === parentNode.id
        && parentNode.childrenIds.length <= 1
        && scope !== 'descendants';
    const canUseParentBranch = parentNode.childrenIds.length > 0 || isVirtualNode(parentNode);
    if (!canUseParentBranch || hideBranchButton
        || !canMoveScope(tree, sourceNodeId, parentNode.id, scope, 'branch')) {
        return null;
    }

    return { nodeId: parentNode.id, type: 'branch' };
};

/**
 * Total vertical space a node occupies inside its lane: the card itself, the
 * footer controls below it, and the enlarged add-button hit areas (whichever
 * extends lower).
 */
export const getNodeOccupiedHeight = (nodeHeight: number): number => {
    const buttonsBottom = getBranchButtonOffset(nodeHeight).y + TREE_BUTTON_HIT_RADIUS;
    return Math.max(nodeHeight + TREE_NODE_FOOTER_HEIGHT, buttonsBottom);
};

// Root ghost frame (branch-drop target onto the virtual root / new top-level add) rectangle.
export const getRootGhostRect = (contentHeight: number) => {
    const minH = TREE_THUMBNAIL_HEIGHT + TREE_NODE_EXTRA_HEIGHT;
    const width = Math.max(72, Math.round(TREE_NODE_WIDTH * 0.72));
    const height = Math.max(56, Math.round(minH * 0.38));
    return {
        width, height,
        x: TREE_PADDING + (TREE_NODE_WIDTH - width) / 2,
        y: TREE_PADDING + contentHeight + TREE_VERTICAL_GAP,
    };
};

export interface TreeNodeLayout {
    id: TreeNodeId;
    x: number;
    y: number;
    width: number;
    height: number;
    occupiedHeight: number;
    lane: number;
    laneHeight: number;
    thumbnailHeight: number;
}

export interface TreeViewLayout {
    layout: TreeLayout;
    nodeLayouts: Map<TreeNodeId, TreeNodeLayout>;
    laneHeights: number[];
    laneOffsets: number[];
    contentHeight: number;
}

export const calculateTreeViewLayout = (
    tree: SerializedTree,
    pages: Page[],
    trimTopBlank: boolean,
    nodeExtraHeight: number = TREE_NODE_EXTRA_HEIGHT,
): TreeViewLayout => {
    const layout = calculateTreeLayout(tree);
    const nodeLayouts = new Map<TreeNodeId, TreeNodeLayout>();
    const laneHeights = Array(layout.maxLane + 1).fill(0);
    const nodeHeights = new Map<TreeNodeId, {
        height: number;
        occupiedHeight: number;
        thumbnailHeight: number;
    }>();

    tree.nodes
        .filter(node => !isVirtualNode(node))
        .forEach((node) => {
            const pos = layout.positions.get(node.id);
            if (!pos) return;

            const thumbnailHeight = getThumbnailHeight(pages, node.pageIndex, trimTopBlank);
            const nodeHeight = thumbnailHeight + nodeExtraHeight;
            const occupiedHeight = getNodeOccupiedHeight(nodeHeight);

            nodeHeights.set(node.id, { thumbnailHeight, occupiedHeight, height: nodeHeight });
            laneHeights[pos.y] = Math.max(laneHeights[pos.y], occupiedHeight);
        });

    const laneOffsets: number[] = [];
    let offset = 0;
    for (let lane = 0; lane <= layout.maxLane; lane += 1) {
        laneOffsets[lane] = offset;
        offset += laneHeights[lane] + TREE_VERTICAL_GAP;
    }

    nodeHeights.forEach((metrics, nodeId) => {
        const pos = layout.positions.get(nodeId);
        if (!pos) return;

        const laneHeight = laneHeights[pos.y] ?? metrics.occupiedHeight;
        const x = TREE_PADDING + pos.x * (TREE_NODE_WIDTH + TREE_HORIZONTAL_GAP);
        const laneOffset = trimTopBlank
            ? (laneHeight - metrics.occupiedHeight) / 2
            : (laneHeight - metrics.occupiedHeight);
        const y = TREE_PADDING + laneOffsets[pos.y] + laneOffset;

        nodeLayouts.set(nodeId, {
            x,
            y,
            laneHeight,
            id: nodeId,
            thumbnailHeight: metrics.thumbnailHeight,
            width: TREE_NODE_WIDTH,
            height: metrics.height,
            occupiedHeight: metrics.occupiedHeight,
            lane: pos.y,
        });
    });

    const hasLanes = layout.maxLane >= 0 && laneOffsets.length > 0 && laneHeights.length > 0;
    const contentHeight = hasLanes
        ? laneOffsets[layout.maxLane] + laneHeights[layout.maxLane]
        : 0;

    return {
        layout,
        nodeLayouts,
        laneHeights,
        laneOffsets,
        contentHeight,
    };
};

/**
 * Hit-test the enlarged insert/branch drop targets (and the root ghost frame)
 * for an active drag. Shared by the mouse handler (fumen_graph.tsx), the touch
 * handler (views/list_view.ts), and the auto-scroll re-evaluation so all input
 * paths agree on the same geometry and validity rules.
 *
 * Coordinates are pre-scale SVG (tree) coordinates.
 */
export const findTreeButtonDropTarget = (
    tree: SerializedTree,
    treeViewLayout: TreeViewLayout,
    svgX: number,
    svgY: number,
    sourceNodeId: TreeNodeId,
    scope: TreeOperationScope,
    // Widens the circular button hit areas (not the root ghost frame).
    hitMargin: number = 0,
): { nodeId: TreeNodeId; type: 'insert' | 'branch' } | null => {
    const sourceNode = findNode(tree, sourceNodeId);
    const sourceParentId = sourceNode?.parentId ?? null;

    // Top-level ghost frame acts as a branch drop onto the virtual root.
    const rootNode = tree.rootId ? findNode(tree, tree.rootId) : undefined;
    const canDropOnRootGhost = tree.rootId !== null
        && sourceNodeId !== tree.rootId
        && rootNode !== undefined
        && isVirtualNode(rootNode)
        && canMoveScope(tree, sourceNodeId, tree.rootId, scope, 'branch');
    if (canDropOnRootGhost && tree.rootId !== null) {
        const ghostRect = getRootGhostRect(treeViewLayout.contentHeight);
        if (svgX >= ghostRect.x && svgX <= ghostRect.x + ghostRect.width
            && svgY >= ghostRect.y && svgY <= ghostRect.y + ghostRect.height) {
            return { nodeId: tree.rootId, type: 'branch' };
        }
    }

    for (const node of tree.nodes) {
        const nodeLayout = treeViewLayout.nodeLayouts.get(node.id);
        if (!nodeLayout) continue;

        // The copy position becomes a blue branch-drop target while dragging.
        // It intentionally resolves to the branch button of this node's parent.
        const copyDropTarget = getTreeCopyButtonDropTarget(
            tree,
            node.id,
            sourceNodeId,
            scope,
        );
        if (copyDropTarget !== null) {
            const copyOffset = getCopyButtonOffset(nodeLayout.height);
            const distToCopy = Math.hypot(
                svgX - (nodeLayout.x + copyOffset.x),
                svgY - (nodeLayout.y + copyOffset.y),
            );
            if (distToCopy <= TREE_COPY_BUTTON_HIT_RADIUS + hitMargin) {
                return copyDropTarget;
            }
        }

        const isValidTarget = canMoveScope(tree, sourceNodeId, node.id, scope, 'insert')
            || canMoveScope(tree, sourceNodeId, node.id, scope, 'branch');
        if (!isValidTarget) continue;

        const hasBranchButton = node.childrenIds.length > 0;

        // Insert is invalid on the source's own parent (formerly the drag-delete drop).
        if (canMoveScope(tree, sourceNodeId, node.id, scope, 'insert')) {
            const insertOffset = getInsertButtonOffset(nodeLayout.height);
            const distToInsert = Math.hypot(
                svgX - (nodeLayout.x + insertOffset.x),
                svgY - (nodeLayout.y + insertOffset.y),
            );
            if (distToInsert <= TREE_BUTTON_HIT_RADIUS + hitMargin) {
                return { nodeId: node.id, type: 'insert' };
            }
        }

        const hideBranchButton = sourceParentId === node.id && node.childrenIds.length <= 1
            && scope !== 'descendants';
        if (hasBranchButton && !hideBranchButton && canMoveScope(tree, sourceNodeId, node.id, scope, 'branch')) {
            const branchOffset = getBranchButtonOffset(nodeLayout.height);
            const distToBranch = Math.hypot(
                svgX - (nodeLayout.x + branchOffset.x),
                svgY - (nodeLayout.y + branchOffset.y),
            );
            if (distToBranch <= TREE_BUTTON_HIT_RADIUS + hitMargin) {
                return { nodeId: node.id, type: 'branch' };
            }
        }
    }

    return null;
};

export interface TreeLaneReorderGuides {
    unit: LaneReorderUnit;
    /** Y of every slot line; index = slot (0 .. number of siblings) */
    slotYs: number[];
    /** Left end of the drawn guide lines */
    lineStartX: number;
    /** Left edge of the moving branch (its first node) */
    blockX: number;
}

/**
 * Geometry of a lane reorder for the grabbed node: one horizontal line per slot
 * between the sibling branches of the reordered fork. A branch always occupies
 * consecutive lanes, so every line runs through the gap between two lanes.
 *
 * Coordinates are pre-scale SVG (tree) coordinates.
 */
export const getTreeLaneReorderGuides = (
    tree: SerializedTree,
    treeViewLayout: TreeViewLayout,
    sourceNodeId: TreeNodeId,
    scope: TreeOperationScope,
): TreeLaneReorderGuides | null => {
    const unit = resolveLaneReorderUnit(tree, sourceNodeId, scope);
    if (unit === null) return null;

    const parent = findNode(tree, unit.parentNodeId);
    const unitLayout = treeViewLayout.nodeLayouts.get(unit.unitNodeId);
    if (!parent || !unitLayout) return null;

    const { positions } = treeViewLayout.layout;
    const { laneOffsets, laneHeights } = treeViewLayout;
    const slotYs: number[] = [];
    for (const childId of parent.childrenIds) {
        const lane = positions.get(childId)?.y;
        if (lane === undefined || laneOffsets[lane] === undefined) return null;
        slotYs.push(TREE_PADDING + laneOffsets[lane] - TREE_VERTICAL_GAP / 2);
    }

    const lastChildId = parent.childrenIds[parent.childrenIds.length - 1];
    const lastLane = getDescendants(tree, lastChildId)
        .reduce((max, id) => Math.max(max, positions.get(id)?.y ?? -1), -1);
    if (lastLane < 0 || laneOffsets[lastLane] === undefined) return null;
    slotYs.push(TREE_PADDING + laneOffsets[lastLane] + laneHeights[lastLane] + TREE_VERTICAL_GAP / 2);

    return {
        unit,
        slotYs,
        // Siblings share one column, so the moving branch's own x is that column.
        lineStartX: Math.max(TREE_PADDING / 2, unitLayout.x - TREE_HORIZONTAL_GAP / 2),
        blockX: unitLayout.x,
    };
};

/**
 * Resolve the slot for a pointer height: the upper half of a sibling branch's band
 * selects the line above it, the lower half the line below. The moving branch's
 * own band and the two lines around it change nothing and yield null.
 */
export const findTreeLaneDropSlot = (guides: TreeLaneReorderGuides, svgY: number): number | null => {
    const ys = guides.slotYs;
    const last = ys.length - 1;
    const current = guides.unit.index;
    if (svgY < ys[0] - TREE_VERTICAL_GAP || svgY > ys[last] + TREE_VERTICAL_GAP) return null;

    let slot: number;
    if (svgY <= ys[0]) {
        slot = 0;
    } else if (svgY >= ys[last]) {
        slot = last;
    } else {
        let band = 0;
        while (band < last - 1 && svgY >= ys[band + 1]) {
            band += 1;
        }
        if (band === current) return null;
        slot = svgY < (ys[band] + ys[band + 1]) / 2 ? band : band + 1;
    }
    return slot === current || slot === current + 1 ? null : slot;
};

/**
 * Resolve the drop target for an active drag: the existing add buttons win, then
 * a lane slot. Shared by pointer moves, auto-scroll frames, and the release point
 * so every input path agrees.
 *
 * Coordinates are pre-scale SVG (tree) coordinates.
 */
export const findTreeDropTarget = (
    tree: SerializedTree,
    treeViewLayout: TreeViewLayout,
    svgX: number,
    svgY: number,
    sourceNodeId: TreeNodeId,
    scope: TreeOperationScope,
    options: { allowLaneSlot?: boolean } = {},
): TreeDropTarget | null => {
    const button = findTreeButtonDropTarget(tree, treeViewLayout, svgX, svgY, sourceNodeId, scope);
    if (button !== null) {
        return { kind: 'button', nodeId: button.nodeId, type: button.type };
    }
    if (options.allowLaneSlot === false) return null;

    const guides = getTreeLaneReorderGuides(tree, treeViewLayout, sourceNodeId, scope);
    if (guides === null) return null;

    const slotIndex = findTreeLaneDropSlot(guides, svgY);
    if (slotIndex === null) return null;

    const nearButton = findTreeButtonDropTarget(
        tree, treeViewLayout, svgX, svgY, sourceNodeId, scope, TREE_LANE_SLOT_BUTTON_GUARD,
    ) !== null;
    return nearButton ? null : { slotIndex, kind: 'lane' };
};

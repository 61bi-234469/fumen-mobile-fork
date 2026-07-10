import { Page } from './types';
import { SerializedTree, TreeLayout, TreeNodeId } from './tree_types';
import { calculateTreeLayout, canMoveNode, findNode, isVirtualNode } from './tree_utils';
import { getThumbnailHeight, THUMBNAIL_HEIGHT, THUMBNAIL_WIDTH } from '../thumbnail';

export const TREE_THUMBNAIL_WIDTH = THUMBNAIL_WIDTH;
export const TREE_THUMBNAIL_HEIGHT = THUMBNAIL_HEIGHT;
export const TREE_NODE_WIDTH = TREE_THUMBNAIL_WIDTH + 20;
export const TREE_NODE_EXTRA_HEIGHT = 80;
export const TREE_NODE_RADIUS = 8;
export const TREE_HORIZONTAL_GAP = 50;
export const TREE_VERTICAL_GAP = 30;
export const TREE_PADDING = 20;
export const TREE_SCROLL_PADDING_RIGHT = 150;
export const TREE_SCROLL_PADDING_BOTTOM = 150;
export const TREE_ADD_BUTTON_SIZE = 40;
export const TREE_ADD_BUTTON_GAP = 8;
export const TREE_BUTTON_X = TREE_NODE_WIDTH + 4;
export const TREE_PAGE_NUMBER_OFFSET = 24;
export const TREE_COMMENT_MARGIN_X = 8;
export const TREE_COMMENT_TOP_OFFSET = 32;
export const TREE_COMMENT_BOTTOM_PADDING = 8;
export const TREE_COMMENT_WIDTH = TREE_NODE_WIDTH - TREE_COMMENT_MARGIN_X * 2;
export const TREE_COMMENT_HEIGHT =
    TREE_NODE_EXTRA_HEIGHT - TREE_COMMENT_TOP_OFFSET - TREE_COMMENT_BOTTOM_PADDING;

// Permanent delete button (top-right corner of the card)
export const TREE_DELETE_BUTTON_SIZE = 22;
export const TREE_DELETE_BUTTON_HIT_RADIUS = 20;

// Children-count badge (top-left corner of the card, display only)
export const TREE_CHILD_COUNT_BADGE_RADIUS = 9;

// Copy button (below the node, centered)
export const TREE_COPY_BUTTON_SIZE = 22;
export const TREE_COPY_BUTTON_MARGIN_BOTTOM = -6;

// Drag handle (below the node, right-aligned)
export const TREE_DRAG_HANDLE_SIZE = 22;
export const TREE_DRAG_HANDLE_HIT_RADIUS = 20;

// Shared button hit-test radii. The add buttons get a ~48px effective tap target;
// visible size and hit area are decoupled on purpose.
export const TREE_BUTTON_HIT_RADIUS = TREE_ADD_BUTTON_SIZE / 2 + 4;
export const TREE_COPY_BUTTON_HIT_RADIUS = TREE_COPY_BUTTON_SIZE / 2 + 6;

// Footer strip occupied by the copy button / drag handle below the card.
// Included in the lane height so adjacent lanes never overlap these controls.
export const TREE_NODE_FOOTER_HEIGHT =
    TREE_COPY_BUTTON_MARGIN_BOTTOM + TREE_DRAG_HANDLE_SIZE / 2 + TREE_DRAG_HANDLE_HIT_RADIUS;

// Node-relative offsets for buttons/badges, shared between rendering (fumen_graph.tsx)
// and hit-testing (fumen_graph.tsx mouse handler, views/list_view.ts touch handlers).
// When both add buttons are visible they are placed symmetrically around the card center;
// a lone insert button stays at the center (connection-line level).
export const getInsertButtonOffset = (nodeHeight: number, hasBranchButton: boolean) =>
    hasBranchButton
        ? { x: TREE_BUTTON_X, y: nodeHeight / 2 - (TREE_ADD_BUTTON_SIZE + TREE_ADD_BUTTON_GAP) / 2 }
        : { x: TREE_BUTTON_X, y: nodeHeight / 2 };
export const getBranchButtonOffset = (nodeHeight: number) =>
    ({ x: TREE_BUTTON_X, y: nodeHeight / 2 + (TREE_ADD_BUTTON_SIZE + TREE_ADD_BUTTON_GAP) / 2 });
export const getDeleteButtonOffset = () =>
    ({ x: TREE_NODE_WIDTH - 10, y: 10 });
export const getChildCountBadgeOffset = () =>
    ({ x: 10, y: 10 });
export const getCopyButtonOffset = (nodeHeight: number) =>
    ({ x: TREE_NODE_WIDTH / 2, y: nodeHeight + TREE_COPY_BUTTON_MARGIN_BOTTOM + TREE_COPY_BUTTON_SIZE / 2 });
export const getDragHandleOffset = (nodeHeight: number) =>
    ({ x: TREE_NODE_WIDTH - 16, y: nodeHeight + TREE_COPY_BUTTON_MARGIN_BOTTOM + TREE_DRAG_HANDLE_SIZE / 2 });

/**
 * Total vertical space a node occupies inside its lane: the card itself, the
 * footer controls below it, and the enlarged add-button hit areas (whichever
 * extends lower).
 */
export const getNodeOccupiedHeight = (nodeHeight: number): number => {
    const buttonsBottom = nodeHeight / 2 + (TREE_ADD_BUTTON_SIZE + TREE_ADD_BUTTON_GAP) / 2 + TREE_BUTTON_HIT_RADIUS;
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
            const nodeHeight = thumbnailHeight + TREE_NODE_EXTRA_HEIGHT;
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
    buttonDropMovesSubtree: boolean,
): { nodeId: TreeNodeId; type: 'insert' | 'branch' } | null => {
    const sourceNode = findNode(tree, sourceNodeId);
    const sourceParentId = sourceNode?.parentId ?? null;
    const allowDescendant = !buttonDropMovesSubtree;
    const isRootDragSource = buttonDropMovesSubtree
        && tree.rootId !== null && sourceNodeId === tree.rootId;

    // Top-level ghost frame acts as a branch drop onto the virtual root.
    const rootNode = tree.rootId ? findNode(tree, tree.rootId) : undefined;
    const canDropOnRootGhost = tree.rootId !== null
        && sourceNodeId !== tree.rootId
        && rootNode !== undefined
        && isVirtualNode(rootNode)
        && canMoveNode(tree, sourceNodeId, tree.rootId, { allowDescendant });
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

        const isValidTarget = node.id !== sourceNodeId
            && !isRootDragSource
            && canMoveNode(tree, sourceNodeId, node.id, { allowDescendant });
        if (!isValidTarget) continue;

        const hasBranchButton = node.childrenIds.length > 0;

        // Insert is invalid on the source's own parent (formerly the drag-delete drop).
        if (sourceParentId !== node.id) {
            const insertOffset = getInsertButtonOffset(nodeLayout.height, hasBranchButton);
            const distToInsert = Math.hypot(
                svgX - (nodeLayout.x + insertOffset.x),
                svgY - (nodeLayout.y + insertOffset.y),
            );
            if (distToInsert <= TREE_BUTTON_HIT_RADIUS) {
                return { nodeId: node.id, type: 'insert' };
            }
        }

        const hideBranchButton = sourceParentId === node.id && node.childrenIds.length <= 1;
        if (hasBranchButton && !hideBranchButton) {
            const branchOffset = getBranchButtonOffset(nodeLayout.height);
            const distToBranch = Math.hypot(
                svgX - (nodeLayout.x + branchOffset.x),
                svgY - (nodeLayout.y + branchOffset.y),
            );
            if (distToBranch <= TREE_BUTTON_HIT_RADIUS) {
                return { nodeId: node.id, type: 'branch' };
            }
        }
    }

    return null;
};

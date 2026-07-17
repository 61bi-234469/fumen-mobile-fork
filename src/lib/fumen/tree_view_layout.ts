import { Page } from './types';
import { SerializedTree, TreeLayout, TreeNodeId, TreeOperationScope } from './tree_types';
import { calculateTreeLayout, canMoveScope, findNode, isVirtualNode } from './tree_utils';
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
export const TREE_ADD_BUTTON_SIZE = 32;
export const TREE_DROP_BUTTON_SIZE = 36;
export const TREE_ADD_BUTTON_GAP = 4;
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

// Copy button (below the node, centered)
export const TREE_COPY_BUTTON_SIZE = 22;
export const TREE_COPY_BUTTON_MARGIN_BOTTOM = -6;

// Drag handle (below the node, right-aligned)
export const TREE_DRAG_HANDLE_WIDTH = 32;
export const TREE_DRAG_HANDLE_HEIGHT = 10;
export const TREE_DRAG_HANDLE_HIT_RADIUS = 20;

// Insert/Branch grow only slightly while dragging, while the invisible hit area
// still provides the 44px mobile target size.
export const TREE_BUTTON_HIT_RADIUS = 22;
export const TREE_COPY_BUTTON_HIT_RADIUS = TREE_COPY_BUTTON_SIZE / 2 + 6;

// Footer strip occupied by the copy button / drag handle below the card.
// Included in the lane height so adjacent lanes never overlap these controls.
export const TREE_NODE_FOOTER_HEIGHT =
    TREE_COPY_BUTTON_MARGIN_BOTTOM + TREE_COPY_BUTTON_SIZE / 2 + TREE_DRAG_HANDLE_HIT_RADIUS;

// Node-relative offsets for buttons/badges, shared between rendering (fumen_graph.tsx)
// and hit-testing (fumen_graph.tsx mouse handler, views/list_view.ts touch handlers).
// Insert stays on the outgoing horizontal connection. Branch stays at its
// original position near the downward curve.
export const getInsertButtonOffset = (nodeHeight: number) =>
    ({ x: TREE_BUTTON_X, y: nodeHeight / 2 });
export const getBranchButtonOffset = (nodeHeight: number) =>
    ({ x: TREE_BUTTON_X, y: nodeHeight / 2 + TREE_ADD_BUTTON_SIZE + TREE_ADD_BUTTON_GAP });
export const getDeleteButtonOffset = () =>
    ({ x: TREE_NODE_WIDTH + 4, y: 8 });
export const getCopyButtonOffset = (nodeHeight: number) =>
    ({ x: TREE_NODE_WIDTH / 2, y: nodeHeight + TREE_COPY_BUTTON_MARGIN_BOTTOM + TREE_COPY_BUTTON_SIZE / 2 });
export const getDragHandleOffset = (nodeHeight: number) =>
    ({ x: TREE_NODE_WIDTH - TREE_DRAG_HANDLE_WIDTH / 2, y: nodeHeight + TREE_COPY_BUTTON_MARGIN_BOTTOM
        + TREE_COPY_BUTTON_SIZE / 2 });

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
    scope: TreeOperationScope,
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
            if (distToCopy <= TREE_COPY_BUTTON_HIT_RADIUS) {
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
            if (distToInsert <= TREE_BUTTON_HIT_RADIUS) {
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
            if (distToBranch <= TREE_BUTTON_HIT_RADIUS) {
                return { nodeId: node.id, type: 'branch' };
            }
        }
    }

    return null;
};

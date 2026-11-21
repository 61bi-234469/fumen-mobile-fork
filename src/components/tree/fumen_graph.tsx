/**
 * FumenGraph component - SVG-based tree visualization for fumen pages
 */

import { Component, px, style } from '../../lib/types';
import { h } from 'hyperapp';
import { Page } from '../../lib/fumen/types';
import {
    TreeNode,
    TreeNodeId,
    SerializedTree,
    TreeOperationScope,
} from '../../lib/fumen/tree_types';
import {
    canDeleteNode,
    findNode,
    canMoveScope,
    getTreeOperationNodeIds,
    isDescendant,
    isVirtualNode,
} from '../../lib/fumen/tree_utils';
import { generateThumbnail } from '../../lib/thumbnail';
import { lazyThumbnail } from '../lazy_thumbnail';
import { Pages, isTextCommentResult } from '../../lib/pages';
import { setTreeTouchStartPosition } from './tree_touch_state';
import { i18n } from '../../locales/keys';
import {
    TREE_ADD_BUTTON_SIZE,
    TREE_BRANCH_BUTTON_SIZE,
    TREE_BUTTON_HIT_RADIUS,
    TREE_COMMENT_HEIGHT,
    TREE_COMMENT_MARGIN_X,
    TREE_COMMENT_TOP_OFFSET,
    TREE_COMMENT_WIDTH,
    TREE_COPY_BUTTON_HIT_RADIUS,
    TREE_COPY_BUTTON_SIZE,
    TREE_DELETE_BUTTON_HIT_RADIUS,
    TREE_DROP_BUTTON_SIZE,
    TREE_HORIZONTAL_GAP,
    TREE_NODE_HEADER_HEIGHT,
    TREE_NODE_RADIUS,
    TREE_NODE_WIDTH,
    TREE_PADDING,
    TREE_SCROLL_PADDING_BOTTOM,
    TREE_SCROLL_PADDING_RIGHT,
    TREE_THUMBNAIL_TOP,
    TREE_THUMBNAIL_WIDTH,
    TREE_VERTICAL_GAP,
    calculateTreeViewLayout,
    getBranchButtonOffset,
    getCopyButtonOffset,
    getDeleteButtonOffset,
    getDragHandleRect,
    getInsertButtonOffset,
    getPageLinkRect,
    getTreeCopyButtonDropTarget,
    getTreeLaneReorderGuides,
    getRootGhostRect,
    TreeNodeLayout,
} from '../../lib/fumen/tree_view_layout';

// ============================================================================
// Constants
// ============================================================================

// Thumbnail aspect ratio matches tetris field (10:23)

// Modern design tokens for the tree view
const TREE_COLORS = {
    canvas: '#F1F5F9',
    canvasDot: '#CBD5E1',
    cardFill: '#FFFFFF',
    cardBorder: '#E2E8F0',
    cardActiveFill: '#EFF6FF',
    headerFill: '#F1F5F9',
    accent: '#2563EB',
    accentHalo: '#BFDBFE',
    accentBadgeBg: '#DBEAFE',
    connection: '#94A3B8',
    textMuted: '#64748B',
    insert: '#10B981',
    insertHover: '#34D399',
    branch: '#F59E0B',
    branchHover: '#FBBF24',
    disabledIcon: '#CBD5E1',
    ghostFill: '#F8FAFC',
    ghostBorder: '#94A3B8',
    commentChangedBg: '#10B981',
    commentFill: '#F8FAFC',
    lane: '#7C3AED',
};

// Crisp path-drawn icons (replace text glyphs so buttons stay sharp at any zoom)
const iconPlus = (r: number, color: string = '#fff') => (
    <path
        d={`M ${-r} 0 H ${r} M 0 ${-r} V ${r}`}
        stroke={color}
        stroke-width={2.4}
        stroke-linecap="round"
        fill="none"
    />
);

const iconCopy = (color: string) => (
    <g fill="none" stroke={color} stroke-width={1.6} stroke-linejoin="round">
        <path d="M -1.5 -5.5 H 3.5 A 1.5 1.5 0 0 1 5 -4 V 2" stroke-linecap="round" />
        <rect x={-5} y={-3.5} width={7} height={8.5} rx={1.5} />
    </g>
);

// A line that forks downward: tells Branch apart from Insert without relying on color.
const iconBranch = (color: string) => (
    <path
        d="M -3.5 -5 V 5 M -3.5 -1.5 C -3.5 3 3.5 0.5 3.5 5"
        stroke={color}
        stroke-width={1.9}
        stroke-linecap="round"
        fill="none"
    />
);

// Follows the color of its group, so the delete control can change it on hover.
const iconTrash = (
    <g fill="none" stroke="currentColor" stroke-width={1.5} stroke-linecap="round" stroke-linejoin="round">
        <path d="M -4.6 -3.4 H 4.6" />
        <path d="M -1.7 -3.4 V -5 H 1.7 V -3.4" />
        <path d="M -3.5 -3.4 L -2.9 5 H 2.9 L 3.5 -3.4 Z" />
        <path d="M -1.1 -1.3 V 2.9 M 1.1 -1.3 V 2.9" />
    </g>
);

// Quiet 6-dot grip marking the header strip as the drag handle.
const iconDragDots = (color: string) => (
    <g fill={color}>
        <circle cx={-5} cy={-2} r={1.1} />
        <circle cx={0} cy={-2} r={1.1} />
        <circle cx={5} cy={-2} r={1.1} />
        <circle cx={-5} cy={2} r={1.1} />
        <circle cx={0} cy={2} r={1.1} />
        <circle cx={5} cy={2} r={1.1} />
    </g>
);

// A press that traveled this far is a drag, never a click (matches the drag start threshold).
const PRESS_TRAVEL_LIMIT = 10;

// The press in progress on a control inside the handle strip (page number, delete).
// Its click is dropped once the pointer has traveled, even if it came back: the view
// may not have re-rendered into the drag state yet, and a delete must never follow a
// drag. The record ends right after the mouse is released, so it never outlives its
// own click and never affects a click that has no press (assistive activation).
let headerControlPress: { traveled: boolean } | null = null;
let stopTrackingHeaderControlPress: (() => void) | null = null;

// Drop the press in progress, e.g. when its mouseup never arrived (released outside
// the window) or the tree goes away.
const cancelHeaderControlPress = () => {
    if (stopTrackingHeaderControlPress) {
        stopTrackingHeaderControlPress();
    }
    headerControlPress = null;
};

const trackHeaderControlPress = (startX: number, startY: number) => {
    cancelHeaderControlPress();
    const press = { traveled: false };
    headerControlPress = press;

    const onMove = (e: MouseEvent) => {
        if (Math.hypot(e.clientX - startX, e.clientY - startY) >= PRESS_TRAVEL_LIMIT) {
            press.traveled = true;
        }
    };
    const stop = () => {
        document.removeEventListener('mousemove', onMove, true);
        document.removeEventListener('mouseup', onUp, true);
        window.removeEventListener('blur', cancelHeaderControlPress);
        if (stopTrackingHeaderControlPress === stop) {
            stopTrackingHeaderControlPress = null;
        }
    };
    const onUp = () => {
        stop();
        // The click, if any, is dispatched right after mouseup in the same task.
        setTimeout(() => {
            if (headerControlPress === press) {
                headerControlPress = null;
            }
        }, 0);
    };
    stopTrackingHeaderControlPress = stop;
    document.addEventListener('mousemove', onMove, true);
    document.addEventListener('mouseup', onUp, true);
    window.addEventListener('blur', cancelHeaderControlPress);
};

const consumeHeaderControlClick = (): boolean => {
    const press = headerControlPress;
    headerControlPress = null;
    return press === null || !press.traveled;
};

// ============================================================================
// Props Interface
// ============================================================================

interface Props {
    tree: SerializedTree;
    pages: Page[];
    guideLineColor: boolean;
    activeNodeId: TreeNodeId | null;
    containerWidth: number;
    containerHeight: number;
    scale: number;
    dragSourceNodeId: TreeNodeId | null;
    dragTargetButtonParentId: TreeNodeId | null;
    dragTargetButtonType: 'insert' | 'branch' | null;
    dragDropSlotIndex: number | null;
    operationScope: TreeOperationScope;
    dragOperationScope?: TreeOperationScope;
    trimTopBlank: boolean;
    autoFocusPending?: boolean;
    actions: {
        onNodeActivate: (nodeId: TreeNodeId) => void;
        onNodeTouchStart: (nodeId: TreeNodeId, event: TouchEvent) => void;
        onPageClick: (nodeId: TreeNodeId) => void;
        onAddBranch: (parentNodeId: TreeNodeId) => void;
        onInsertNode: (parentNodeId: TreeNodeId) => void;
        onCopyNode: (nodeId: TreeNodeId) => void;
        onDeleteNode: (nodeId: TreeNodeId) => void;
        onAddRoot: () => void;
        onCommentChange: (pageIndex: number, comment: string) => void;
        onHandleMouseDown: (nodeId: TreeNodeId, event: MouseEvent) => void;
        // Returns false when the view has no touch drag (the touch then stays an ordinary tap)
        onHandleTouchStart: (nodeId: TreeNodeId, event: TouchEvent) => boolean;
        // Pointer moved during a drag (client coordinates)
        onDragMove: (clientX: number, clientY: number) => void;
        // Drag released at a client position; leftView = the pointer left the tree viewport
        onDrop: (clientX: number, clientY: number, leftView: boolean) => void;
        ackTreeAutoFocus?: () => void;
    };
}

// ============================================================================
// Helper Functions
// ============================================================================

const getNodeLayout = (
    nodeLayouts: Map<TreeNodeId, TreeNodeLayout>,
    nodeId: TreeNodeId,
): TreeNodeLayout | null => {
    return nodeLayouts.get(nodeId) ?? null;
};

/**
 * Render connection line between nodes
 */
const renderConnection = (
    nodeLayouts: Map<TreeNodeId, TreeNodeLayout>,
    fromId: TreeNodeId,
    toId: TreeNodeId,
    activeNodeId: TreeNodeId | null,
) => {
    const fromPos = getNodeLayout(nodeLayouts, fromId);
    const toPos = getNodeLayout(nodeLayouts, toId);

    if (!fromPos || !toPos) return null;

    // Anchor at the card's right edge; add buttons are drawn on a later layer
    // so the line passes behind them.
    const x1 = fromPos.x + TREE_NODE_WIDTH + 2;
    // Main axis is at node center Y
    const y1 = fromPos.y + fromPos.height / 2;
    const x2 = toPos.x;
    const y2 = toPos.y + toPos.height / 2;

    const isActive = fromId === activeNodeId || toId === activeNodeId;

    // Create path: straight when on the same lane, smooth cubic otherwise
    let pathD: string;
    if (y1 === y2) {
        pathD = `M ${x1} ${y1} L ${x2} ${y2}`;
    } else {
        const midX = (x1 + x2) / 2;
        pathD = `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;
    }

    return (
        <path
            key={`conn-${fromId}-${toId}`}
            d={pathD}
            stroke={isActive ? TREE_COLORS.accent : TREE_COLORS.connection}
            stroke-width={isActive ? 2.5 : 2}
            stroke-linecap="round"
            fill="none"
        />
    );
};

/** Render the card body below comments and controls. */
const renderNodeCard = (
    node: TreeNode,
    nodeLayout: TreeNodeLayout,
    pages: Page[],
    guideLineColor: boolean,
    activeNodeId: TreeNodeId | null,
    actions: Props['actions'],
    isDragAffected: boolean,
    isDragging: boolean,
    trimTopBlank: boolean,
    thumbnailRenderScale: number,
    canStartDrag: boolean,
) => {
    const pos = { x: nodeLayout.x, y: nodeLayout.y };
    const isActive = node.id === activeNodeId;
    const page = pages[node.pageIndex];
    const nodeHeight = nodeLayout.height;
    const thumbnailHeight = nodeLayout.thumbnailHeight;

    const thumbnailSource = () => {
        if (!page) {
            return '';
        }
        try {
            return generateThumbnail(
                pages, node.pageIndex, guideLineColor, trimTopBlank, thumbnailRenderScale,
            );
        } catch (e) {
            console.warn(`Failed to generate thumbnail for page ${node.pageIndex}:`, e);
            return '';
        }
    };
    const thumbnailLifecycle = lazyThumbnail(thumbnailSource);

    const fillColor = isActive ? TREE_COLORS.cardActiveFill : TREE_COLORS.cardFill;
    const strokeColor = isActive ? TREE_COLORS.accent : TREE_COLORS.cardBorder;
    const strokeWidth = isActive ? 2 : 1;

    return (
        <g
            key={`node-card-${node.id}`}
            datatest={`tree-node-${node.id}`}
            transform={`translate(${pos.x}, ${pos.y})`}
            style={{
                ...style({ cursor: 'pointer', userSelect: 'none' }),
                WebkitUserSelect: 'none',
                WebkitTouchCallout: 'none',
            }}
            onclick={() => {
                if (!isDragging) {
                    actions.onNodeActivate(node.id);
                }
            }}
            oncontextmenu={(e: Event) => {
                // Android browsers otherwise show the native image menu when
                // a field thumbnail is held before the drag timer completes.
                e.preventDefault();
            }}
            ondragstart={(e: DragEvent) => {
                e.preventDefault();
            }}
            ontouchstart={(e: TouchEvent) => {
                if (!isDragging && canStartDrag && e.touches.length === 1) {
                    actions.onNodeTouchStart(node.id, e);
                }
            }}
        >
            <g opacity={isDragAffected ? 0.5 : 1}>
                {isActive && (
                    <rect
                        x={-3}
                        y={-3}
                        width={TREE_NODE_WIDTH + 6}
                        height={nodeHeight + 6}
                        rx={TREE_NODE_RADIUS + 3}
                        ry={TREE_NODE_RADIUS + 3}
                        fill="none"
                        stroke={TREE_COLORS.accentHalo}
                        stroke-width={4}
                    />
                )}
                <rect
                    width={TREE_NODE_WIDTH}
                    height={nodeHeight}
                    rx={TREE_NODE_RADIUS}
                    ry={TREE_NODE_RADIUS}
                    fill={fillColor}
                    stroke={strokeColor}
                    stroke-width={strokeWidth}
                    filter="url(#tree-card-shadow)"
                />
                {/* Header strip; the border is redrawn on top so the strip never covers it */}
                <path
                    d={`M 0 ${TREE_NODE_HEADER_HEIGHT} V ${TREE_NODE_RADIUS}`
                        + ` a ${TREE_NODE_RADIUS} ${TREE_NODE_RADIUS} 0 0 1 ${TREE_NODE_RADIUS} ${-TREE_NODE_RADIUS}`
                        + ` H ${TREE_NODE_WIDTH - TREE_NODE_RADIUS}`
                        + ` a ${TREE_NODE_RADIUS} ${TREE_NODE_RADIUS} 0 0 1 ${TREE_NODE_RADIUS} ${TREE_NODE_RADIUS}`
                        + ` V ${TREE_NODE_HEADER_HEIGHT} Z`}
                    fill={isActive ? TREE_COLORS.accentBadgeBg : TREE_COLORS.headerFill}
                />
                <path
                    d={`M 0 ${TREE_NODE_HEADER_HEIGHT} H ${TREE_NODE_WIDTH}`}
                    stroke={isActive ? TREE_COLORS.accentHalo : TREE_COLORS.cardBorder}
                    stroke-width={1}
                />
                <rect
                    width={TREE_NODE_WIDTH}
                    height={nodeHeight}
                    rx={TREE_NODE_RADIUS}
                    ry={TREE_NODE_RADIUS}
                    fill="none"
                    stroke={strokeColor}
                    stroke-width={strokeWidth}
                />
                <image
                    x={(TREE_NODE_WIDTH - TREE_THUMBNAIL_WIDTH) / 2}
                    y={TREE_THUMBNAIL_TOP}
                    width={TREE_THUMBNAIL_WIDTH}
                    height={thumbnailHeight}
                    oncreate={thumbnailLifecycle.oncreate}
                    onupdate={thumbnailLifecycle.onupdate}
                    ondestroy={thumbnailLifecycle.ondestroy}
                />
            </g>
        </g>
    );
};

/** Render the header strip (handle, page number, delete) and the add/copy buttons above comments. */
const renderNodeControls = (
    node: TreeNode,
    nodeLayout: TreeNodeLayout,
    activeNodeId: TreeNodeId | null,
    actions: Props['actions'],
    pageNumber: number,
    isDragAffected: boolean,
    isDragging: boolean,
    isInsertButtonHighlighted: boolean,
    isBranchButtonHighlighted: boolean,
    isInsertDropTarget: boolean,
    isBranchDropTarget: boolean,
    isCopyButtonHighlighted: boolean,
    isCopyDropTarget: boolean,
    hideButtons: boolean,
    hideInsertButton: boolean,
    hideBranchButton: boolean,
    canDelete: boolean,
    canCopy: boolean,
    canStartDrag: boolean,
) => {
    const pos = { x: nodeLayout.x, y: nodeLayout.y };

    const isActive = node.id === activeNodeId;
    const nodeHeight = nodeLayout.height;

    const hasBranchButton = node.childrenIds.length > 0;
    const insertButtonOffset = getInsertButtonOffset(nodeHeight);
    const branchButtonOffset = getBranchButtonOffset(nodeHeight);
    const deleteButtonOffset = getDeleteButtonOffset();
    const copyButtonOffset = getCopyButtonOffset(nodeHeight);
    const handleRect = getDragHandleRect();
    const pageLinkRect = getPageLinkRect(pageNumber);
    const insertButtonSize = isInsertDropTarget ? TREE_DROP_BUTTON_SIZE : TREE_ADD_BUTTON_SIZE;
    const branchButtonSize = isBranchDropTarget ? TREE_DROP_BUTTON_SIZE : TREE_BRANCH_BUTTON_SIZE;
    const copyButtonSize = isCopyDropTarget ? TREE_DROP_BUTTON_SIZE : TREE_COPY_BUTTON_SIZE;

    const dragOpacity = isDragAffected ? 0.5 : 1;
    const handleButtonTouchStart = (e: TouchEvent) => {
        if (e.cancelable) {
            e.preventDefault();
        }
        if (e.touches.length === 1) {
            setTreeTouchStartPosition({
                x: e.touches[0].clientX,
                y: e.touches[0].clientY,
            });
        }
    };

    // The page number and the delete icon sit inside the handle strip. A press on
    // them that travels becomes a drag (the view applies the threshold); a press
    // that stays put remains their own click.
    const handleHeaderControlMouseDown = (e: MouseEvent) => {
        e.stopPropagation();
        if (e.button === 0) {
            trackHeaderControlPress(e.clientX, e.clientY);
        }
        if (canStartDrag && e.button === 0) {
            e.preventDefault();
            actions.onHandleMouseDown(node.id, e);
        }
    };

    // Only Insert is filled. Branch and Copy stay outlined until they become
    // drop targets of a drag, so the two-button stack reads as one primary action.
    const insertButton = !hideInsertButton && (
        <g
            key="insert-button"
            datatest={`btn-tree-insert-${node.id}`}
            transform={`translate(${insertButtonOffset.x}, ${insertButtonOffset.y})`}
            onmousedown={(e: MouseEvent) => {
                e.stopPropagation();
            }}
            onclick={(e: MouseEvent) => {
                e.stopPropagation();
                if (!isDragging) {
                    actions.onInsertNode(node.id);
                }
            }}
            ontouchstart={handleButtonTouchStart}
            style={style({ cursor: 'pointer' })}
        >
            {/* A leaf has no outgoing connection, so a short stub ties the button to its card */}
            {!hasBranchButton && (
                <path
                    d={`M ${TREE_NODE_WIDTH + 2 - insertButtonOffset.x} 0 H 0`}
                    stroke={TREE_COLORS.connection}
                    stroke-width={2}
                    stroke-linecap="round"
                    fill="none"
                />
            )}
            <circle
                r={TREE_BUTTON_HIT_RADIUS}
                fill="transparent"
            />
            <circle
                r={insertButtonSize / 2}
                fill={isInsertButtonHighlighted ? TREE_COLORS.insertHover : TREE_COLORS.insert}
                stroke="#fff"
                stroke-width={isInsertButtonHighlighted ? 3 : 2}
                filter="url(#tree-control-button-shadow)"
            />
            {iconPlus(5)}
        </g>
    );

    const branchFill = isBranchButtonHighlighted ? TREE_COLORS.branchHover : TREE_COLORS.branch;
    const branchButton = hasBranchButton && !hideBranchButton && (
        <g
            key="branch-button"
            datatest={`btn-tree-branch-${node.id}`}
            transform={`translate(${branchButtonOffset.x}, ${branchButtonOffset.y})`}
            onmousedown={(e: MouseEvent) => {
                e.stopPropagation();
            }}
            onclick={(e: MouseEvent) => {
                e.stopPropagation();
                if (!isDragging) {
                    actions.onAddBranch(node.id);
                }
            }}
            ontouchstart={handleButtonTouchStart}
            style={style({ cursor: 'pointer' })}
        >
            <circle
                r={TREE_BUTTON_HIT_RADIUS}
                fill="transparent"
            />
            <circle
                r={branchButtonSize / 2}
                fill={isBranchDropTarget ? branchFill : '#fff'}
                stroke={isBranchDropTarget ? '#fff' : TREE_COLORS.branch}
                stroke-width={isBranchDropTarget ? (isBranchButtonHighlighted ? 3 : 2) : 1.5}
                filter="url(#tree-control-button-shadow)"
            />
            {iconBranch(isBranchDropTarget ? '#fff' : TREE_COLORS.branch)}
        </g>
    );

    return (
        <g
            key={`node-controls-${node.id}`}
            transform={`translate(${pos.x}, ${pos.y})`}
        >
            <g opacity={dragOpacity}>
            {/* Drag handle: the whole header strip. Dragging starts only here
                (and, on touch, from a long press on the card body).
                The controls are keyed: the delete icon leaves during a drag, and
                without keys its neighbors' elements would be reused for one another
                while a press on them is still in progress. */}
            <g
                key="handle"
                datatest={`tree-handle-${node.id}`}
                aria-disabled={canStartDrag ? undefined : 'true'}
                style={{
                    ...style({ cursor: canStartDrag ? 'grab' : 'not-allowed', userSelect: 'none' }),
                    WebkitUserSelect: 'none',
                    WebkitTouchCallout: 'none',
                }}
                onmousedown={(e: MouseEvent) => {
                    if (canStartDrag && e.button === 0) {
                        e.stopPropagation();
                        e.preventDefault();
                        actions.onHandleMouseDown(node.id, e);
                    }
                }}
                onclick={(e: MouseEvent) => {
                    // The strip is part of the card, so a click selects it. It never
                    // opens the page: a press meant as a grab must not navigate.
                    e.stopPropagation();
                    if (!isDragging && !isActive) {
                        actions.onNodeActivate(node.id);
                    }
                }}
                ontouchstart={(e: TouchEvent) => {
                    // Without a touch drag the tap stays a click, which selects the card.
                    if (canStartDrag && actions.onHandleTouchStart(node.id, e) && e.cancelable) {
                        e.preventDefault();
                    }
                }}
            >
                <title>{i18n.TreeView.DragHandle()}</title>
                <rect
                    x={handleRect.x}
                    y={handleRect.y}
                    width={handleRect.width}
                    height={handleRect.height}
                    fill="transparent"
                />
                <g transform={`translate(16, ${TREE_NODE_HEADER_HEIGHT / 2})`}>
                    {iconDragDots(canStartDrag
                        ? (isActive ? TREE_COLORS.accent : TREE_COLORS.textMuted)
                        : TREE_COLORS.disabledIcon)}
                </g>
            </g>

            {/* Delete icon at the right end of the header strip. Quiet until hovered
                or pressed (colors live in resources/index.html). It is removed during
                a drag so the drag surface stays focused on move targets. */}
            {!isDragging && (
                <g
                    key="delete"
                    datatest={`btn-tree-node-delete-${node.id}`}
                    class={`tree-node-delete${isActive ? ' is-active' : ''}${canDelete ? '' : ' is-disabled'}`}
                    aria-disabled={canDelete ? undefined : 'true'}
                    transform={`translate(${deleteButtonOffset.x}, ${deleteButtonOffset.y})`}
                    style={style({ cursor: canDelete ? 'pointer' : 'not-allowed' })}
                    onmousedown={handleHeaderControlMouseDown}
                    onclick={(e: MouseEvent) => {
                        e.stopPropagation();
                        if (consumeHeaderControlClick() && canDelete) {
                            actions.onDeleteNode(node.id);
                        }
                    }}
                    ontouchstart={handleButtonTouchStart}
                >
                    <title>{i18n.TreeView.DeleteNode()}</title>
                    <circle
                        r={TREE_DELETE_BUTTON_HIT_RADIUS}
                        fill="transparent"
                    />
                    {iconTrash}
                </g>
            )}

            {/* Page number - clickable pill badge to jump to page. Drawn after the delete
                icon: where a wide number reaches the icon's invisible margin, the number
                wins, as it does for taps (views/list_view.ts). touch-action keeps a drag
                that starts on the pill from scrolling the tree, while a plain tap still
                arrives as a click. */}
            <g
                key="page-link"
                datatest={`tree-page-link-${node.id}`}
                style={style({ cursor: 'pointer', touchAction: 'none' })}
                onclick={(e: MouseEvent) => {
                    e.stopPropagation();
                    if (consumeHeaderControlClick() && !isDragging) {
                        actions.onPageClick(node.id);
                    }
                }}
                onmousedown={handleHeaderControlMouseDown}
                ontouchstart={(e: TouchEvent) => {
                    if (canStartDrag) {
                        actions.onHandleTouchStart(node.id, e);
                    }
                }}
            >
                <rect
                    x={pageLinkRect.x}
                    y={pageLinkRect.y}
                    width={pageLinkRect.width}
                    height={pageLinkRect.height}
                    rx={pageLinkRect.height / 2}
                    ry={pageLinkRect.height / 2}
                    fill={isActive ? TREE_COLORS.accent : TREE_COLORS.accentBadgeBg}
                />
                <text
                    x={TREE_NODE_WIDTH / 2}
                    y={TREE_NODE_HEADER_HEIGHT / 2}
                    text-anchor="middle"
                    dominant-baseline="central"
                    font-size="12"
                    font-weight="bold"
                    fill={isActive ? '#fff' : TREE_COLORS.accent}
                >
                    {`#${pageNumber}`}
                </text>
            </g>

            {/* Copy button - straddles the bottom edge. During a drag it becomes a
                blue plus target for the parent's branch operation. */}
            {canCopy && (
                <g
                    key="copy"
                    datatest={`btn-tree-copy-${node.id}`}
                    transform={`translate(${copyButtonOffset.x}, ${copyButtonOffset.y})`}
                    style={style({
                        cursor: isDragging ? 'default' : 'pointer',
                        pointerEvents: 'auto',
                    })}
                    onmousedown={(e: MouseEvent) => {
                        e.stopPropagation();
                    }}
                    onclick={(e: MouseEvent) => {
                        e.stopPropagation();
                        if (!isDragging) {
                            actions.onCopyNode(node.id);
                        }
                    }}
                    ontouchstart={(e: TouchEvent) => {
                        e.stopPropagation();
                        if (e.cancelable) {
                            e.preventDefault();
                        }
                        if (e.touches.length === 1) {
                            setTreeTouchStartPosition({
                                x: e.touches[0].clientX,
                                y: e.touches[0].clientY,
                            });
                        }
                    }}
                >
                    {/* Larger hit area for touch */}
                    <circle
                        r={TREE_COPY_BUTTON_HIT_RADIUS}
                        fill="transparent"
                    />
                    {/* Visible button */}
                    <circle
                        r={copyButtonSize / 2}
                        fill={isCopyDropTarget ? TREE_COLORS.accent : '#fff'}
                        stroke={isCopyDropTarget ? '#fff' : TREE_COLORS.accent}
                        stroke-width={isCopyDropTarget ? (isCopyButtonHighlighted ? 3 : 2) : 1.5}
                        filter="url(#tree-control-button-shadow)"
                    />
                    {isCopyDropTarget ? iconPlus(6) : iconCopy(TREE_COLORS.accent)}
                </g>
            )}

            </g>

            {/* Add buttons wrapper - semi-transparent when dragging */}
            <g opacity={dragOpacity}>
            {!hideButtons && (
                <g key="add-buttons">
                    {insertButton}
                    {branchButton}
                </g>
            )}
            </g>
        </g>
    );
};

// ============================================================================
// Main Component
// ============================================================================

// Holds the cleanup function for the active pan session (null when not mounted).
// Singleton: FumenGraph is rendered at most once at a time.
let panCleanupFn: (() => void) | null = null;

// Suppress the click that immediately follows a pan of 10px or more, so panning
// over a card does not select the page / open the editor on mouseup.
const PAN_CLICK_SUPPRESS_THRESHOLD = 10;

export const FumenGraph: Component<Props> = ({
    tree,
    pages,
    guideLineColor,
    activeNodeId,
    containerWidth,
    containerHeight,
    scale,
    dragSourceNodeId,
    dragTargetButtonParentId,
    dragTargetButtonType,
    dragDropSlotIndex,
    operationScope,
    dragOperationScope,
    trimTopBlank,
    autoFocusPending,
    actions,
}) => {
    // Handle empty tree
    if (!tree.rootId || tree.nodes.length === 0) {
        const emptyStyle = style({
            width: '100%',
            height: px(containerHeight),
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            color: TREE_COLORS.textMuted,
            fontSize: '14px',
            backgroundColor: TREE_COLORS.canvas,
        });

        const emptyIconStyle = style({
            fontSize: '40px',
            color: TREE_COLORS.connection,
        });

        return (
            <div key="fumen-graph-empty" style={emptyStyle}>
                <i className="material-icons" style={emptyIconStyle}>account_tree</i>
                No pages to display
            </div>
        );
    }

    // Calculate layout
    const treeViewLayout = calculateTreeViewLayout(tree, pages, trimTopBlank);
    const devicePixelRatio = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
    // The thumbnail is rendered at TREE_THUMBNAIL_WIDTH * scale CSS pixels.
    // Match the list view's DPR-aware rendering so zoomed tree cards stay crisp.
    const thumbnailRenderScale = scale * devicePixelRatio;
    const isDragging = dragSourceNodeId !== null;
    const dragScope = isDragging ? (dragOperationScope ?? operationScope) : operationScope;
    const rootGhostRect = getRootGhostRect(treeViewLayout.contentHeight);
    const ghostNodeWidth = rootGhostRect.width;
    const ghostNodeHeight = rootGhostRect.height;
    const ghostNodeX = rootGhostRect.x;
    const ghostNodeY = rootGhostRect.y;
    const ghostTreeContentHeight = treeViewLayout.contentHeight + TREE_VERTICAL_GAP + ghostNodeHeight;
    const rootNode = tree.rootId ? findNode(tree, tree.rootId) : undefined;
    const canDropOnRootGhost = isDragging
        && tree.rootId !== null
        && dragSourceNodeId !== null
        && dragSourceNodeId !== tree.rootId
        && rootNode !== undefined
        && isVirtualNode(rootNode)
        && canMoveScope(tree, dragSourceNodeId, tree.rootId, dragScope, 'branch');
    const isRootGhostHighlighted = canDropOnRootGhost
        && dragTargetButtonParentId === tree.rootId
        && dragTargetButtonType === 'branch';

    // Calculate SVG dimensions (add extra space for add button on the right and ghost add row at bottom)
    const buttonExtraWidth = TREE_BUTTON_HIT_RADIUS * 2 + 10;
    const baseWidth = TREE_PADDING * 2 + (treeViewLayout.layout.maxDepth + 1) * (TREE_NODE_WIDTH + TREE_HORIZONTAL_GAP)
        + buttonExtraWidth + TREE_SCROLL_PADDING_RIGHT;
    const baseHeight = TREE_PADDING * 2 + ghostTreeContentHeight + TREE_SCROLL_PADDING_BOTTOM;

    // Apply scale to dimensions
    const scaledWidth = Math.max(containerWidth, baseWidth * scale);
    const scaledHeight = Math.max(containerHeight - 10, baseHeight * scale);

    // Container style
    const containerStyle = style({
        width: '100%',
        height: px(containerHeight),
        overflowX: 'auto',
        overflowY: 'auto',
        backgroundColor: TREE_COLORS.canvas,
    });

    const canvasStyle = style({
        position: 'relative',
        width: px(scaledWidth),
        height: px(scaledHeight),
    });

    // Create Pages object for comment extraction
    const pagesObj = new Pages(pages);
    const renderableNodes = tree.nodes.filter(node => !isVirtualNode(node));

    // Render connections
    const connections = treeViewLayout.layout.connections.map(conn =>
        renderConnection(treeViewLayout.nodeLayouts, conn.fromId, conn.toId, activeNodeId),
    );

    // Lane reorder guides: slots between the sibling branches of the reordered fork.
    // Deliberately quiet: a faint band on the moving branch, thin dashed lines on the
    // slots that would change the order, and a solid line on the current candidate.
    const laneGuides = isDragging && dragSourceNodeId !== null
        ? getTreeLaneReorderGuides(tree, treeViewLayout, dragSourceNodeId, dragScope)
        : null;
    const laneGuideLayer = (() => {
        if (laneGuides === null) return null;
        const { slotYs, unit, lineStartX, blockX } = laneGuides;
        const rightEdge = scaledWidth / scale - TREE_PADDING / 2;
        const bandX = blockX - 8;
        return (
            <g key="lane-guides-layer" style={style({ pointerEvents: 'none' })}>
                <rect
                    key="tree-lane-block"
                    datatest="tree-lane-block"
                    x={bandX}
                    y={slotYs[unit.index] + 4}
                    width={Math.max(0, rightEdge - bandX)}
                    height={Math.max(0, slotYs[unit.index + 1] - slotYs[unit.index] - 8)}
                    rx={10}
                    fill={TREE_COLORS.lane}
                    fill-opacity={0.08}
                />
                {slotYs.map((y, slot) => {
                    if (slot === unit.index || slot === unit.index + 1) return null;
                    const isActive = slot === dragDropSlotIndex;
                    return (
                        <g key={`tree-lane-guide-${slot}`} datatest={`tree-lane-guide-${slot}`}>
                            <path
                                d={`M ${lineStartX} ${y} H ${rightEdge}`}
                                stroke={TREE_COLORS.lane}
                                stroke-width={isActive ? 3 : 1.5}
                                stroke-opacity={isActive ? 1 : 0.6}
                                stroke-dasharray={isActive ? 'none' : '6 5'}
                                stroke-linecap="round"
                                vector-effect="non-scaling-stroke"
                                fill="none"
                            />
                            {isActive && (
                                <circle
                                    datatest="tree-lane-guide-active"
                                    cx={lineStartX}
                                    cy={y}
                                    r={4.5 / scale}
                                    fill={TREE_COLORS.lane}
                                />
                            )}
                        </g>
                    );
                })}
            </g>
        );
    })();

    // Calculate source node for drag operations
    const sourceNode = isDragging ? findNode(tree, dragSourceNodeId) : null;
    const sourceParentId = sourceNode?.parentId ?? null;

    // Render cards below comments and controls above them.
    const nodeLayers = renderableNodes.map((node) => {
        const pageNumber = node.pageIndex + 1;
        const isDragSource = node.id === dragSourceNodeId;
        const isDescendantOfDragSource = isDragging
            && dragSourceNodeId !== null
            && node.id !== dragSourceNodeId
            && isDescendant(tree, dragSourceNodeId, node.id);
        const isDragAffected = isDragging && (
            dragScope === 'descendants' ? isDescendantOfDragSource : isDragSource || isDescendantOfDragSource
        );
        const hideDescendantButtons = isDragging
            && dragScope !== 'node'
            && isDescendantOfDragSource;
        const isSourceParent = isDragging && sourceParentId === node.id;
        const hideSourceParentButtons = isSourceParent
            && node.childrenIds.length <= 1
            && dragScope !== 'descendants';
        const hideButtons = hideDescendantButtons || hideSourceParentButtons;
        const hideInsertButton = isSourceParent
            || (isDragging
                && dragScope === 'descendants'
                && sourceNode?.childrenIds.length !== 1
                && node.childrenIds.length > 0);
        const hideBranchButton = hideSourceParentButtons;
        const isRootDragSource = isDragging && dragScope === 'subtree'
            && tree.rootId !== null && dragSourceNodeId === tree.rootId;
        const canDropAsInsert = isDragging
            && dragSourceNodeId !== null
            && node.id !== dragSourceNodeId
            && !isRootDragSource
            && canMoveScope(tree, dragSourceNodeId, node.id, dragScope, 'insert');
        const canDropAsBranch = isDragging
            && dragSourceNodeId !== null
            && node.id !== dragSourceNodeId
            && !isRootDragSource
            && canMoveScope(tree, dragSourceNodeId, node.id, dragScope, 'branch');
        const isInsertDropTarget = canDropAsInsert;
        const isBranchDropTarget = canDropAsBranch
            && node.childrenIds.length > 0
            && !hideBranchButton;
        const copyDropTarget = isDragging && dragSourceNodeId !== null
            ? getTreeCopyButtonDropTarget(tree, node.id, dragSourceNodeId, dragScope)
            : null;
        const isCopyDropTarget = copyDropTarget !== null;

        // Calculate button highlight state
        const isInsertButtonHighlighted = isDragging
            && dragTargetButtonParentId === node.id
            && dragTargetButtonType === 'insert';
        const isBranchButtonHighlighted = isDragging
            && dragTargetButtonParentId === node.id
            && dragTargetButtonType === 'branch';
        const isCopyButtonHighlighted = isCopyDropTarget
            && dragTargetButtonParentId === copyDropTarget?.nodeId
            && dragTargetButtonType === copyDropTarget?.type;

        const canDelete = canDeleteNode(tree, node.id, operationScope, pages.length);
        const canStartDrag = operationScope !== 'descendants' || node.childrenIds.length > 0;

        // Copy button is available for all renderable nodes, including top-level roots.
        const canCopy = !isVirtualNode(node);

        const nodeLayout = treeViewLayout.nodeLayouts.get(node.id);
        if (!nodeLayout) {
            return null;
        }

        return {
            card: renderNodeCard(
                node,
                nodeLayout,
                pages,
                guideLineColor,
                activeNodeId,
                actions,
                isDragAffected,
                isDragging,
                trimTopBlank,
                thumbnailRenderScale,
                canStartDrag,
            ),
            controls: renderNodeControls(
                node,
                nodeLayout,
                activeNodeId,
                actions,
                pageNumber,
                isDragAffected,
                isDragging,
                isInsertButtonHighlighted,
                isBranchButtonHighlighted,
                isInsertDropTarget,
                isBranchDropTarget,
                isCopyButtonHighlighted,
                isCopyDropTarget,
                hideButtons,
                hideInsertButton,
                hideBranchButton,
                canDelete,
                canCopy,
                canStartDrag,
            ),
        };
    });
    const nodeCards = nodeLayers.map(node => node?.card);
    const nodeControls = nodeLayers.map(node => node?.controls);

    const stopPropagation = (e: Event) => {
        e.stopPropagation();
    };
    const stopAndPrevent = (e: Event) => {
        e.stopPropagation();
        if (e.cancelable) {
            e.preventDefault();
        }
    };

    const ghostNodeStyle = style({
        cursor: isDragging ? 'default' : 'pointer',
        pointerEvents: 'auto',
        opacity: isDragging && !canDropOnRootGhost ? 0.45 : 1,
    });

    const rootAddGhostButton = (
        <g
            key="tree-root-add-ghost"
            datatest="btn-tree-root-add-ghost"
            transform={`translate(${ghostNodeX}, ${ghostNodeY})`}
            style={ghostNodeStyle}
            onmousedown={stopAndPrevent}
            onclick={(e: MouseEvent) => {
                stopAndPrevent(e);
                if (!isDragging) {
                    actions.onAddRoot();
                }
            }}
            ontouchstart={stopAndPrevent}
            ontouchend={(e: TouchEvent) => {
                stopAndPrevent(e);
                if (!isDragging) {
                    actions.onAddRoot();
                }
            }}
        >
            <rect
                width={ghostNodeWidth}
                height={ghostNodeHeight}
                rx={TREE_NODE_RADIUS}
                ry={TREE_NODE_RADIUS}
                fill={TREE_COLORS.ghostFill}
                stroke={isRootGhostHighlighted ? TREE_COLORS.branch : TREE_COLORS.ghostBorder}
                stroke-width={isRootGhostHighlighted ? 3 : 1.5}
                stroke-dasharray="6 4"
            />
            <g transform={`translate(${ghostNodeWidth / 2}, ${ghostNodeHeight / 2})`}>
                <path
                    d="M -7 0 H 7 M 0 -7 V 7"
                    stroke={TREE_COLORS.textMuted}
                    stroke-width={2.4}
                    stroke-linecap="round"
                    fill="none"
                />
            </g>
        </g>
    );

    // Drag ghost: shrunken thumbnail of the source page that follows the pointer.
    // Position updates are applied imperatively (tree_drag_ghost.ts), not via state.
    const dragGhost = (() => {
        if (!isDragging || !sourceNode || isVirtualNode(sourceNode)) return null;
        let src = '';
        try {
            src = generateThumbnail(
                pages,
                sourceNode.pageIndex,
                guideLineColor,
                trimTopBlank,
                thumbnailRenderScale,
            );
        } catch (e) {
            return null;
        }
        if (!src) return null;
        const ghostPageCount = getTreeOperationNodeIds(tree, sourceNode.id, dragScope)
            .map(id => findNode(tree, id))
            .filter((node): node is TreeNode => node !== undefined && node.pageIndex >= 0)
            .length;
        const sourceLayout = treeViewLayout.nodeLayouts.get(sourceNode.id);
        const ghostScale = 0.55;
        const width = TREE_THUMBNAIL_WIDTH * ghostScale;
        const height = (sourceLayout?.thumbnailHeight ?? TREE_THUMBNAIL_WIDTH) * ghostScale;
        return (
            <g
                key="tree-drag-ghost"
                datatest="tree-drag-ghost"
                visibility="hidden"
                opacity={0.85}
                style={style({ pointerEvents: 'none' })}
            >
                <rect
                    x={-4}
                    y={-4}
                    width={width + 8}
                    height={height + 8}
                    rx={6}
                    fill="#fff"
                    stroke={TREE_COLORS.accent}
                    stroke-width={1.5}
                />
                <image width={width} height={height} href={src} />
                {dragScope !== 'node' && ghostPageCount > 0 && (
                    <g transform={`translate(${width - 2}, ${height + 2})`}>
                        <rect
                            x={-34}
                            y={-10}
                            width={38}
                            height={18}
                            rx={9}
                            fill={TREE_COLORS.accent}
                            stroke="#fff"
                            stroke-width={1}
                        />
                        <text
                            x={-15}
                            y={-1}
                            text-anchor="middle"
                            dominant-baseline="central"
                            font-size="8"
                            font-weight="bold"
                            fill="#fff"
                        >
                            {i18n.TreeView.DeleteToast.DragGhostPages(ghostPageCount)}
                        </text>
                    </g>
                )}
            </g>
        );
    })();

    const commentInputs = renderableNodes.map((node) => {
        const nodeLayout = treeViewLayout.nodeLayouts.get(node.id);
        if (!nodeLayout) return null;

        let commentText = '';
        try {
            const result = pagesObj.getComment(node.pageIndex);
            if (isTextCommentResult(result)) {
                commentText = result.text;
            } else {
                commentText = result.quiz;
            }
        } catch {
            commentText = '';
        }

        const page = pages[node.pageIndex];
        const isActive = node.id === activeNodeId;
        const hasComment = commentText !== '';
        const isCommentChanged = page?.comment.text !== undefined;
        const showGreenStyle = hasComment && isCommentChanged;

        const left = (nodeLayout.x + TREE_COMMENT_MARGIN_X) * scale;
        const top = (nodeLayout.y + nodeLayout.thumbnailHeight + TREE_COMMENT_TOP_OFFSET) * scale;
        const width = TREE_COMMENT_WIDTH * scale;
        const height = TREE_COMMENT_HEIGHT * scale;

        const fontSize = Math.max(8, Math.round(11 * scale));
        const paddingY = Math.max(1, Math.round(2 * scale));
        const paddingX = Math.max(2, Math.round(4 * scale));

        const textareaStyle = style({
            position: 'absolute',
            left: px(left),
            top: px(top),
            width: px(width),
            height: px(height),
            fontSize: px(fontSize),
            border: `1px solid ${showGreenStyle ? TREE_COLORS.commentChangedBg : TREE_COLORS.cardBorder}`,
            borderRadius: px(Math.max(3, Math.round(6 * scale))),
            padding: `${paddingY}px ${paddingX}px`,
            boxSizing: 'border-box',
            resize: 'none',
            fontFamily: 'inherit',
            backgroundColor: showGreenStyle
                ? TREE_COLORS.commentChangedBg
                : (isActive ? '#fff' : TREE_COLORS.commentFill),
            color: showGreenStyle ? '#fff' : '#334155',
            outline: 'none',
            pointerEvents: isDragging ? 'none' : 'auto',
            zIndex: 2,
        });

        return h('textarea', {
            key: `tree-comment-${node.id}`,
            style: textareaStyle,
            value: commentText,
            placeholder: i18n.EditorUi.CommentPlaceholder(),
            oninput: (e: Event) => {
                const target = e.target as HTMLTextAreaElement;
                actions.onCommentChange(node.pageIndex, target.value);
            },
            onmousedown: stopPropagation,
            onclick: stopPropagation,
            ontouchstart: stopPropagation,
            ontouchend: stopPropagation,
            ondragstart: stopPropagation,
            draggable: false,
        });
    });

    // Handle auto-focus to active node when entering tree view
    const handleAutoFocus = (container: HTMLElement) => {
        const ackFn = actions.ackTreeAutoFocus;
        if (!autoFocusPending || !ackFn) return;

        requestAnimationFrame(() => {
            // Get active node's layout
            let nodeLayout = activeNodeId ? treeViewLayout.nodeLayouts.get(activeNodeId) : null;

            // Fallback: find node by current page index if activeNodeId not found
            if (!nodeLayout && pages.length > 0) {
                // Try to find any node that could be focused
                const firstNode = renderableNodes[0];
                if (firstNode) {
                    nodeLayout = treeViewLayout.nodeLayouts.get(firstNode.id);
                }
            }

            if (!nodeLayout) {
                ackFn();
                return;
            }

            // Calculate scaled node rectangle
            const nodeX = nodeLayout.x * scale;
            const nodeY = nodeLayout.y * scale;
            const nodeW = nodeLayout.width * scale;
            const nodeH = nodeLayout.height * scale;

            // Get viewport bounds
            const viewLeft = container.scrollLeft;
            const viewTop = container.scrollTop;
            const viewRight = viewLeft + container.clientWidth;
            const viewBottom = viewTop + container.clientHeight;

            // Check if node is fully visible
            const isFullyVisible =
                nodeX >= viewLeft &&
                nodeY >= viewTop &&
                (nodeX + nodeW) <= viewRight &&
                (nodeY + nodeH) <= viewBottom;

            if (isFullyVisible) {
                ackFn();
                return;
            }

            // Calculate scroll position to center node in viewport
            const targetScrollLeft = nodeX + nodeW / 2 - container.clientWidth / 2;
            const targetScrollTop = nodeY + nodeH / 2 - container.clientHeight / 2;

            const maxScrollLeft = container.scrollWidth - container.clientWidth;
            const maxScrollTop = container.scrollHeight - container.clientHeight;

            container.scrollTo({
                left: Math.max(0, Math.min(targetScrollLeft, maxScrollLeft)),
                top: Math.max(0, Math.min(targetScrollTop, maxScrollTop)),
            });

            ackFn();
        });
    };

    // Handle container creation: set up mouse-pan for empty-space drag (PC only).
    // Cards no longer stop mousedown, so panning can start on a card; a pan that
    // moved 10px or more suppresses the click that follows, keeping page
    // selection for sub-threshold clicks only.
    const handleCreate = (container: HTMLElement) => {
        let isPanning = false;
        let panMoved = false;
        let panStartX = 0;
        let panStartY = 0;
        let panStartScrollLeft = 0;
        let panStartScrollTop = 0;

        const onPanMove = (e: MouseEvent) => {
            if (!isPanning) return;
            const dx = e.clientX - panStartX;
            const dy = e.clientY - panStartY;
            if (Math.sqrt(dx * dx + dy * dy) >= PAN_CLICK_SUPPRESS_THRESHOLD) {
                panMoved = true;
            }
            container.scrollLeft = panStartScrollLeft - dx;
            container.scrollTop  = panStartScrollTop  - dy;
        };

        const suppressNextClick = () => {
            const suppress = (e: MouseEvent) => {
                e.stopPropagation();
                e.preventDefault();
                cleanup();
            };
            const cleanup = () => {
                container.removeEventListener('click', suppress, true);
            };
            container.addEventListener('click', suppress, true);
            // The click (if any) fires synchronously after mouseup in the same task;
            // remove the guard afterwards so future clicks work normally.
            setTimeout(cleanup, 0);
        };

        const onPanEnd = () => {
            if (!isPanning) return;
            isPanning = false;
            document.removeEventListener('mousemove', onPanMove);
            document.removeEventListener('mouseup',   onPanEnd);
            container.style.cursor = '';
            if (panMoved) {
                suppressNextClick();
            }
        };

        const onPanStart = (e: MouseEvent) => {
            if (e.button !== 0) return;
            // Blur textarea when clicking on empty space
            const active = document.activeElement;
            if (active instanceof HTMLTextAreaElement) {
                active.blur();
            }
            isPanning = true;
            panMoved = false;
            panStartX          = e.clientX;
            panStartY          = e.clientY;
            panStartScrollLeft = container.scrollLeft;
            panStartScrollTop  = container.scrollTop;
            container.style.cursor = 'grabbing';
            document.addEventListener('mousemove', onPanMove);
            document.addEventListener('mouseup',   onPanEnd);
            e.preventDefault();  // suppress text selection during drag
        };

        container.addEventListener('mousedown', onPanStart);

        panCleanupFn = () => {
            container.removeEventListener('mousedown', onPanStart);
            if (isPanning) {
                document.removeEventListener('mousemove', onPanMove);
                document.removeEventListener('mouseup',   onPanEnd);
            }
            panCleanupFn = null;
        };

        handleAutoFocus(container);
    };

    // Handle container destruction: remove all pan and press listeners
    const handleDestroy = () => {
        if (panCleanupFn) {
            panCleanupFn();
        }
        cancelHeaderControlPress();
    };

    // Mouse released inside the tree: the drop target is resolved at the release point.
    const handleMouseUp = (e: MouseEvent) => {
        if (dragSourceNodeId !== null) {
            actions.onDrop(e.clientX, e.clientY, false);
        }
    };

    // Pointer left the tree viewport: only an add button under it still drops.
    const handleMouseLeave = (e: MouseEvent) => {
        if (dragSourceNodeId !== null) {
            actions.onDrop(e.clientX, e.clientY, true);
        }
    };

    // Mouse move during a drag: the view resolves the candidate and drives the ghost
    const handleSvgMouseMove = (e: MouseEvent) => {
        if (!isDragging || dragSourceNodeId === null) return;
        actions.onDragMove(e.clientX, e.clientY);
    };

    return (
        <div
            key="fumen-graph-container"
            datatest="fumen-graph-container"
            style={containerStyle}
            onmouseup={handleMouseUp}
            onmouseleave={handleMouseLeave}
            oncreate={handleCreate}
            onupdate={handleAutoFocus}
            ondestroy={handleDestroy}
        >
            <div
                key="fumen-graph-canvas"
                style={canvasStyle}
            >
                <svg
                    key="fumen-graph-base-svg"
                    width={scaledWidth}
                    height={scaledHeight}
                    style={style({ display: 'block', position: 'absolute', left: '0', top: '0', zIndex: 1 })}
                    onmousemove={handleSvgMouseMove}
                >
                    <defs>
                        <filter id="tree-card-shadow" x="-20%" y="-20%" width="140%" height="140%">
                            <feDropShadow
                                dx="0"
                                dy="1"
                                stdDeviation="2"
                                flood-color="#0F172A"
                                flood-opacity="0.14"
                            />
                        </filter>
                        <pattern id="tree-dot-grid" width="24" height="24" patternUnits="userSpaceOnUse">
                            <circle cx="12" cy="12" r="1.2" fill={TREE_COLORS.canvasDot} />
                        </pattern>
                    </defs>

                    {/* Dot-grid background */}
                    <rect width={scaledWidth} height={scaledHeight} fill="url(#tree-dot-grid)" />

                    {/* Scale transform group */}
                    <g key="scale-group" transform={`scale(${scale})`}>
                        {/* Connections layer (behind nodes) */}
                        <g key="connections-layer">
                            {connections}
                        </g>

                        {/* Lane reorder guides (between the lanes, behind the cards) */}
                        {laneGuideLayer}

                        {/* Card layer (below comments and controls) */}
                        <g key="cards-layer">
                            {nodeCards}
                        </g>
                    </g>
                </svg>
                {commentInputs}
                <svg
                    key="fumen-graph-controls-svg"
                    width={scaledWidth}
                    height={scaledHeight}
                    style={style({
                        display: 'block',
                        position: 'absolute',
                        left: '0',
                        top: '0',
                        zIndex: 3,
                        pointerEvents: 'none',
                    })}
                    onmousemove={handleSvgMouseMove}
                >
                    <defs>
                        <filter id="tree-control-button-shadow" x="-60%" y="-60%" width="220%" height="220%">
                            <feDropShadow
                                dx="0"
                                dy="1"
                                stdDeviation="1"
                                flood-color="#0F172A"
                                flood-opacity="0.25"
                            />
                        </filter>
                    </defs>
                    <g key="controls-scale-group" transform={`scale(${scale})`}>
                        <g key="controls-layer" style={style({ pointerEvents: 'auto' })}>
                            {nodeControls}
                            {rootAddGhostButton}
                        </g>
                        {/* Drag ghost stays above every control. */}
                        {dragGhost}
                    </g>
                </svg>
            </div>
        </div>
    );
};

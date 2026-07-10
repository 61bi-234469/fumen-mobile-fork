/**
 * FumenGraph component - SVG-based tree visualization for fumen pages
 */

import { Component, px, style } from '../../lib/types';
import { h } from 'hyperapp';
import { Page } from '../../lib/fumen/types';
import { TreeNode, TreeNodeId, SerializedTree } from '../../lib/fumen/tree_types';
import {
    canDeleteNode,
    findNode,
    canMoveNode,
    isDescendant,
    isVirtualNode,
} from '../../lib/fumen/tree_utils';
import { generateThumbnail } from '../../lib/thumbnail';
import { Pages, isTextCommentResult } from '../../lib/pages';
import { setTreeTouchStartPosition } from './tree_touch_state';
import { updateTreeDragGhost } from './tree_drag_ghost';
import { updateTreeAutoScrollPointer } from './tree_auto_scroll';
import { i18n } from '../../locales/keys';
import {
    TREE_ADD_BUTTON_SIZE,
    TREE_BUTTON_HIT_RADIUS,
    TREE_COMMENT_HEIGHT,
    TREE_COMMENT_MARGIN_X,
    TREE_COMMENT_TOP_OFFSET,
    TREE_COMMENT_WIDTH,
    TREE_COPY_BUTTON_HIT_RADIUS,
    TREE_COPY_BUTTON_SIZE,
    TREE_DELETE_BUTTON_HIT_RADIUS,
    TREE_DELETE_BUTTON_SIZE,
    TREE_DRAG_HANDLE_HEIGHT,
    TREE_DRAG_HANDLE_HIT_RADIUS,
    TREE_DRAG_HANDLE_WIDTH,
    TREE_DROP_BUTTON_SIZE,
    TREE_HORIZONTAL_GAP,
    TREE_NODE_RADIUS,
    TREE_NODE_WIDTH,
    TREE_PADDING,
    TREE_PAGE_NUMBER_OFFSET,
    TREE_SCROLL_PADDING_BOTTOM,
    TREE_SCROLL_PADDING_RIGHT,
    TREE_THUMBNAIL_WIDTH,
    TREE_VERTICAL_GAP,
    calculateTreeViewLayout,
    findTreeButtonDropTarget,
    getBranchButtonOffset,
    getCopyButtonOffset,
    getDeleteButtonOffset,
    getDragHandleOffset,
    getInsertButtonOffset,
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
    accent: '#2563EB',
    accentHalo: '#BFDBFE',
    accentBadgeBg: '#DBEAFE',
    connection: '#94A3B8',
    textMuted: '#64748B',
    insert: '#10B981',
    insertHover: '#34D399',
    branch: '#F59E0B',
    branchHover: '#FBBF24',
    delete: '#EF4444',
    disabled: '#94A3B8',
    ghostFill: '#F8FAFC',
    ghostBorder: '#94A3B8',
    commentChangedBg: '#10B981',
};

// Crisp path-drawn icons (replace text glyphs so buttons stay sharp at any zoom)
const iconPlus = (r: number) => (
    <path
        d={`M ${-r} 0 H ${r} M 0 ${-r} V ${r}`}
        stroke="#fff"
        stroke-width={2.4}
        stroke-linecap="round"
        fill="none"
    />
);

const iconCopy = (
    <g fill="none" stroke="#fff" stroke-width={1.6} stroke-linejoin="round">
        <path d="M -1.5 -5.5 H 3.5 A 1.5 1.5 0 0 1 5 -4 V 2" stroke-linecap="round" />
        <rect x={-5} y={-3.5} width={7} height={8.5} rx={1.5} />
    </g>
);

const iconTrash = (
    <g fill="none" stroke="#fff" stroke-width={1.5} stroke-linecap="round" stroke-linejoin="round">
        <path d="M -4.6 -3.4 H 4.6" />
        <path d="M -1.7 -3.4 V -5 H 1.7 V -3.4" />
        <path d="M -3.5 -3.4 L -2.9 5 H 2.9 L 3.5 -3.4 Z" />
        <path d="M -1.1 -1.3 V 2.9 M 1.1 -1.3 V 2.9" />
    </g>
);

// Quiet 6-dot grip used inside the bar-shaped drag handle.
const iconDragDots = (
    <g fill="#64748B">
        <circle cx={-5} cy={-2} r={1} />
        <circle cx={0} cy={-2} r={1} />
        <circle cx={5} cy={-2} r={1} />
        <circle cx={-5} cy={2} r={1} />
        <circle cx={0} cy={2} r={1} />
        <circle cx={5} cy={2} r={1} />
    </g>
);

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
    buttonDropMovesSubtree: boolean;
    trimTopBlank: boolean;
    autoFocusPending?: boolean;
    actions: {
        onNodeActivate: (nodeId: TreeNodeId) => void;
        onPageClick: (nodeId: TreeNodeId) => void;
        onAddBranch: (parentNodeId: TreeNodeId) => void;
        onInsertNode: (parentNodeId: TreeNodeId) => void;
        onCopyNode: (nodeId: TreeNodeId) => void;
        onDeleteNode: (nodeId: TreeNodeId) => void;
        onAddRoot: () => void;
        onCommentChange: (pageIndex: number, comment: string) => void;
        onHandleMouseDown: (nodeId: TreeNodeId, event: MouseEvent) => void;
        onHandleTouchStart: (nodeId: TreeNodeId, event: TouchEvent) => void;
        onDragOverButton: (parentNodeId: TreeNodeId, buttonType: 'insert' | 'branch') => void;
        onDragLeaveButton: () => void;
        onDrop: () => void;
        onDragEnd: () => void;
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
    isDragSource: boolean,
    isDragging: boolean,
    trimTopBlank: boolean,
) => {
    const pos = { x: nodeLayout.x, y: nodeLayout.y };
    const isActive = node.id === activeNodeId;
    const page = pages[node.pageIndex];
    const nodeHeight = nodeLayout.height;
    const thumbnailHeight = nodeLayout.thumbnailHeight;

    let thumbnailSrc = '';
    try {
        if (page) {
            thumbnailSrc = generateThumbnail(pages, node.pageIndex, guideLineColor, trimTopBlank);
        }
    } catch (e) {
        console.warn(`Failed to generate thumbnail for page ${node.pageIndex}:`, e);
    }

    const fillColor = isActive ? TREE_COLORS.cardActiveFill : TREE_COLORS.cardFill;
    const strokeColor = isActive ? TREE_COLORS.accent : TREE_COLORS.cardBorder;
    const strokeWidth = isActive ? 2 : 1;

    return (
        <g
            key={`node-card-${node.id}`}
            datatest={`tree-node-${node.id}`}
            transform={`translate(${pos.x}, ${pos.y})`}
            style={style({ cursor: 'pointer' })}
            onclick={() => {
                if (!isDragging) {
                    actions.onNodeActivate(node.id);
                }
            }}
        >
            <g opacity={isDragSource ? 0.5 : 1}>
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
                {thumbnailSrc && (
                    <image
                        x={(TREE_NODE_WIDTH - TREE_THUMBNAIL_WIDTH) / 2}
                        y={8}
                        width={TREE_THUMBNAIL_WIDTH}
                        height={thumbnailHeight}
                        href={thumbnailSrc}
                    />
                )}
            </g>
        </g>
    );
};

/** Render page and operation controls above comments. */
const renderNodeControls = (
    node: TreeNode,
    nodeLayout: TreeNodeLayout,
    activeNodeId: TreeNodeId | null,
    actions: Props['actions'],
    pageNumber: number,
    isDragSource: boolean,
    isDragging: boolean,
    isInsertButtonHighlighted: boolean,
    isBranchButtonHighlighted: boolean,
    isInsertDropTarget: boolean,
    isBranchDropTarget: boolean,
    hideButtons: boolean,
    hideInsertButton: boolean,
    hideBranchButton: boolean,
    canDelete: boolean,
    canCopy: boolean,
) => {
    const pos = { x: nodeLayout.x, y: nodeLayout.y };

    const isActive = node.id === activeNodeId;
    const nodeHeight = nodeLayout.height;
    const thumbnailHeight = nodeLayout.thumbnailHeight;

    const hasBranchButton = node.childrenIds.length > 0;
    const insertButtonOffset = getInsertButtonOffset(nodeHeight);
    const branchButtonOffset = getBranchButtonOffset(nodeHeight);
    const deleteButtonOffset = getDeleteButtonOffset();
    const copyButtonOffset = getCopyButtonOffset(nodeHeight);
    const dragHandleOffset = getDragHandleOffset(nodeHeight);
    const insertButtonSize = isInsertDropTarget ? TREE_DROP_BUTTON_SIZE : TREE_ADD_BUTTON_SIZE;
    const branchButtonSize = isBranchDropTarget ? TREE_DROP_BUTTON_SIZE : TREE_ADD_BUTTON_SIZE;

    const dragOpacity = isDragSource ? 0.5 : 1;
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

    return (
        <g
            key={`node-controls-${node.id}`}
            transform={`translate(${pos.x}, ${pos.y})`}
        >
            <g opacity={dragOpacity}>
            {/* Page number - clickable pill badge to jump to page */}
            {(() => {
                const label = `#${pageNumber}`;
                const pillWidth = 14 + label.length * 8;
                const pillHeight = 17;
                const pillCenterY = thumbnailHeight + TREE_PAGE_NUMBER_OFFSET - 5;
                return (
                    <g
                        datatest={`tree-page-link-${node.id}`}
                        style={style({ cursor: 'pointer' })}
                        onclick={(e: MouseEvent) => {
                            e.stopPropagation();
                            if (!isDragging) {
                                actions.onPageClick(node.id);
                            }
                        }}
                        onmousedown={(e: MouseEvent) => {
                            e.stopPropagation();
                        }}
                        ontouchstart={(e: TouchEvent) => {
                            e.stopPropagation();
                        }}
                    >
                        <rect
                            x={TREE_NODE_WIDTH / 2 - pillWidth / 2}
                            y={pillCenterY - pillHeight / 2}
                            width={pillWidth}
                            height={pillHeight}
                            rx={pillHeight / 2}
                            ry={pillHeight / 2}
                            fill={isActive ? TREE_COLORS.accent : TREE_COLORS.accentBadgeBg}
                        />
                        <text
                            x={TREE_NODE_WIDTH / 2}
                            y={pillCenterY}
                            text-anchor="middle"
                            dominant-baseline="central"
                            font-size="12"
                            font-weight="bold"
                            fill={isActive ? '#fff' : TREE_COLORS.accent}
                        >
                            {label}
                        </text>
                    </g>
                );
            })()}

            {/* Permanent delete button (top-right). Grayed out when the removal
                would delete every page. */}
            <g
                datatest={`btn-tree-node-delete-${node.id}`}
                transform={`translate(${deleteButtonOffset.x}, ${deleteButtonOffset.y})`}
                style={style({ cursor: canDelete && !isDragging ? 'pointer' : 'not-allowed' })}
                onmousedown={(e: MouseEvent) => {
                    e.stopPropagation();
                }}
                onclick={(e: MouseEvent) => {
                    e.stopPropagation();
                    if (!isDragging && canDelete) {
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
                <circle
                    r={TREE_DELETE_BUTTON_SIZE / 2}
                    fill={canDelete ? TREE_COLORS.delete : TREE_COLORS.disabled}
                    stroke="#fff"
                    stroke-width={2}
                    filter="url(#tree-control-button-shadow)"
                />
                {iconTrash}
            </g>

            {/* Copy button - below the node (outside node bounds) */}
            {canCopy && !isDragging && (
                <g
                    transform={`translate(${copyButtonOffset.x}, ${copyButtonOffset.y})`}
                    style={style({
                        cursor: isDragging ? 'default' : 'pointer',
                        pointerEvents: isDragging ? 'none' : 'auto',
                        opacity: isDragging ? 0.4 : 1,
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
                        r={TREE_COPY_BUTTON_SIZE / 2}
                        fill={TREE_COLORS.accent}
                        stroke="#fff"
                        stroke-width={2}
                        filter="url(#tree-control-button-shadow)"
                    />
                    {/* Duplicate-page icon */}
                    {iconCopy}
                </g>
            )}

            {/* Low-profile drag grip below the node. Dragging starts only here. */}
            <g
                datatest={`tree-handle-${node.id}`}
                transform={`translate(${dragHandleOffset.x}, ${dragHandleOffset.y})`}
                style={style({ cursor: 'grab' })}
                onmousedown={(e: MouseEvent) => {
                    if (e.button === 0) {
                        e.stopPropagation();
                        e.preventDefault();
                        actions.onHandleMouseDown(node.id, e);
                    }
                }}
                onclick={(e: MouseEvent) => {
                    // A handle press is never a page selection
                    e.stopPropagation();
                }}
                ontouchstart={(e: TouchEvent) => {
                    if (e.cancelable) {
                        e.preventDefault();
                    }
                    actions.onHandleTouchStart(node.id, e);
                }}
            >
                <title>{i18n.TreeView.DragHandle()}</title>
                <rect
                    x={-TREE_DRAG_HANDLE_HIT_RADIUS}
                    y={-TREE_DRAG_HANDLE_HIT_RADIUS}
                    width={TREE_DRAG_HANDLE_HIT_RADIUS * 2}
                    height={TREE_DRAG_HANDLE_HIT_RADIUS * 2}
                    fill="transparent"
                />
                <rect
                    x={-TREE_DRAG_HANDLE_WIDTH / 2}
                    y={-TREE_DRAG_HANDLE_HEIGHT / 2}
                    width={TREE_DRAG_HANDLE_WIDTH}
                    height={TREE_DRAG_HANDLE_HEIGHT}
                    rx={TREE_DRAG_HANDLE_HEIGHT / 2}
                    ry={TREE_DRAG_HANDLE_HEIGHT / 2}
                    fill="#E2E8F0"
                    stroke="#CBD5E1"
                    stroke-width={1}
                />
                {iconDragDots}
            </g>

            </g>

            {/* Add buttons wrapper - semi-transparent when dragging */}
            <g opacity={dragOpacity}>
            {/* Add buttons - INSERT (green) and Branch (orange) */}
            {!hideButtons && (hasBranchButton ? (
                // Two buttons placed symmetrically around the card center:
                // INSERT (green, above) and Branch (orange, below)
                <g key="add-buttons">
                    {!hideInsertButton && (
                    <g
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
                        {iconPlus(6)}
                    </g>
                    )}
                    {/* Orange Branch button */}
                    {!hideBranchButton && (
                    <g
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
                            fill={isBranchButtonHighlighted ? TREE_COLORS.branchHover : TREE_COLORS.branch}
                            stroke="#fff"
                            stroke-width={isBranchButtonHighlighted ? 3 : 2}
                            filter="url(#tree-control-button-shadow)"
                        />
                        {iconPlus(6)}
                    </g>
                    )}
                </g>
            ) : (
                // Single button: INSERT (green, centered at the connection-line level)
                !hideInsertButton && (
                <g
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
                    {iconPlus(6)}
                </g>
                )
            ))}
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
    buttonDropMovesSubtree,
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
    const isDragging = dragSourceNodeId !== null;
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
        && canMoveNode(tree, dragSourceNodeId, tree.rootId, {
            allowDescendant: !buttonDropMovesSubtree,
        });
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

    // Calculate source node for drag operations
    const sourceNode = isDragging ? findNode(tree, dragSourceNodeId) : null;
    const sourceParentId = sourceNode?.parentId ?? null;

    // Render cards below comments and controls above them.
    const nodeLayers = renderableNodes.map((node) => {
        const pageNumber = node.pageIndex + 1;
        const isDragSource = node.id === dragSourceNodeId;
        const hideDescendantButtons = isDragging
            && buttonDropMovesSubtree
            && dragSourceNodeId !== null
            && node.id !== dragSourceNodeId
            && isDescendant(tree, dragSourceNodeId, node.id);
        const isSourceParent = isDragging && sourceParentId === node.id;
        const hideSourceParentButtons = isSourceParent
            && node.childrenIds.length <= 1;
        const hideButtons = hideDescendantButtons || hideSourceParentButtons;
        const hideInsertButton = isSourceParent;
        const hideBranchButton = hideSourceParentButtons;
        const allowDescendant = !buttonDropMovesSubtree;
        const isRootDragSource = isDragging && buttonDropMovesSubtree
            && tree.rootId !== null && dragSourceNodeId === tree.rootId;
        const isValidDropParent = isDragging
            && dragSourceNodeId !== null
            && node.id !== dragSourceNodeId
            && !isRootDragSource
            && canMoveNode(tree, dragSourceNodeId, node.id, { allowDescendant });
        const isInsertDropTarget = isValidDropParent && sourceParentId !== node.id;
        const isBranchDropTarget = isValidDropParent
            && node.childrenIds.length > 0
            && !hideBranchButton;

        // Calculate button highlight state
        const isInsertButtonHighlighted = isDragging
            && dragTargetButtonParentId === node.id
            && dragTargetButtonType === 'insert';
        const isBranchButtonHighlighted = isDragging
            && dragTargetButtonParentId === node.id
            && dragTargetButtonType === 'branch';

        // Delete scope follows the removeTreeNode action: leaf nodes remove only
        // themselves, nodes with children follow the buttonDropMovesSubtree setting.
        const removeDescendants = node.childrenIds.length > 0 && buttonDropMovesSubtree;
        const canDelete = canDeleteNode(tree, node.id, removeDescendants, pages.length);

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
                isDragSource,
                isDragging,
                trimTopBlank,
            ),
            controls: renderNodeControls(
                node,
                nodeLayout,
                activeNodeId,
                actions,
                pageNumber,
                isDragSource,
                isDragging,
                isInsertButtonHighlighted,
                isBranchButtonHighlighted,
                isInsertDropTarget,
                isBranchDropTarget,
                hideButtons,
                hideInsertButton,
                hideBranchButton,
                canDelete,
                canCopy,
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
            src = generateThumbnail(pages, sourceNode.pageIndex, guideLineColor, trimTopBlank);
        } catch (e) {
            return null;
        }
        if (!src) return null;
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
            backgroundColor: showGreenStyle ? TREE_COLORS.commentChangedBg : '#fff',
            color: showGreenStyle ? '#fff' : '#334155',
            outline: 'none',
            pointerEvents: isDragging ? 'none' : 'auto',
            zIndex: 2,
        });

        return h('textarea', {
            key: `tree-comment-${node.id}`,
            style: textareaStyle,
            value: commentText,
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

    // Handle container destruction: remove all pan listeners
    const handleDestroy = () => {
        if (panCleanupFn) {
            panCleanupFn();
        }
    };

    // Handle global mouse up to end drag
    const handleMouseUp = () => {
        if (dragSourceNodeId !== null) {
            // If we have a valid drop target, execute the drop
            if (dragTargetButtonParentId !== null) {
                actions.onDrop();
            } else {
                actions.onDragEnd();
            }
        }
    };

    // Handle mouse move on SVG to detect drop-target buttons and drive the ghost
    const handleSvgMouseMove = (e: MouseEvent) => {
        if (!isDragging || dragSourceNodeId === null) return;

        const svg = e.currentTarget as SVGSVGElement;
        const rect = svg.getBoundingClientRect();
        // Account for scale when calculating mouse position in SVG coordinates
        const mouseX = (e.clientX - rect.left + (svg.parentElement?.scrollLeft ?? 0)) / scale;
        const mouseY = (e.clientY - rect.top + (svg.parentElement?.scrollTop ?? 0)) / scale;

        updateTreeDragGhost(mouseX, mouseY);
        updateTreeAutoScrollPointer(e.clientX, e.clientY);

        const foundButton = findTreeButtonDropTarget(
            tree,
            treeViewLayout,
            mouseX,
            mouseY,
            dragSourceNodeId,
            buttonDropMovesSubtree,
        );

        if (foundButton !== null) {
            actions.onDragOverButton(foundButton.nodeId, foundButton.type);
            return;
        }

        // No button hit - clear button target if it was set
        if (dragTargetButtonParentId !== null) {
            actions.onDragLeaveButton();
        }
    };

    return (
        <div
            key="fumen-graph-container"
            datatest="fumen-graph-container"
            style={containerStyle}
            onmouseup={handleMouseUp}
            onmouseleave={handleMouseUp}
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

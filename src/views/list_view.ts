import { View, h } from 'hyperapp';
import { div } from '@hyperapp/html';
import { State } from '../states';
import { Actions } from '../actions';
import { Screens } from '../lib/enums';
import { Palette } from '../lib/colors';
import { i18n } from '../locales/keys';
import { ListViewTools } from '../components/tools/list_view_tools';
import { ListViewGrid } from '../components/list_view/list_view_grid';
import { FumenGraph } from '../components/tree/fumen_graph';
import { TreeViewMode, TreeDragMode } from '../lib/fumen/tree_types';
import { style, px } from '../lib/types';
import { canDeleteNode, canMoveNode, findNode, isVirtualNode } from '../lib/fumen/tree_utils';
import { displayShortcut } from '../lib/shortcuts';
import {
    calculateTreeMinDepth,
    TREE_BUTTON_HIT_RADIUS,
    TREE_COPY_BUTTON_HIT_RADIUS,
    TREE_DELETE_BADGE_HIT_RADIUS,
    TREE_NODE_WIDTH,
    calculateTreeViewLayout,
    getBranchButtonOffset,
    getCopyButtonOffset,
    getDeleteBadgeOffset,
    getInsertButtonOffset,
    getRootGhostRect,
    shouldShowDeleteBadge,
} from '../lib/fumen/tree_view_layout';
const TOOLS_HEIGHT = 50;

// Pinch-to-zoom state (kept outside component for persistence across renders)
let pinchState: {
    active: boolean;
    initialDistance: number;
    initialScale: number;
    isTreeView: boolean;
} = {
    active: false,
    initialDistance: 0,
    initialScale: 1.0,
    isTreeView: false,
};

// Touch drag state for detecting drop target
let touchDragActive = false;
let treeTouchDragActive = false;

// Touch start position for detecting button taps (clientX/clientY coordinates)
let treeTouchStartPosition: { x: number; y: number } | null = null;
let treeTouchContainerElement: HTMLElement | null = null;
let treeTouchStartTarget: EventTarget | null = null;
let treeTouchEndHandled = false;
let treeTouchEndCleanup: (() => void) | null = null;
let latestTreeTouchMoveHandler: ((e: TouchEvent) => void) | null = null;
let latestTreeTouchEndHandler: ((e: TouchEvent) => void) | null = null;
let latestTreeTouchCancelHandler: ((e: TouchEvent) => void) | null = null;

const clearTreeTouchStartPosition = () => {
    treeTouchStartPosition = null;
    if (typeof window !== 'undefined') {
        (window as any).__treeTouchStartPosition = undefined;
    }
};

const cleanupTreeTouchEndListeners = () => {
    if (treeTouchEndCleanup) {
        treeTouchEndCleanup();
        treeTouchEndCleanup = null;
    }
};

const resetTreeTouchTracking = () => {
    cleanupTreeTouchEndListeners();
    treeTouchDragActive = false;
    treeTouchStartTarget = null;
    clearTreeTouchStartPosition();
};

const registerTreeTouchStartTarget = (target: EventTarget) => {
    cleanupTreeTouchEndListeners();
    treeTouchStartTarget = target;

    const onTouchMove: EventListener = (event) => {
        const e = event as TouchEvent;
        event.stopPropagation();
        if (latestTreeTouchMoveHandler) {
            latestTreeTouchMoveHandler(e);
        }
    };
    const onTouchEnd: EventListener = (event) => {
        const e = event as TouchEvent;
        treeTouchEndHandled = true;
        event.stopPropagation();
        if (latestTreeTouchEndHandler) {
            latestTreeTouchEndHandler(e);
        } else {
            resetTreeTouchTracking();
        }
    };
    const onTouchCancel: EventListener = (event) => {
        const e = event as TouchEvent;
        treeTouchEndHandled = true;
        event.stopPropagation();
        if (latestTreeTouchCancelHandler) {
            latestTreeTouchCancelHandler(e);
        } else {
            resetTreeTouchTracking();
        }
    };

    target.addEventListener('touchmove', onTouchMove, true);
    target.addEventListener('touchend', onTouchEnd, true);
    target.addEventListener('touchcancel', onTouchCancel, true);
    treeTouchEndCleanup = () => {
        target.removeEventListener('touchmove', onTouchMove, true);
        target.removeEventListener('touchend', onTouchEnd, true);
        target.removeEventListener('touchcancel', onTouchCancel, true);
    };
};

const getDistance = (touch1: Touch, touch2: Touch): number => {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
};

export const view: View<State, Actions> = (state, actions) => {
    const palette = Palette(Screens.ListView);

    const containerStyle = style({
        width: '100%',
        height: px(state.display.height),
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#f5f5f5',
    });

    const isTreeView = state.tree.enabled && state.tree.viewMode === TreeViewMode.Tree;
    const buttonDropMovesSubtree = state.tree.buttonDropMovesSubtree;
    const grayAfterLineClear = state.tree.grayAfterLineClear;
    // Lock undo/redo buttons for 500ms after transitioning to list/tree view
    // This prevents accidental button presses from screen transition touch events
    const listViewNavLocked = Date.now() < state.tree.treeViewNavLockUntil;
    const undoEnabled = state.history.undoCount > 0 && !listViewNavLocked;
    const redoEnabled = state.history.redoCount > 0 && !listViewNavLocked;
    const trimTopBlank = state.listView.trimTopBlank;
    const gridContainerHeight = state.display.height - TOOLS_HEIGHT;
    const showShortcutLabel = state.mode.shortcutLabelVisible;

    // Returns slot index (0 = before first page, N = after last page)
    const getDropSlotFromTouch = (touchX: number, touchY: number, gridElement: HTMLElement): number | null => {
        const pageCount = state.fumen.pages.length;
        if (pageCount === 0) return null;

        const itemElements = Array.from(
            gridElement.querySelectorAll('[datatest^="list-view-item-"]'),
        ) as HTMLElement[];

        const items = itemElements
            .map((element) => {
                const datatest = element.getAttribute('datatest') ?? '';
                const match = /list-view-item-(\d+)/.exec(datatest);
                if (!match) {
                    return null;
                }
                return {
                    index: Number(match[1]),
                    rect: element.getBoundingClientRect(),
                };
            })
            .filter((item): item is { index: number; rect: DOMRect } => item !== null);

        if (items.length === 0) {
            return null;
        }

        items.sort((a, b) => {
            const rowDiff = a.rect.top - b.rect.top;
            return rowDiff !== 0 ? rowDiff : a.rect.left - b.rect.left;
        });

        const rows: { top: number; bottom: number; items: typeof items }[] = [];
        const rowThreshold = 4;

        for (const item of items) {
            const lastRow = rows[rows.length - 1];
            if (!lastRow || Math.abs(item.rect.top - lastRow.top) > rowThreshold) {
                rows.push({
                    top: item.rect.top,
                    bottom: item.rect.bottom,
                    items: [item],
                });
            } else {
                lastRow.items.push(item);
                lastRow.top = Math.min(lastRow.top, item.rect.top);
                lastRow.bottom = Math.max(lastRow.bottom, item.rect.bottom);
            }
        }

        let targetRow = rows.find(row => touchY >= row.top && touchY <= row.bottom);
        if (!targetRow) {
            targetRow = rows.reduce((closest, row) => {
                const closestCenter = (closest.top + closest.bottom) / 2;
                const rowCenter = (row.top + row.bottom) / 2;
                return Math.abs(touchY - rowCenter) < Math.abs(touchY - closestCenter) ? row : closest;
            }, rows[0]);
        }

        const rowItems = [...targetRow.items].sort((a, b) => a.rect.left - b.rect.left);
        const firstItem = rowItems[0];
        const lastItem = rowItems[rowItems.length - 1];

        let slotIndex: number = lastItem.index + 1;

        if (touchX < firstItem.rect.left) {
            slotIndex = firstItem.index;
        } else if (touchX > lastItem.rect.right) {
            slotIndex = lastItem.index + 1;
        } else {
            for (const item of rowItems) {
                if (touchX >= item.rect.left && touchX <= item.rect.right) {
                    const isLeftHalf = touchX < item.rect.left + item.rect.width / 2;
                    slotIndex = isLeftHalf ? item.index : item.index + 1;
                    break;
                }
                if (touchX < item.rect.left) {
                    slotIndex = item.index;
                    break;
                }
            }
        }

        // Clamp to valid range [0, pageCount]
        return Math.max(0, Math.min(pageCount, slotIndex));
    };

    const handleTouchMoveForDrag = (e: TouchEvent) => {
        if (state.listView.dragState.draggingIndex === null) return;
        if (e.touches.length !== 1) return;
        if (pinchState.active) return;

        touchDragActive = true;
        const touch = e.touches[0];
        const container = e.currentTarget as HTMLElement;
        const gridElement = container.querySelector('[key="list-view-grid-container"]') as HTMLElement;
        if (!gridElement) return;

        const draggingIndex = state.listView.dragState.draggingIndex;
        const targetSlot = getDropSlotFromTouch(touch.clientX, touch.clientY, gridElement);

        // Skip no-op slots (slots N and N+1 for page N result in no movement)
        const isNoOpSlot = targetSlot === draggingIndex || targetSlot === draggingIndex + 1;

        if (targetSlot !== null && !isNoOpSlot) {
            if (state.listView.dragState.dropTargetIndex !== targetSlot) {
                actions.setListViewDragState({
                    draggingIndex,
                    dropTargetIndex: targetSlot,
                });
            }
        } else if (state.listView.dragState.dropTargetIndex !== null) {
            actions.setListViewDragState({
                draggingIndex,
                dropTargetIndex: null,
            });
        }
    };

    const handleTouchEndForDrag = () => {
        if (!touchDragActive) {
            pinchState.active = false;
            return;
        }

        touchDragActive = false;
        const fromIndex = state.listView.dragState.draggingIndex;
        const toSlotIndex = state.listView.dragState.dropTargetIndex;

        if (fromIndex !== null && toSlotIndex !== null) {
            actions.reorderPage({
                fromIndex,
                toSlotIndex,
            });
        }

        actions.setListViewDragState({
            draggingIndex: null,
            dropTargetIndex: null,
        });

        pinchState.active = false;
    };

    // Detect if a position is over a button (returns button info or null)
    const detectButtonAtPosition = (
        clientX: number,
        clientY: number,
        container: HTMLElement,
    ): { nodeId: string; type: 'insert' | 'branch' | 'copy' } | null => {
        const svgElement = container.querySelector('svg') as SVGSVGElement;
        if (!svgElement) return null;
        const scrollContainer = svgElement.parentElement as HTMLElement;
        if (!scrollContainer) return null;

        const scrollContainerRect = scrollContainer.getBoundingClientRect();
        const scale = state.tree.scale;
        const svgX = (clientX - scrollContainerRect.left + scrollContainer.scrollLeft) / scale;
        const svgY = (clientY - scrollContainerRect.top + scrollContainer.scrollTop) / scale;

        const tree = {
            nodes: state.tree.nodes,
            rootId: state.tree.rootId,
            version: 1 as const,
        };
        const treeViewLayout = calculateTreeViewLayout(tree, state.fumen.pages, trimTopBlank);

        for (const node of state.tree.nodes) {
            const nodeLayout = treeViewLayout.nodeLayouts.get(node.id);
            if (!nodeLayout) continue;

            const nodeX = nodeLayout.x;
            const nodeY = nodeLayout.y;
            const nodeHeight = nodeLayout.height;
            const canCopy = !isVirtualNode(node);

            const copyOffset = getCopyButtonOffset(nodeHeight);
            const copyButtonCenterX = nodeX + copyOffset.x;
            const copyButtonCenterY = nodeY + copyOffset.y;

            const distToCopy = Math.sqrt(
                (svgX - copyButtonCenterX) ** 2 +
                (svgY - copyButtonCenterY) ** 2,
            );

            if (canCopy && distToCopy <= TREE_COPY_BUTTON_HIT_RADIUS) {
                return { nodeId: node.id, type: 'copy' };
            }

            // Check INSERT button (green)
            const insertOffset = getInsertButtonOffset(nodeHeight);
            const insertButtonCenterX = nodeX + insertOffset.x;
            const insertButtonCenterY = nodeY + insertOffset.y;

            const distToInsert = Math.sqrt(
                (svgX - insertButtonCenterX) ** 2 +
                (svgY - insertButtonCenterY) ** 2,
            );

            if (distToInsert <= TREE_BUTTON_HIT_RADIUS) {
                return { nodeId: node.id, type: 'insert' };
            }

            // Check BRANCH button (orange) - only if node has children
            if (node.childrenIds.length > 0) {
                const branchOffset = getBranchButtonOffset(nodeHeight);
                const branchButtonCenterX = nodeX + branchOffset.x;
                const branchButtonCenterY = nodeY + branchOffset.y;

                const distToBranch = Math.sqrt(
                    (svgX - branchButtonCenterX) ** 2 +
                    (svgY - branchButtonCenterY) ** 2,
                );

                if (distToBranch <= TREE_BUTTON_HIT_RADIUS) {
                    return { nodeId: node.id, type: 'branch' };
                }
            }
        }

        return null;
    };

    // Tree view touch handlers
    const handleTreeTouchMove = (e: TouchEvent) => {
        if (state.tree.dragState.sourceNodeId === null) return;
        if (e.touches.length !== 1) return;
        if (pinchState.active) return;

        const touch = e.touches[0];

        // Get touch start position from global (set by fumen_graph.tsx node's ontouchstart)
        const globalTouchPos = typeof window !== 'undefined'
            ? (window as any).__treeTouchStartPosition as { x: number; y: number } | undefined
            : undefined;
        const startPos = globalTouchPos ?? treeTouchStartPosition;

        // Require minimum movement distance before activating drag (prevents accidental drag on button tap)
        if (!treeTouchDragActive && startPos) {
            const dx = touch.clientX - startPos.x;
            const dy = touch.clientY - startPos.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const DRAG_THRESHOLD = 10; // 10px minimum movement to start drag
            if (distance < DRAG_THRESHOLD) {
                return; // Not enough movement yet
            }
        }

        treeTouchDragActive = true;
        const container = treeTouchContainerElement ?? (e.currentTarget as HTMLElement);
        treeTouchContainerElement = container;

        // Find the scroll container - it's the div containing the SVG with overflow:auto
        const svgElement = container.querySelector('svg') as SVGSVGElement;
        if (!svgElement) return;
        const scrollContainer = svgElement.parentElement as HTMLElement;
        if (!scrollContainer) return;

        const scrollContainerRect = scrollContainer.getBoundingClientRect();

        // Calculate position relative to scroll container, then add scroll offset
        // This gives us the position within the full SVG content
        const scale = state.tree.scale;
        const svgX = (touch.clientX - scrollContainerRect.left + scrollContainer.scrollLeft) / scale;
        const svgY = (touch.clientY - scrollContainerRect.top + scrollContainer.scrollTop) / scale;

        // Build tree structure for layout calculation
        const tree = {
            nodes: state.tree.nodes,
            rootId: state.tree.rootId,
            version: 1 as const,
        };

        const treeViewLayout = calculateTreeViewLayout(tree, state.fumen.pages, trimTopBlank);
        const dragMode = state.tree.dragState.mode;
        const sourceNodeId = state.tree.dragState.sourceNodeId;
        const sourceParentId = sourceNodeId ? findNode(tree, sourceNodeId)?.parentId ?? null : null;
        const allowDescendantOnButtonDrop = !buttonDropMovesSubtree; // block descendant targets when moving subtree
        const isRootDragSource = buttonDropMovesSubtree && sourceNodeId !== null
            && tree.rootId !== null && sourceNodeId === tree.rootId;

        // Find button or node under touch position
        let foundNodeId: string | null = null;
        let foundSlotIndex: number | null = null;
        let foundButtonParentId: string | null = null;
        let foundButtonType: 'insert' | 'branch' | 'delete' | null = null;

        const rootNode = tree.rootId ? findNode(tree, tree.rootId) : undefined;
        const canDropOnRootGhost = tree.rootId !== null
            && sourceNodeId !== null
            && sourceNodeId !== tree.rootId
            && rootNode !== undefined
            && isVirtualNode(rootNode)
            && canMoveNode(tree, sourceNodeId, tree.rootId, {
                allowDescendant: allowDescendantOnButtonDrop,
            });

        // Keep delete badge visibility/hit test criteria in sync with desktop rendering.
        const minDepth = calculateTreeMinDepth(tree, treeViewLayout.layout);

        // Check delete badge first (left-edge OR parent on a different lane)
        if (sourceNodeId) {
            const sourceNodeLayout = treeViewLayout.nodeLayouts.get(sourceNodeId);
            if (
                sourceNodeLayout
                && shouldShowDeleteBadge(tree, treeViewLayout.layout, sourceNodeId, minDepth)
            ) {
                const badgeOffset = getDeleteBadgeOffset();
                const deleteBadgeX = sourceNodeLayout.x + badgeOffset.x;
                const deleteBadgeY = sourceNodeLayout.y + badgeOffset.y;
                const distToDelete = Math.sqrt(
                    (svgX - deleteBadgeX) ** 2 + (svgY - deleteBadgeY) ** 2,
                );

                if (distToDelete <= TREE_DELETE_BADGE_HIT_RADIUS) {
                    const canDelete = canDeleteNode(
                        tree, sourceNodeId, buttonDropMovesSubtree, state.fumen.pages.length,
                    );

                    if (canDelete) {
                        foundButtonParentId = sourceNodeId;
                        foundButtonType = 'delete';
                    }
                }
            }
        }

        // Check the top-level ghost frame as a branch drop onto the virtual root.
        if (foundButtonParentId === null && canDropOnRootGhost && tree.rootId !== null) {
            const ghostRect = getRootGhostRect(treeViewLayout.contentHeight);
            const isInsideRootGhost = svgX >= ghostRect.x
                && svgX <= ghostRect.x + ghostRect.width
                && svgY >= ghostRect.y
                && svgY <= ghostRect.y + ghostRect.height;

            if (isInsideRootGhost) {
                foundButtonParentId = tree.rootId;
                foundButtonType = 'branch';
            }
        }

        // First pass: Check ALL buttons (they have priority over nodes) - only if no delete badge hit
        if (foundButtonParentId === null) {
            for (const node of state.tree.nodes) {
                const nodeLayout = treeViewLayout.nodeLayouts.get(node.id);
                if (!nodeLayout) continue;

                const nodeX = nodeLayout.x;
                const nodeY = nodeLayout.y;
                const nodeHeight = nodeLayout.height;

                // Check INSERT button (green)
                const insertOffset = getInsertButtonOffset(nodeHeight);
                const insertButtonCenterX = nodeX + insertOffset.x;
                const insertButtonCenterY = nodeY + insertOffset.y;

                const distToInsert = Math.sqrt(
                    (svgX - insertButtonCenterX) ** 2 +
                    (svgY - insertButtonCenterY) ** 2,
                );

                if (distToInsert <= TREE_BUTTON_HIT_RADIUS) {
                    const isValidTarget = !isRootDragSource
                        && canMoveNode(tree, sourceNodeId!, node.id, { allowDescendant: allowDescendantOnButtonDrop });
                    if (isValidTarget) {
                        foundButtonParentId = node.id;
                        foundButtonType = 'insert';
                        break;  // Only break when we found a valid target
                    }
                    // If not valid target, continue checking other buttons
                    continue;
                }

                // Check BRANCH button (orange) - only if node has children
                const hideBranchButton = sourceParentId !== null
                    && sourceParentId === node.id
                    && node.childrenIds.length <= 1;
                if (node.childrenIds.length > 0 && !hideBranchButton) {
                    const branchOffset = getBranchButtonOffset(nodeHeight);
                    const branchButtonCenterX = nodeX + branchOffset.x;
                    const branchButtonCenterY = nodeY + branchOffset.y;

                    const distToBranch = Math.sqrt(
                        (svgX - branchButtonCenterX) ** 2 +
                        (svgY - branchButtonCenterY) ** 2,
                    );

                    if (distToBranch <= TREE_BUTTON_HIT_RADIUS) {
                        const opts = { allowDescendant: allowDescendantOnButtonDrop };
                        const isValidTarget = !isRootDragSource
                            && canMoveNode(tree, sourceNodeId!, node.id, opts);
                        if (isValidTarget) {
                            foundButtonParentId = node.id;
                            foundButtonType = 'branch';
                            break;  // Only break when we found a valid target
                        }
                        // If not valid target, continue checking other buttons
                        continue;
                    }
                }
            }
        }

        // Second pass: Check node bounds (only if no button was found)
        if (foundButtonParentId === null) {
            for (const node of state.tree.nodes) {
                const nodeLayout = treeViewLayout.nodeLayouts.get(node.id);
                if (!nodeLayout) continue;

                const nodeX = nodeLayout.x;
                const nodeY = nodeLayout.y;
                const nodeHeight = nodeLayout.height;

                // Check if touch is within node bounds
                if (svgX >= nodeX && svgX <= nodeX + TREE_NODE_WIDTH &&
                    svgY >= nodeY && svgY <= nodeY + nodeHeight) {
                    const pageIndex = node.pageIndex;

                    if (dragMode !== TreeDragMode.Reorder) {
                        // Attach modes: need valid target
                        const isValidTarget = canMoveNode(tree, sourceNodeId!, node.id);
                        if (isValidTarget) {
                            foundNodeId = node.id;
                            foundSlotIndex = pageIndex + 1;
                        }
                    }
                    break;
                }
            }
        }

        // Update button target state
        if (foundButtonParentId !== null) {
            if (state.tree.dragState.targetButtonParentId !== foundButtonParentId ||
                state.tree.dragState.targetButtonType !== foundButtonType) {
                actions.updateTreeDragButtonTarget({
                    parentNodeId: foundButtonParentId,
                    buttonType: foundButtonType,
                });
            }
            // Clear node targets when over button
            if (state.tree.dragState.targetNodeId !== null) {
                actions.updateTreeDragTarget({ targetNodeId: null });
            }
            if (state.tree.dragState.dropSlotIndex !== null) {
                actions.updateTreeDropSlot({ slotIndex: null });
            }
        } else {
            // Clear button target if not over any button
            if (state.tree.dragState.targetButtonParentId !== null) {
                actions.updateTreeDragButtonTarget({ parentNodeId: null, buttonType: null });
            }

            if (dragMode === TreeDragMode.Reorder) {
                if (state.tree.dragState.targetNodeId !== null) {
                    actions.updateTreeDragTarget({ targetNodeId: null });
                }
                if (state.tree.dragState.dropSlotIndex !== null) {
                    actions.updateTreeDropSlot({ slotIndex: null });
                }
                return;
            }

            // Attach modes
            if (foundNodeId !== null) {
                if (state.tree.dragState.targetNodeId !== foundNodeId) {
                    actions.updateTreeDragTarget({ targetNodeId: foundNodeId });
                }
                if (foundSlotIndex !== null && state.tree.dragState.dropSlotIndex !== foundSlotIndex) {
                    actions.updateTreeDropSlot({ slotIndex: foundSlotIndex });
                }
            } else {
                if (state.tree.dragState.targetNodeId !== null) {
                    actions.updateTreeDragTarget({ targetNodeId: null });
                }
                if (state.tree.dragState.dropSlotIndex !== null) {
                    actions.updateTreeDropSlot({ slotIndex: null });
                }
            }
        }
    };

    const handleTreeTouchEnd = (e: TouchEvent) => {
        cleanupTreeTouchEndListeners();
        const container = treeTouchContainerElement ?? (e.currentTarget as HTMLElement);

        // Get touch start position from global (set by fumen_graph.tsx node's ontouchstart)
        // This is necessary because the node's ontouchstart fires before the container's
        const globalTouchPos = typeof window !== 'undefined'
            ? (window as any).__treeTouchStartPosition as { x: number; y: number } | undefined
            : undefined;
        const touchStartPos = globalTouchPos ?? treeTouchStartPosition;

        if (!treeTouchDragActive) {
            // No drag happened - check if this was a button tap
            if (touchStartPos !== null && touchStartPos !== undefined) {
                const buttonHit = detectButtonAtPosition(
                    touchStartPos.x,
                    touchStartPos.y,
                    container,
                );
                clearTreeTouchStartPosition();

                if (buttonHit) {
                    // Button was tapped - execute the action
                    actions.endTreeDrag();
                    if (buttonHit.type === 'insert') {
                        actions.insertNodeAfterCurrent({ parentNodeId: buttonHit.nodeId });
                    } else if (buttonHit.type === 'branch') {
                        actions.addBranchFromCurrentNode({ parentNodeId: buttonHit.nodeId });
                    } else {
                        actions.copyTreeNode({ nodeId: buttonHit.nodeId });
                    }
                    pinchState.active = false;
                    resetTreeTouchTracking();
                    return;
                }
            }

            // Not a button tap - blur textarea on empty space tap
            const active = document.activeElement;
            if (active instanceof HTMLTextAreaElement) {
                active.blur();
            }
            if (state.tree.dragState.sourceNodeId !== null) {
                actions.endTreeDrag();
            }
            pinchState.active = false;
            resetTreeTouchTracking();
            return;
        }

        treeTouchDragActive = false;

        const {
            sourceNodeId,
            targetNodeId,
            dropSlotIndex,
            mode,
            targetButtonParentId,
            targetButtonType,
        } = state.tree.dragState;

        let didDrop = false;
        if (sourceNodeId !== null) {
            // Priority 1: Button drop
            if (targetButtonParentId !== null && targetButtonType !== null) {
                actions.executeTreeDrop();
                didDrop = true;
            // Priority 2: Attach mode with target node
            } else if (mode !== TreeDragMode.Reorder && targetNodeId !== null && dropSlotIndex !== null) {
                actions.executeTreeDrop();
                didDrop = true;
            }
        }

        if (!didDrop) {
            actions.endTreeDrag();
        }
        pinchState.active = false;
        resetTreeTouchTracking();
    };

    const handleTreeTouchCancel = () => {
        cleanupTreeTouchEndListeners();
        if (state.tree.dragState.sourceNodeId !== null) {
            actions.endTreeDrag();
        }
        pinchState.active = false;
        resetTreeTouchTracking();
    };

    latestTreeTouchMoveHandler = handleTreeTouchMove;
    latestTreeTouchEndHandler = handleTreeTouchEnd;
    latestTreeTouchCancelHandler = handleTreeTouchCancel;

    const cornerOffset = 8;
    const undoRedoPillHeight = 56;
    const settingsButtonSize = 48;
    const settingsOpened = state.listView.settingsOpened;
    const treeAiButtonBottom = cornerOffset + settingsButtonSize + 12;

    const treeAiButtonStyle = style({
        position: 'fixed',
        bottom: px(treeAiButtonBottom),
        right: px(cornerOffset),
        width: px(48),
        height: px(48),
        borderRadius: px(16),
        border: 'none',
        background: state.coldClear.isRunning
            ? 'linear-gradient(135deg, #F87171 0%, #DC2626 100%)'
            : 'linear-gradient(135deg, #3B82F6 0%, #4F46E5 100%)',
        color: '#fff',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: state.coldClear.isRunning
            ? '0 8px 20px rgba(220,38,38,0.35), 0 2px 6px rgba(15,23,42,0.12)'
            : '0 8px 20px rgba(59,130,246,0.35), 0 2px 6px rgba(15,23,42,0.12)',
        zIndex: 100,
    });

    const treeButtonToggleLabelStyle = style({
        fontSize: px(12),
        fontWeight: 600,
        color: '#334155',
        whiteSpace: 'nowrap',
        letterSpacing: '0.01em',
    });

    const treeButtonToggleSwitchStyle = (isOn: boolean) => style({
        position: 'relative',
        width: px(42),
        height: px(24),
        backgroundColor: isOn ? '#2563EB' : '#CBD5E1',
        borderRadius: px(12),
        transition: 'background-color 0.25s ease',
        flex: 'none',
        boxShadow: 'inset 0 1px 2px rgba(15,23,42,0.12)',
    });

    const treeButtonToggleKnobStyle = (isOn: boolean) => style({
        position: 'absolute',
        top: px(2),
        left: isOn ? px(20) : px(2),
        width: px(20),
        height: px(20),
        backgroundColor: '#fff',
        borderRadius: '50%',
        transition: 'left 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        boxShadow: '0 1px 3px rgba(15,23,42,0.35)',
    });

    const cornerIconButtonStyle = (enabled: boolean, size: number) => style({
        width: px(size),
        height: px(size),
        border: 'none',
        borderRadius: '50%',
        backgroundColor: 'transparent',
        color: enabled ? '#334155' : '#CBD5E1',
        cursor: enabled ? 'pointer' : 'default',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
    });

    const zoomResetButtonStyle = style({
        minWidth: px(52),
        height: px(36),
        border: 'none',
        borderRadius: px(18),
        backgroundColor: 'transparent',
        color: '#334155',
        fontSize: px(13),
        fontWeight: 600,
        cursor: 'pointer',
        padding: '0 6px',
        fontVariantNumeric: 'tabular-nums',
    });

    const cornerDividerStyle = style({
        width: px(1),
        height: px(22),
        backgroundColor: 'rgba(148,163,184,0.4)',
        flex: 'none',
    });

    const renderTreeZoomControls = () => div({
        key: 'tree-zoom-controls',
        className: 'corner-glass',
        style: style({
            position: 'fixed',
            bottom: px(cornerOffset + undoRedoPillHeight + 10),
            left: px(cornerOffset),
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: px(2),
            padding: px(4),
            borderRadius: px(22),
            zIndex: 100,
        }),
    }, [
        h('button', {
            key: 'btn-tree-zoom-out',
            datatest: 'btn-tree-zoom-out',
            title: i18n.TreeView.ZoomOut(),
            className: 'corner-btn',
            style: cornerIconButtonStyle(true, 36),
            onclick: () => actions.setTreeViewScale({ scale: state.tree.scale / 1.2 }),
        }, [
            h('i', { className: 'material-icons', style: style({ fontSize: px(20) }) }, 'remove'),
        ]),
        h('button', {
            key: 'btn-tree-zoom-reset',
            datatest: 'btn-tree-zoom-reset',
            title: i18n.TreeView.ZoomReset(),
            className: 'corner-btn',
            style: zoomResetButtonStyle,
            onclick: () => actions.setTreeViewScale({ scale: 1.0 }),
        }, `${Math.round(state.tree.scale * 100)}%`),
        h('button', {
            key: 'btn-tree-zoom-in',
            datatest: 'btn-tree-zoom-in',
            title: i18n.TreeView.ZoomIn(),
            className: 'corner-btn',
            style: cornerIconButtonStyle(true, 36),
            onclick: () => actions.setTreeViewScale({ scale: state.tree.scale * 1.2 }),
        }, [
            h('i', { className: 'material-icons', style: style({ fontSize: px(20) }) }, 'add'),
        ]),
    ]);

    const settingsRowStyle = style({
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: px(16),
        padding: '10px 16px',
        cursor: 'pointer',
    });

    const settingsDividerStyle = style({
        height: px(1),
        margin: '0 12px',
        backgroundColor: 'rgba(148,163,184,0.25)',
        flex: 'none',
    });

    const renderSettingsRow = (
        key: string,
        label: string,
        isOn: boolean,
        onClick: () => void,
    ) => div({
        key,
        style: settingsRowStyle,
        onclick: onClick,
    }, [
        h('span', { style: treeButtonToggleLabelStyle }, label),
        h('div', {
            style: treeButtonToggleSwitchStyle(isOn),
        }, [
            h('div', { style: treeButtonToggleKnobStyle(isOn) }),
        ]),
    ]);

    const renderSettingsPopover = () => div({
        key: 'view-settings-popover',
        className: 'corner-glass',
        style: style({
            position: 'fixed',
            right: px(cornerOffset),
            bottom: px(cornerOffset + settingsButtonSize + 10),
            minWidth: px(230),
            borderRadius: px(16),
            padding: '6px 0',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 120,
        }),
    }, isTreeView ? [
        renderSettingsRow(
            'settings-trim-top',
            i18n.ListView.TrimTopBlank(),
            trimTopBlank,
            () => actions.setListViewTrimTopBlank({ enabled: !trimTopBlank }),
        ),
        div({ key: 'settings-divider-1', style: settingsDividerStyle }),
        renderSettingsRow(
            'settings-move-children',
            i18n.TreeView.MoveWithChildren(),
            buttonDropMovesSubtree,
            () => actions.setTreeState({
                buttonDropMovesSubtree: !buttonDropMovesSubtree,
            }),
        ),
        div({ key: 'settings-divider-2', style: settingsDividerStyle }),
        renderSettingsRow(
            'settings-gray-clear',
            i18n.TreeView.GrayAfterLineClear(),
            grayAfterLineClear,
            () => actions.setTreeState({
                grayAfterLineClear: !grayAfterLineClear,
            }),
        ),
    ] : [
        renderSettingsRow(
            'settings-trim-top',
            i18n.ListView.TrimTopBlank(),
            trimTopBlank,
            () => actions.setListViewTrimTopBlank({ enabled: !trimTopBlank }),
        ),
    ]);

    return div({
        key: 'list-view',
        style: containerStyle,
    }, [
        ListViewTools({
            palette,
            treeEnabled: state.tree.enabled,
            treeViewMode: state.tree.viewMode,
            listShortcutLabel: showShortcutLabel && state.mode.editShortcuts.ListView
                ? displayShortcut(state.mode.editShortcuts.ListView)
                : undefined,
            treeShortcutLabel: showShortcutLabel && state.mode.editShortcuts.TreeView
                ? displayShortcut(state.mode.editShortcuts.TreeView)
                : undefined,
            homeShortcutLabel: showShortcutLabel && state.mode.editShortcuts.EditHome
                ? displayShortcut(state.mode.editShortcuts.EditHome)
                : undefined,
            actions: {
                changeToEditorFromListView: () => actions.changeToEditorFromListView(),
                convertAllToMirror: () => actions.convertAllToMirror(),
                openListViewReplaceModal: () => actions.openListViewReplaceModal(),
                openListViewMenuModal: () => actions.openListViewMenuModal(),
                toggleTreeMode: () => state.tree.enabled
                    ? actions.openTreeDisableConfirmModal()
                    : actions.toggleTreeMode(),
                setTreeViewMode: (mode: TreeViewMode) => actions.setTreeViewMode({ mode }),
            },
            height: TOOLS_HEIGHT,
        }),

        div({
            key: 'list-view-content',
            style: style({
                marginTop: px(TOOLS_HEIGHT),
                width: '100%',
                flex: 1,
            }),
            ontouchstart: (e: TouchEvent) => {
                if (e.touches.length === 2) {
                    cleanupTreeTouchEndListeners();
                    treeTouchEndHandled = false;
                    treeTouchStartTarget = null;
                    pinchState = {
                        isTreeView,
                        active: true,
                        initialDistance: getDistance(e.touches[0], e.touches[1]),
                        initialScale: isTreeView ? state.tree.scale : state.listView.scale,
                    };
                    treeTouchStartPosition = null;
                } else if (e.touches.length === 1) {
                    // Reset drag active flags for new touch
                    touchDragActive = false;
                    treeTouchDragActive = false;
                    treeTouchEndHandled = false;
                    treeTouchContainerElement = e.currentTarget as HTMLElement;
                    if (!treeTouchStartTarget) {
                        treeTouchStartTarget = e.target as EventTarget;
                        cleanupTreeTouchEndListeners();
                    }
                    // Save touch start position for button tap detection
                    if (isTreeView) {
                        treeTouchStartPosition = {
                            x: e.touches[0].clientX,
                            y: e.touches[0].clientY,
                        };
                    }
                }
            },
            ontouchmove: (e: TouchEvent) => {
                if (pinchState.active && e.touches.length === 2) {
                    const currentDistance = getDistance(e.touches[0], e.touches[1]);
                    const scaleFactor = currentDistance / pinchState.initialDistance;
                    const newScale = pinchState.initialScale * scaleFactor;
                    if (pinchState.isTreeView) {
                        actions.setTreeViewScale({ scale: newScale });
                    } else {
                        actions.setListViewScale({ scale: newScale });
                    }
                } else if (isTreeView) {
                    handleTreeTouchMove(e);
                } else {
                    handleTouchMoveForDrag(e);
                }
            },
            ontouchend: (e: TouchEvent) => {
                if (treeTouchEndHandled) {
                    treeTouchEndHandled = false;
                    return;
                }
                if (isTreeView) {
                    handleTreeTouchEnd(e);
                } else {
                    handleTouchEndForDrag();
                }
            },
            ontouchcancel: () => {
                if (treeTouchEndHandled) {
                    treeTouchEndHandled = false;
                    return;
                }
                if (isTreeView) {
                    handleTreeTouchCancel();
                }
            },
            ondestroy: () => {
                cleanupTreeTouchEndListeners();
                treeTouchContainerElement = null;
                treeTouchStartTarget = null;
                treeTouchEndHandled = false;
                clearTreeTouchStartPosition();
            },
        }, [
            // Conditionally render FumenGraph or ListViewGrid based on tree mode
            isTreeView
                ? FumenGraph({
                    trimTopBlank,
                    tree: {
                        nodes: state.tree.nodes,
                        rootId: state.tree.rootId,
                        version: 1,
                    },
                    pages: state.fumen.pages,
                    guideLineColor: state.fumen.guideLineColor,
                    activeNodeId: state.tree.activeNodeId,
                    containerWidth: state.display.width,
                    containerHeight: gridContainerHeight,
                    scale: state.tree.scale,
                    dragMode: state.tree.dragState.mode,
                    dragSourceNodeId: state.tree.dragState.sourceNodeId,
                    dragTargetNodeId: state.tree.dragState.targetNodeId,
                    dropSlotIndex: state.tree.dragState.dropSlotIndex,
                    dragTargetButtonParentId: state.tree.dragState.targetButtonParentId,
                    dragTargetButtonType: state.tree.dragState.targetButtonType,
                    buttonDropMovesSubtree: state.tree.buttonDropMovesSubtree,
                    autoFocusPending: state.tree.autoFocusPending,
                    actions: {
                        onNodeClick: (nodeId) => {
                            // Only navigate if not dragging
                            if (state.tree.dragState.sourceNodeId === null) {
                                actions.selectTreeNode({ nodeId });
                                // Navigate to editor after selecting node
                                actions.changeToEditorFromListView();
                            }
                        },
                        onAddBranch: (parentNodeId) => {
                            // Branch operation: add to end of children list (create new branch)
                            actions.addBranchFromCurrentNode({ parentNodeId });
                        },
                        onInsertNode: (parentNodeId) => {
                            // INSERT operation: insert between current node and first child
                            actions.insertNodeAfterCurrent({ parentNodeId });
                        },
                        onCopyNode: (nodeId) => {
                            // Copy operation: copy page and create sibling node
                            actions.copyTreeNode({ nodeId });
                        },
                        onAddRoot: () => {
                            actions.addRootFromCurrentNode();
                        },
                        onCommentChange: (pageIndex: number, comment: string) => {
                            actions.updatePageComment({
                                pageIndex,
                                comment,
                            });
                        },
                        onTouchDragStart: (target) => {
                            registerTreeTouchStartTarget(target);
                        },
                        onDragStart: (nodeId) => {
                            actions.startTreeDrag({ sourceNodeId: nodeId });
                        },
                        onDragOverNode: (nodeId) => {
                            if (state.tree.dragState.sourceNodeId !== null) {
                                actions.updateTreeDragTarget({ targetNodeId: nodeId });
                            }
                        },
                        onDragOverSlot: (slotIndex) => {
                            if (state.tree.dragState.sourceNodeId !== null) {
                                actions.updateTreeDropSlot({ slotIndex });
                            }
                        },
                        onDragOverButton: (parentNodeId, buttonType) => {
                            if (state.tree.dragState.sourceNodeId !== null) {
                                actions.updateTreeDragButtonTarget({ parentNodeId, buttonType });
                            }
                        },
                        onDragLeaveButton: () => {
                            if (state.tree.dragState.sourceNodeId !== null) {
                                actions.updateTreeDragButtonTarget({ parentNodeId: null, buttonType: null });
                            }
                        },
                        onDragLeave: () => {
                            if (state.tree.dragState.sourceNodeId !== null) {
                                actions.updateTreeDragTarget({ targetNodeId: null });
                                actions.updateTreeDropSlot({ slotIndex: null });
                            }
                        },
                        onDrop: () => {
                            const {
                                sourceNodeId,
                                targetNodeId,
                                dropSlotIndex,
                                mode,
                                targetButtonParentId,
                                targetButtonType,
                            } = state.tree.dragState;
                            if (sourceNodeId !== null) {
                                // Priority 1: Button drop
                                if (targetButtonParentId !== null && targetButtonType !== null) {
                                    actions.executeTreeDrop();
                                // Priority 2: Attach mode with target node
                                } else if (mode !== TreeDragMode.Reorder
                                    && targetNodeId !== null && dropSlotIndex !== null) {
                                    actions.executeTreeDrop();
                                }
                            }
                        },
                        onDragEnd: () => {
                            actions.endTreeDrag();
                        },
                        ackTreeAutoFocus: () => {
                            actions.ackTreeAutoFocus();
                        },
                    },
                })
                : ListViewGrid({
                    trimTopBlank,
                    pages: state.fumen.pages,
                    guideLineColor: state.fumen.guideLineColor,
                    draggingIndex: state.listView.dragState.draggingIndex,
                    dropTargetIndex: state.listView.dragState.dropTargetIndex,
                    containerWidth: state.display.width,
                    containerHeight: gridContainerHeight,
                    scale: state.listView.scale,
                    sortable: !state.tree.enabled,
                    actions: {
                        onDragStart: (pageIndex: number) => {
                            actions.setListViewDragState({
                                draggingIndex: pageIndex,
                                dropTargetIndex: null,
                            });
                        },
                        onDragOver: (pageIndex: number, e: DragEvent) => {
                            const draggingIndex = state.listView.dragState.draggingIndex;
                            if (draggingIndex === null) return;

                            // Calculate slot based on mouse position within item
                            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                            const xInItem = e.clientX - rect.left;
                            const isLeftHalf = xInItem < rect.width / 2;
                            const slotIndex = isLeftHalf ? pageIndex : pageIndex + 1;

                            // Skip no-op slots
                            const isNoOpSlot = slotIndex === draggingIndex || slotIndex === draggingIndex + 1;
                            if (isNoOpSlot) {
                                if (state.listView.dragState.dropTargetIndex !== null) {
                                    actions.setListViewDragState({
                                        draggingIndex,
                                        dropTargetIndex: null,
                                    });
                                }
                                return;
                            }

                            if (state.listView.dragState.dropTargetIndex !== slotIndex) {
                                actions.setListViewDragState({
                                    draggingIndex,
                                    dropTargetIndex: slotIndex,
                                });
                            }
                        },
                        onDragLeave: () => {
                            actions.setListViewDragState({
                                draggingIndex: state.listView.dragState.draggingIndex,
                                dropTargetIndex: null,
                            });
                        },
                        onDrop: () => {
                            const fromIndex = state.listView.dragState.draggingIndex;
                            const toSlotIndex = state.listView.dragState.dropTargetIndex;
                            if (fromIndex !== null && toSlotIndex !== null) {
                                actions.reorderPage({
                                    fromIndex,
                                    toSlotIndex,
                                });
                            }
                            actions.setListViewDragState({
                                draggingIndex: null,
                                dropTargetIndex: null,
                            });
                        },
                        onDragEnd: () => {
                            actions.setListViewDragState({
                                draggingIndex: null,
                                dropTargetIndex: null,
                            });
                        },
                        onCommentChange: (pageIndex: number, comment: string) => {
                            actions.updatePageComment({
                                pageIndex,
                                comment,
                            });
                        },
                        onPageClick: (pageIndex: number) => {
                            actions.navigateToPageFromListView({ pageIndex });
                        },
                    },
                }),
        ]),

        // Undo/Redo pill at bottom left
        div({
            key: 'undo-redo-buttons',
            className: 'corner-glass',
            style: style({
                position: 'fixed',
                bottom: px(cornerOffset),
                left: px(cornerOffset),
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                gap: px(4),
                padding: px(5),
                borderRadius: px(28),
                zIndex: 100,
            }),
        }, [
            h('button', {
                key: 'btn-undo',
                className: 'corner-btn',
                style: cornerIconButtonStyle(undoEnabled, 44),
                onclick: () => {
                    if (undoEnabled) {
                        actions.undo();
                    }
                },
                disabled: !undoEnabled,
            }, [
                h('i', { className: 'material-icons', style: style({ fontSize: px(24) }) }, 'undo'),
            ]),
            h('div', { key: 'undo-redo-divider', style: cornerDividerStyle }),
            h('button', {
                key: 'btn-redo',
                className: 'corner-btn',
                style: cornerIconButtonStyle(redoEnabled, 44),
                onclick: () => {
                    if (redoEnabled) {
                        actions.redo();
                    }
                },
                disabled: !redoEnabled,
            }, [
                h('i', { className: 'material-icons', style: style({ fontSize: px(24) }) }, 'redo'),
            ]),
        ]),

        // Zoom controls (above undo/redo, tree view only)
        ...(isTreeView ? [renderTreeZoomControls()] : []),

        // View settings button (bottom right)
        h('button', {
            key: 'btn-view-settings',
            datatest: 'btn-view-settings',
            title: i18n.ListView.ViewSettings(),
            className: 'corner-glass corner-press',
            style: style({
                position: 'fixed',
                right: px(cornerOffset),
                bottom: px(cornerOffset),
                width: px(settingsButtonSize),
                height: px(settingsButtonSize),
                borderRadius: '50%',
                backgroundColor: settingsOpened ? '#2563EB' : '',
                color: settingsOpened ? '#fff' : '#334155',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
                zIndex: 115,
            }),
            onclick: () => actions.setListViewSettingsOpened({ opened: !settingsOpened }),
        }, [
            h('i', { className: 'material-icons', style: style({ fontSize: px(22) }) }, 'tune'),
        ]),

        // Settings popover with tap-to-close scrim
        ...(settingsOpened ? [
            div({
                key: 'view-settings-scrim',
                style: style({
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    zIndex: 110,
                }),
                onclick: () => actions.setListViewSettingsOpened({ opened: false }),
            }),
            renderSettingsPopover(),
        ] : []),

        // Add top-level page button (tree view only)
        ...(isTreeView ? [h('button', {
            key: 'tree-ai-menu',
            datatest: 'btn-tree-ai-menu',
            className: 'corner-fab',
            style: treeAiButtonStyle,
            onclick: () => actions.openColdClearMenuModal(),
        }, [
            h('i', {
                className: 'material-icons',
                style: style({ fontSize: px(24) }),
            }, state.coldClear.isRunning ? 'stop' : 'auto_fix_high'),
        ])] : []),

    ]);
};

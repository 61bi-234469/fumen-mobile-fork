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
import { TreeOperationScopeSelector } from '../components/tree/tree_operation_scope_selector';
import { ViewSettingsPopover } from '../components/view_settings_popover';
import { getTreeTouchStartPosition, setTreeTouchStartPosition } from '../components/tree/tree_touch_state';
import { updateTreeAutoScrollPointer } from '../components/tree/tree_auto_scroll';
import { TreeViewMode, LIST_VIEW_SCALE_RANGE, TREE_VIEW_SCALE_RANGE } from '../lib/fumen/tree_types';
import { style, px } from '../lib/types';
import { isVirtualNode } from '../lib/fumen/tree_utils';
import { displayShortcut } from '../lib/shortcuts';
import {
    TREE_BUTTON_HIT_RADIUS,
    TREE_COPY_BUTTON_HIT_RADIUS,
    TREE_DELETE_BUTTON_HIT_RADIUS,
    calculateTreeViewLayout,
    getBranchButtonOffset,
    getCopyButtonOffset,
    getDeleteButtonOffset,
    getInsertButtonOffset,
} from '../lib/fumen/tree_view_layout';
import {
    TREE_DRAG_START_THRESHOLD,
    beginPendingMouseDrag,
    beginTreeAutoScroll,
    cancelPendingMouseDrag,
    evaluateTreeDropTargetAt,
    setTreeMouseInteractionDeps,
    stopTreeDragFeedback,
} from './tree_mouse_interaction';
import { handleTreeNodeDelete } from './tree_node_delete';

const TOOLS_HEIGHT = 50;

const TREE_SCROLL_CONTAINER_SELECTOR = '[datatest="fumen-graph-container"]';

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

// Pending drag started on a node handle: the drag state itself starts only after
// the pointer moved TREE_DRAG_START_THRESHOLD px (both touch and mouse).
let treePendingDragNodeId: string | null = null;

let treeTouchContainerElement: HTMLElement | null = null;
let treeTouchStartTarget: EventTarget | null = null;
let treeTouchEndHandled = false;
let treeTouchEndCleanup: (() => void) | null = null;
let latestTreeTouchMoveHandler: ((e: TouchEvent) => void) | null = null;
let latestTreeTouchEndHandler: ((e: TouchEvent) => void) | null = null;
let latestTreeTouchCancelHandler: ((e: TouchEvent) => void) | null = null;

const clearTreeTouchStartPosition = () => {
    setTreeTouchStartPosition(null);
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
    treePendingDragNodeId = null;
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
    const grayAfterLineClear = state.tree.grayAfterLineClear;
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

    // Computed once per render (rather than on every touch event) and shared by the tree
    // touch handlers below; Hyperapp re-runs view() on every state change, so this always
    // reflects the state at render time, matching what the handlers previously recomputed.
    const treeForView = { nodes: state.tree.nodes, rootId: state.tree.rootId, version: 1 as const };
    const treeViewLayout = isTreeView
        ? calculateTreeViewLayout(treeForView, state.fumen.pages, trimTopBlank)
        : null;
    const toSvgPoint = (clientX: number, clientY: number, scrollContainer: HTMLElement) => {
        const rect = scrollContainer.getBoundingClientRect();
        return {
            x: (clientX - rect.left + scrollContainer.scrollLeft) / state.tree.scale,
            y: (clientY - rect.top + scrollContainer.scrollTop) / state.tree.scale,
        };
    };

    // Detect if a position is over a button (returns button info or null)
    const detectButtonAtPosition = (
        clientX: number,
        clientY: number,
        container: HTMLElement,
    ): { nodeId: string; type: 'insert' | 'branch' | 'copy' | 'delete' } | null => {
        if (!treeViewLayout) return null;
        const svgElement = container.querySelector('svg') as SVGSVGElement;
        if (!svgElement) return null;
        const scrollContainer = svgElement.parentElement as HTMLElement;
        if (!scrollContainer) return null;

        const { x: svgX, y: svgY } = toSvgPoint(clientX, clientY, scrollContainer);

        for (const node of state.tree.nodes) {
            const nodeLayout = treeViewLayout.nodeLayouts.get(node.id);
            if (!nodeLayout) continue;

            const nodeX = nodeLayout.x;
            const nodeY = nodeLayout.y;
            const nodeHeight = nodeLayout.height;
            const isRenderable = !isVirtualNode(node);

            // Check DELETE button (top-right). Disabled buttons still consume the
            // tap (the handler re-checks canDeleteNode and does nothing).
            if (isRenderable) {
                const deleteOffset = getDeleteButtonOffset();
                const distToDelete = Math.hypot(
                    svgX - (nodeX + deleteOffset.x),
                    svgY - (nodeY + deleteOffset.y),
                );
                if (distToDelete <= TREE_DELETE_BUTTON_HIT_RADIUS) {
                    return { nodeId: node.id, type: 'delete' };
                }
            }

            const copyOffset = getCopyButtonOffset(nodeHeight);
            const distToCopy = Math.hypot(
                svgX - (nodeX + copyOffset.x),
                svgY - (nodeY + copyOffset.y),
            );

            if (isRenderable && distToCopy <= TREE_COPY_BUTTON_HIT_RADIUS) {
                return { nodeId: node.id, type: 'copy' };
            }

            // Check INSERT button (green)
            const insertOffset = getInsertButtonOffset(nodeHeight);
            const distToInsert = Math.hypot(
                svgX - (nodeX + insertOffset.x),
                svgY - (nodeY + insertOffset.y),
            );

            if (distToInsert <= TREE_BUTTON_HIT_RADIUS) {
                return { nodeId: node.id, type: 'insert' };
            }

            // Check BRANCH button (orange) - only if node has children
            if (node.childrenIds.length > 0) {
                const branchOffset = getBranchButtonOffset(nodeHeight);
                const distToBranch = Math.hypot(
                    svgX - (nodeX + branchOffset.x),
                    svgY - (nodeY + branchOffset.y),
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
        if (e.touches.length !== 1) return;
        if (pinchState.active) return;

        const touch = e.touches[0];
        const sourceNodeId = state.tree.dragState.sourceNodeId;

        if (sourceNodeId === null) {
            // Pending handle drag: activate only after the pointer moved far enough
            if (treePendingDragNodeId === null) return;
            const startPos = getTreeTouchStartPosition();
            if (!startPos) return;

            const dx = touch.clientX - startPos.x;
            const dy = touch.clientY - startPos.y;
            if (Math.sqrt(dx * dx + dy * dy) < TREE_DRAG_START_THRESHOLD) {
                return; // Not enough movement yet
            }

            const nodeId = treePendingDragNodeId;
            treePendingDragNodeId = null;
            treeTouchDragActive = true;
            actions.startTreeDrag({ sourceNodeId: nodeId });
            beginTreeAutoScroll();
            updateTreeAutoScrollPointer(touch.clientX, touch.clientY);
            return;
        }

        treeTouchDragActive = true;
        updateTreeAutoScrollPointer(touch.clientX, touch.clientY);
        evaluateTreeDropTargetAt(touch.clientX, touch.clientY);
    };

    const handleTreeTouchEnd = (e: TouchEvent) => {
        cleanupTreeTouchEndListeners();
        const container = treeTouchContainerElement ?? (e.currentTarget as HTMLElement);

        // Get touch start position (set by fumen_graph.tsx buttons' ontouchstart).
        // This is necessary because the buttons' ontouchstart fires before the container's
        const touchStartPos = getTreeTouchStartPosition();

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
                    } else if (buttonHit.type === 'copy') {
                        actions.copyTreeNode({ nodeId: buttonHit.nodeId });
                    } else {
                        handleTreeNodeDelete(state, actions, buttonHit.nodeId);
                    }
                    pinchState.active = false;
                    stopTreeDragFeedback();
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
            stopTreeDragFeedback();
            resetTreeTouchTracking();
            return;
        }

        treeTouchDragActive = false;

        const {
            sourceNodeId,
            targetButtonParentId,
            targetButtonType,
        } = state.tree.dragState;

        let didDrop = false;
        if (sourceNodeId !== null
            && targetButtonParentId !== null && targetButtonType !== null) {
            actions.executeTreeDrop();
            didDrop = true;
        }

        if (!didDrop) {
            actions.endTreeDrag();
        }
        pinchState.active = false;
        stopTreeDragFeedback();
        resetTreeTouchTracking();
    };

    const handleTreeTouchCancel = () => {
        cleanupTreeTouchEndListeners();
        if (state.tree.dragState.sourceNodeId !== null) {
            actions.endTreeDrag();
        }
        pinchState.active = false;
        stopTreeDragFeedback();
        resetTreeTouchTracking();
    };

    latestTreeTouchMoveHandler = handleTreeTouchMove;
    latestTreeTouchEndHandler = handleTreeTouchEnd;
    latestTreeTouchCancelHandler = handleTreeTouchCancel;
    setTreeMouseInteractionDeps({
        state,
        actions,
        treeViewLayout,
        containerSelector: TREE_SCROLL_CONTAINER_SELECTOR,
    });

    // Safety net: if the drag state is gone (drop, undo, view switch), make sure
    // the auto-scroll loop and the ghost are not left running.
    if (!isTreeView || state.tree.dragState.sourceNodeId === null) {
        stopTreeDragFeedback();
    }

    const cornerOffset = 8;
    const settingsButtonSize = 48;
    const settingsOpened = state.listView.settingsOpened;
    const treeAiButtonBottom = TOOLS_HEIGHT + cornerOffset + settingsButtonSize + 12;

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

    const renderTreeScopeSelector = () => TreeOperationScopeSelector({
        scope: state.tree.operationScope,
        opened: state.tree.operationScopePopoverOpened,
        floatingBottom: TOOLS_HEIGHT + cornerOffset,
        onToggle: () => actions.setTreeState({
            operationScopePopoverOpened: !state.tree.operationScopePopoverOpened,
        }),
        onClose: () => actions.setTreeState({ operationScopePopoverOpened: false }),
        onSelect: operationScope => actions.setTreeState({
            operationScope,
            operationScopePopoverOpened: false,
        }),
    });

    return div({
        key: 'list-view',
        style: containerStyle,
    }, [
        ListViewTools({
            palette,
            treeEnabled: state.tree.enabled,
            treeViewMode: state.tree.viewMode,
            undoCount: state.history.undoCount,
            redoCount: state.history.redoCount,
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
                openUserSettingsModal: () => actions.openUserSettingsModal({ initialTab: 'view' }),
                toggleTreeMode: () => state.tree.enabled
                    ? actions.openTreeDisableConfirmModal()
                    : actions.toggleTreeMode(),
                setTreeViewMode: (mode: TreeViewMode) => actions.setTreeViewMode({ mode }),
                undo: () => actions.undo(),
                redo: () => actions.redo(),
            },
            height: TOOLS_HEIGHT,
        }),

        div({
            key: 'list-view-content',
            style: style({
                width: '100%',
                flex: 1,
            }),
            onwheel: (e: WheelEvent) => {
                if (!e.ctrlKey) return;
                e.preventDefault();
                const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
                if (isTreeView) {
                    actions.setTreeViewScale({ scale: state.tree.scale * factor });
                } else {
                    actions.setListViewScale({ scale: state.listView.scale * factor });
                }
            },
            ontouchstart: (e: TouchEvent) => {
                if (e.touches.length === 2) {
                    cleanupTreeTouchEndListeners();
                    treeTouchEndHandled = false;
                    treeTouchStartTarget = null;
                    treePendingDragNodeId = null;
                    if (state.tree.dragState.sourceNodeId !== null) {
                        actions.endTreeDrag();
                    }
                    stopTreeDragFeedback();
                    pinchState = {
                        isTreeView,
                        active: true,
                        initialDistance: getDistance(e.touches[0], e.touches[1]),
                        initialScale: isTreeView ? state.tree.scale : state.listView.scale,
                    };
                    setTreeTouchStartPosition(null);
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
                        setTreeTouchStartPosition({
                            x: e.touches[0].clientX,
                            y: e.touches[0].clientY,
                        });
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
                cancelPendingMouseDrag();
                stopTreeDragFeedback();
                treeTouchContainerElement = null;
                treeTouchStartTarget = null;
                treeTouchEndHandled = false;
                treePendingDragNodeId = null;
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
                    dragSourceNodeId: state.tree.dragState.sourceNodeId,
                    dragTargetButtonParentId: state.tree.dragState.targetButtonParentId,
                    dragTargetButtonType: state.tree.dragState.targetButtonType,
                    operationScope: state.tree.operationScope,
                    dragOperationScope: state.tree.dragState.operationScope,
                    autoFocusPending: state.tree.autoFocusPending,
                    actions: {
                        onNodeActivate: (nodeId) => {
                            if (state.tree.dragState.sourceNodeId === null) {
                                if (state.tree.activeNodeId === nodeId) {
                                    actions.selectTreeNode({ nodeId });
                                    actions.changeToEditorFromListView();
                                } else {
                                    actions.activateTreeNode({ nodeId });
                                }
                            }
                        },
                        onPageClick: (nodeId) => {
                            if (state.tree.dragState.sourceNodeId === null) {
                                actions.selectTreeNode({ nodeId });
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
                        onDeleteNode: (nodeId) => {
                            handleTreeNodeDelete(state, actions, nodeId);
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
                        onHandleMouseDown: (nodeId, e) => {
                            beginPendingMouseDrag(nodeId, e.clientX, e.clientY);
                        },
                        onHandleTouchStart: (nodeId, e) => {
                            if (e.touches.length !== 1) return;
                            setTreeTouchStartPosition({
                                x: e.touches[0].clientX,
                                y: e.touches[0].clientY,
                            });
                            registerTreeTouchStartTarget(e.target as EventTarget);
                            treePendingDragNodeId = nodeId;
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
                        onDrop: () => {
                            const {
                                sourceNodeId,
                                targetButtonParentId,
                                targetButtonType,
                            } = state.tree.dragState;
                            if (sourceNodeId !== null
                                && targetButtonParentId !== null && targetButtonType !== null) {
                                actions.executeTreeDrop();
                            } else if (sourceNodeId !== null) {
                                actions.endTreeDrag();
                            }
                            stopTreeDragFeedback();
                        },
                        onDragEnd: () => {
                            actions.endTreeDrag();
                            stopTreeDragFeedback();
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
                    currentIndex: state.fumen.currentIndex,
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
                        onItemClick: (pageIndex: number) => {
                            actions.activatePageInListView({ pageIndex });
                        },
                        onPageClick: (pageIndex: number) => {
                            actions.navigateToPageFromListView({ pageIndex });
                        },
                    },
                }),
        ]),

        // Scope selector (tree view only)
        ...(isTreeView ? [renderTreeScopeSelector()] : []),

        // View settings button (bottom right)
        h('button', {
            key: 'btn-view-settings',
            datatest: 'btn-view-settings',
            title: i18n.ListView.ViewSettings(),
            className: 'corner-glass corner-press',
            style: style({
                position: 'fixed',
                right: px(cornerOffset),
                bottom: px(TOOLS_HEIGHT + cornerOffset),
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
            ViewSettingsPopover({
                isTreeView,
                trimTopBlank,
                grayAfterLineClear,
                positioning: {
                    type: 'fixed',
                    right: cornerOffset,
                    bottom: TOOLS_HEIGHT + cornerOffset + settingsButtonSize + 10,
                },
                zoom: {
                    percent: Math.round((isTreeView ? state.tree.scale : state.listView.scale) * 100),
                    min: (isTreeView ? TREE_VIEW_SCALE_RANGE.min : LIST_VIEW_SCALE_RANGE.min) * 100,
                    max: 300,
                },
                actions: {
                    onTrimTopBlankToggle: () => actions.setListViewTrimTopBlank({ enabled: !trimTopBlank }),
                    onGrayAfterLineClearToggle: () => actions.setTreeState({
                        grayAfterLineClear: !grayAfterLineClear,
                    }),
                    onZoomChange: (percent: number) => {
                        const scale = percent / 100;
                        if (isTreeView) {
                            actions.setTreeViewScale({ scale });
                        } else {
                            actions.setListViewScale({ scale });
                        }
                    },
                    onZoomReset: () => {
                        if (isTreeView) {
                            actions.setTreeViewScale({ scale: 1.0 });
                        } else {
                            actions.setListViewScale({ scale: 1.0 });
                        }
                    },
                },
            }),
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

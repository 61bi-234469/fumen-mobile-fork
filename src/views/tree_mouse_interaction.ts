/**
 * PC mouse path for tree-node drags, shared by the full-screen tree view and
 * the editor side panel (the two are never shown at the same time).
 *
 * Handlers read the deps assigned on every render via setTreeMouseInteractionDeps,
 * mirroring the previous "reassign the latest handler to a module variable" style.
 */

import { Actions } from '../actions';
import { State } from '../states';
import { TreeDropTarget, TreeNodeId } from '../lib/fumen/tree_types';
import { TreeViewLayout, findTreeDropTarget } from '../lib/fumen/tree_view_layout';
import { resetTreeDragGhost, updateTreeDragGhost } from '../components/tree/tree_drag_ghost';
import {
    startTreeAutoScroll,
    stopTreeAutoScroll,
    updateTreeAutoScrollPointer,
} from '../components/tree/tree_auto_scroll';

// Minimum pointer travel (px) before a pending handle-drag becomes an active drag
export const TREE_DRAG_START_THRESHOLD = 10;

export interface TreeMouseInteractionDeps {
    state: Readonly<State>;
    actions: Actions;
    treeViewLayout: TreeViewLayout | null;
    containerSelector: string;
}

let latestDeps: TreeMouseInteractionDeps | null = null;
let pendingMouseDragCleanup: (() => void) | null = null;

export const setTreeMouseInteractionDeps = (deps: TreeMouseInteractionDeps) => {
    latestDeps = deps;
};

export const cancelPendingMouseDrag = () => {
    if (pendingMouseDragCleanup) {
        pendingMouseDragCleanup();
        pendingMouseDragCleanup = null;
    }
};

export const stopTreeDragFeedback = () => {
    stopTreeAutoScroll();
    resetTreeDragGhost();
};

const getTreeScrollContainer = (): HTMLElement | null => {
    if (!latestDeps) return null;
    return document.querySelector(latestDeps.containerSelector) as HTMLElement | null;
};

interface TreePointerPosition {
    svgX: number;
    svgY: number;
    /** Whether the point lies inside the visible (scrolling) tree viewport */
    insideViewport: boolean;
}

// Convert a client position to pre-scale tree coordinates at the current scroll offset.
const toTreePointerPosition = (clientX: number, clientY: number): TreePointerPosition | null => {
    const deps = latestDeps;
    const container = getTreeScrollContainer();
    if (!deps || !container) return null;
    const svgElement = container.querySelector('svg') as SVGSVGElement;
    if (!svgElement) return null;
    const canvas = svgElement.parentElement as HTMLElement;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const viewport = container.getBoundingClientRect();
    return {
        svgX: (clientX - rect.left + canvas.scrollLeft) / deps.state.tree.scale,
        svgY: (clientY - rect.top + canvas.scrollTop) / deps.state.tree.scale,
        insideViewport: clientX >= viewport.left && clientX <= viewport.right
            && clientY >= viewport.top && clientY <= viewport.bottom,
    };
};

// Resolve the drop target at a client position: an add button first, then a lane
// slot. A lane slot needs the point inside the viewport, so a release outside the
// tree never reorders lanes; buttonsOnly skips lane slots altogether.
export const resolveTreeDropTargetAt = (
    clientX: number,
    clientY: number,
    options: { buttonsOnly?: boolean } = {},
): TreeDropTarget | null => {
    const deps = latestDeps;
    if (!deps || !deps.treeViewLayout) return null;
    const { state, treeViewLayout } = deps;

    const sourceNodeId = state.tree.dragState.sourceNodeId;
    if (sourceNodeId === null) return null;

    const position = toTreePointerPosition(clientX, clientY);
    if (position === null) return null;

    return findTreeDropTarget(
        { nodes: state.tree.nodes, rootId: state.tree.rootId, version: 1 as const },
        treeViewLayout,
        position.svgX,
        position.svgY,
        sourceNodeId,
        state.tree.dragState.operationScope ?? state.tree.operationScope,
        { allowLaneSlot: options.buttonsOnly !== true && position.insideViewport },
    );
};

// Re-evaluate the drop candidate (and the ghost position) at a client position.
// Used by pointer moves and by auto-scroll frames while the pointer stays still.
export const evaluateTreeDropTargetAt = (clientX: number, clientY: number) => {
    const deps = latestDeps;
    if (!deps) return;
    const { state, actions } = deps;
    const dragState = state.tree.dragState;
    if (dragState.sourceNodeId === null) return;

    const position = toTreePointerPosition(clientX, clientY);
    if (position === null) return;
    updateTreeDragGhost(position.svgX, position.svgY);

    const target = resolveTreeDropTargetAt(clientX, clientY);
    if (target?.kind === 'button') {
        if (dragState.targetButtonParentId !== target.nodeId || dragState.targetButtonType !== target.type) {
            actions.updateTreeDragButtonTarget({ parentNodeId: target.nodeId, buttonType: target.type });
        }
    } else if (target?.kind === 'lane') {
        if (dragState.dropSlotIndex !== target.slotIndex) {
            actions.updateTreeDropSlot({ slotIndex: target.slotIndex });
        }
    } else if (dragState.targetButtonParentId !== null || dragState.dropSlotIndex !== null) {
        actions.updateTreeDragButtonTarget({ parentNodeId: null, buttonType: null });
    }
};

// Finish a drag at the release point. The target is resolved again here because the
// candidate in the rendered state can be one update behind the pointer.
export const dropTreeDragAt = (clientX: number, clientY: number, options: { buttonsOnly?: boolean } = {}) => {
    const deps = latestDeps;
    if (deps && deps.state.tree.dragState.sourceNodeId !== null) {
        const target = resolveTreeDropTargetAt(clientX, clientY, options);
        if (target !== null) {
            deps.actions.executeTreeDrop({ target });
        } else {
            deps.actions.endTreeDrag();
        }
    }
    stopTreeDragFeedback();
};

export const beginTreeAutoScroll = () => {
    const container = getTreeScrollContainer();
    if (container) {
        startTreeAutoScroll(container, (clientX, clientY) => {
            evaluateTreeDropTargetAt(clientX, clientY);
        });
    }
};

// Pending drag from the handle (PC): start the drag state only after the
// mouse traveled the threshold with the button held down.
export const beginPendingMouseDrag = (nodeId: TreeNodeId, startX: number, startY: number) => {
    cancelPendingMouseDrag();

    const onMove = (e: MouseEvent) => {
        const deps = latestDeps;
        if (!deps) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        if (Math.sqrt(dx * dx + dy * dy) < TREE_DRAG_START_THRESHOLD) return;
        cancelPendingMouseDrag();
        deps.actions.startTreeDrag({ sourceNodeId: nodeId });
        beginTreeAutoScroll();
        updateTreeAutoScrollPointer(e.clientX, e.clientY);
    };
    const onUp = () => {
        cancelPendingMouseDrag();
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    pendingMouseDragCleanup = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
    };
};

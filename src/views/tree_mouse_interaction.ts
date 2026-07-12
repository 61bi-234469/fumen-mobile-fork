/**
 * PC mouse path for tree-node drags, shared by the full-screen tree view and
 * the editor side panel (the two are never shown at the same time).
 *
 * Handlers read the deps assigned on every render via setTreeMouseInteractionDeps,
 * mirroring the previous "reassign the latest handler to a module variable" style.
 */

import { Actions } from '../actions';
import { State } from '../states';
import { TreeNodeId } from '../lib/fumen/tree_types';
import { TreeViewLayout, findTreeButtonDropTarget } from '../lib/fumen/tree_view_layout';
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

// Re-evaluate the drop target (and the ghost position) at a client position.
// Used by pointer moves and by auto-scroll frames while the pointer stays still.
export const evaluateTreeDropTargetAt = (clientX: number, clientY: number) => {
    const deps = latestDeps;
    if (!deps || !deps.treeViewLayout) return;
    const { state, actions, treeViewLayout } = deps;

    const sourceNodeId = state.tree.dragState.sourceNodeId;
    if (sourceNodeId === null) return;

    const container = getTreeScrollContainer();
    if (!container) return;
    const svgElement = container.querySelector('svg') as SVGSVGElement;
    if (!svgElement) return;
    const scrollContainer = svgElement.parentElement as HTMLElement;
    if (!scrollContainer) return;

    const rect = scrollContainer.getBoundingClientRect();
    const svgX = (clientX - rect.left + scrollContainer.scrollLeft) / state.tree.scale;
    const svgY = (clientY - rect.top + scrollContainer.scrollTop) / state.tree.scale;

    updateTreeDragGhost(svgX, svgY);

    const foundButton = findTreeButtonDropTarget(
        { nodes: state.tree.nodes, rootId: state.tree.rootId, version: 1 as const },
        treeViewLayout,
        svgX,
        svgY,
        sourceNodeId,
        state.tree.dragState.operationScope ?? state.tree.operationScope,
    );

    if (foundButton !== null) {
        if (state.tree.dragState.targetButtonParentId !== foundButton.nodeId ||
            state.tree.dragState.targetButtonType !== foundButton.type) {
            actions.updateTreeDragButtonTarget({
                parentNodeId: foundButton.nodeId,
                buttonType: foundButton.type,
            });
        }
    } else if (state.tree.dragState.targetButtonParentId !== null) {
        actions.updateTreeDragButtonTarget({ parentNodeId: null, buttonType: null });
    }
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

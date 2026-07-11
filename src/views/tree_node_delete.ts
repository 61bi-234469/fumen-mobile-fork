import { Actions } from '../actions';
import { State } from '../states';
import { i18n } from '../locales/keys';
import { TreeNodeId } from '../lib/fumen/tree_types';
import { canDeleteNode, findNode, getDescendants, isVirtualNode } from '../lib/fumen/tree_utils';

declare const M: any;

/**
 * Show the post-delete toast with an Undo action. The Undo listener is attached
 * to the created toast element and detached on click / when the toast finishes.
 */
export const showDeleteUndoToast = (actions: Actions, removedPageCount: number) => {
    const message = removedPageCount === 1
        ? i18n.TreeView.DeleteToast.DeletedOne()
        : i18n.TreeView.DeleteToast.DeletedMany(removedPageCount);

    const toast = M.toast({
        html: '<span class="tree-delete-toast-message"></span>'
            + '<button class="btn-flat toast-action" datatest="btn-tree-delete-undo"></button>',
        classes: 'top-toast',
        displayLength: 4000,
    });

    const messageElement = toast.el.querySelector('.tree-delete-toast-message');
    if (messageElement) {
        // textContent (not innerHTML) so no markup is ever injected
        messageElement.textContent = message;
    }
    const undoButton = toast.el.querySelector('[datatest="btn-tree-delete-undo"]');
    if (undoButton) {
        undoButton.textContent = i18n.TreeView.DeleteToast.Undo();
        const onUndo = () => {
            undoButton.removeEventListener('click', onUndo);
            actions.undo();
            toast.dismiss();
        };
        undoButton.addEventListener('click', onUndo);
        toast.options.completeCallback = () => {
            undoButton.removeEventListener('click', onUndo);
        };
    }
};

// Delete a node from its permanent delete button, then offer Undo via toast.
// Scope mirrors the removeTreeNode action: leaf = node only, with children =
// follow the buttonDropMovesSubtree setting.
export const handleTreeNodeDelete = (state: Readonly<State>, actions: Actions, nodeId: TreeNodeId) => {
    const tree = { nodes: state.tree.nodes, rootId: state.tree.rootId, version: 1 as const };
    const node = findNode(tree, nodeId);
    if (!node || isVirtualNode(node)) return;

    const removeDescendants = node.childrenIds.length > 0 && state.tree.buttonDropMovesSubtree;
    if (!canDeleteNode(tree, nodeId, removeDescendants, state.fumen.pages.length)) return;

    const removedPageIndices = new Set<number>();
    const nodeIdsToRemove = removeDescendants ? getDescendants(tree, nodeId) : [nodeId];
    nodeIdsToRemove.forEach((id) => {
        const target = findNode(tree, id);
        if (target && target.pageIndex >= 0) {
            removedPageIndices.add(target.pageIndex);
        }
    });

    actions.removeTreeNode({ nodeId });
    showDeleteUndoToast(actions, removedPageIndices.size);
};

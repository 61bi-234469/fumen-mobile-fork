import { h } from 'hyperapp';
import { div } from '@hyperapp/html';
import { EditorSidePanelTab, State } from '../../states';
import { Actions } from '../../actions';
import { i18n } from '../../locales/keys';
import { px, style } from '../../lib/types';
import { ListViewGrid } from '../../components/list_view/list_view_grid';
import { FumenGraph } from '../../components/tree/fumen_graph';
import { TreeNodeId } from '../../lib/fumen/tree_types';
import { calculateTreeViewLayout } from '../../lib/fumen/tree_view_layout';
import {
    beginPendingMouseDrag,
    cancelPendingMouseDrag,
    setTreeMouseInteractionDeps,
    stopTreeDragFeedback,
} from '../tree_mouse_interaction';
import { handleTreeNodeDelete } from '../tree_node_delete';
import { getSidePanelWidthBounds, SIDE_PANEL_TAB_BAR_HEIGHT } from './side_panel_layout';

// フル画面と同時表示されないため、FumenGraph 内の datatest をそのまま共有する
const PANEL_TREE_CONTAINER_SELECTOR = '[datatest="fumen-graph-container"]';

const ZOOM_CONTROLS_HEIGHT = 36;
const RESIZE_HANDLE_HIT_WIDTH = 12;

let resizeCleanup: (() => void) | null = null;

const stopPanelResize = () => {
    if (resizeCleanup) {
        resizeCleanup();
        resizeCleanup = null;
    }
};

interface PanelSize {
    width: number;
    height: number;
}

const tabButton = (
    actions: Actions,
    tab: EditorSidePanelTab,
    currentTab: EditorSidePanelTab,
    label: string,
) => {
    const active = tab === currentTab;
    return h('button', {
        key: `editor-panel-tab-${tab}`,
        datatest: `editor-panel-tab-${tab}`,
        style: style({
            flex: '1 1 0',
            height: '100%',
            border: 'none',
            borderBottom: active ? 'solid 2px #2563EB' : 'solid 2px transparent',
            backgroundColor: 'transparent',
            color: active ? '#2563EB' : '#64748B',
            fontWeight: active ? 'bold' : 'normal',
            fontSize: px(13),
            cursor: 'pointer',
            padding: 0,
        }),
        onclick: () => actions.setEditorSidePanelTab({ tab }),
    }, label);
};

const renderZoomControls = (state: State, actions: Actions) => {
    const zoomButtonStyle = style({
        width: px(30),
        height: px(28),
        border: 'none',
        borderRadius: px(14),
        backgroundColor: 'transparent',
        color: '#334155',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
    });

    return div({
        key: 'editor-panel-zoom-controls',
        style: style({
            height: px(ZOOM_CONTROLS_HEIGHT),
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: px(2),
            flex: 'none',
            borderBottom: 'solid 1px #E2E8F0',
        }),
    }, [
        h('button', {
            key: 'btn-tree-zoom-out',
            datatest: 'btn-tree-zoom-out',
            title: i18n.TreeView.ZoomOut(),
            style: zoomButtonStyle,
            onclick: () => actions.setTreeViewScale({ scale: state.tree.scale / 1.2 }),
        }, [
            h('i', { className: 'material-icons', style: style({ fontSize: px(18) }) }, 'remove'),
        ]),
        h('button', {
            key: 'btn-tree-zoom-reset',
            datatest: 'btn-tree-zoom-reset',
            title: i18n.TreeView.ZoomReset(),
            style: style({
                minWidth: px(48),
                height: px(28),
                border: 'none',
                borderRadius: px(14),
                backgroundColor: 'transparent',
                color: '#334155',
                fontSize: px(12),
                fontWeight: 600,
                cursor: 'pointer',
                padding: '0 6px',
                fontVariantNumeric: 'tabular-nums',
            }),
            onclick: () => actions.setTreeViewScale({ scale: 1.0 }),
        }, `${Math.round(state.tree.scale * 100)}%`),
        h('button', {
            key: 'btn-tree-zoom-in',
            datatest: 'btn-tree-zoom-in',
            title: i18n.TreeView.ZoomIn(),
            style: zoomButtonStyle,
            onclick: () => actions.setTreeViewScale({ scale: state.tree.scale * 1.2 }),
        }, [
            h('i', { className: 'material-icons', style: style({ fontSize: px(18) }) }, 'add'),
        ]),
    ]);
};

const renderListTab = (state: State, actions: Actions, size: PanelSize) => {
    return ListViewGrid({
        trimTopBlank: state.listView.trimTopBlank,
        pages: state.fumen.pages,
        guideLineColor: state.fumen.guideLineColor,
        draggingIndex: state.listView.dragState.draggingIndex,
        dropTargetIndex: state.listView.dragState.dropTargetIndex,
        containerWidth: size.width,
        containerHeight: size.height - SIDE_PANEL_TAB_BAR_HEIGHT,
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
                actions.updatePageComment({ pageIndex, comment });
                // 現在ページのコメントはエディタ下部の欄と同期させる
                if (pageIndex === state.fumen.currentIndex) {
                    actions.reopenCurrentPage();
                }
            },
            onPageClick: (pageIndex: number) => {
                actions.openPage({ index: pageIndex });
            },
        },
    });
};

const renderTreeDisabled = (actions: Actions) => {
    return div({
        key: 'editor-panel-tree-disabled',
        style: style({
            flex: '1 1 auto',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: px(12),
            padding: px(16),
        }),
    }, [
        h('span', {
            key: 'editor-panel-tree-disabled-message',
            style: style({
                color: '#64748B',
                fontSize: px(13),
                textAlign: 'center',
            }),
        }, i18n.EditorPanel.TreeModeDisabled()),
        h('button', {
            key: 'editor-panel-enable-tree',
            datatest: 'editor-panel-enable-tree',
            className: 'btn',
            onclick: () => actions.toggleTreeMode(),
        }, i18n.EditorPanel.EnableTreeMode()),
    ]);
};

const renderTreeTab = (state: State, actions: Actions, size: PanelSize) => {
    if (!state.tree.enabled) {
        return [renderTreeDisabled(actions)];
    }

    const graphHeight = size.height - SIDE_PANEL_TAB_BAR_HEIGHT - ZOOM_CONTROLS_HEIGHT;

    return [
        renderZoomControls(state, actions),

        FumenGraph({
            trimTopBlank: state.listView.trimTopBlank,
            tree: {
                nodes: state.tree.nodes,
                rootId: state.tree.rootId,
                version: 1,
            },
            pages: state.fumen.pages,
            guideLineColor: state.fumen.guideLineColor,
            activeNodeId: state.tree.activeNodeId,
            containerWidth: size.width,
            containerHeight: graphHeight,
            scale: state.tree.scale,
            dragSourceNodeId: state.tree.dragState.sourceNodeId,
            dragTargetButtonParentId: state.tree.dragState.targetButtonParentId,
            dragTargetButtonType: state.tree.dragState.targetButtonType,
            buttonDropMovesSubtree: state.tree.buttonDropMovesSubtree,
            autoFocusPending: state.tree.autoFocusPending,
            actions: {
                onNodeActivate: (nodeId: TreeNodeId) => {
                    if (state.tree.dragState.sourceNodeId === null) {
                        actions.activateTreeNode({ nodeId });
                        actions.reopenCurrentPage();
                    }
                },
                onPageClick: (nodeId: TreeNodeId) => {
                    // 画面遷移せず、エディタの盤面だけジャンプさせる
                    if (state.tree.dragState.sourceNodeId === null) {
                        actions.selectTreeNode({ nodeId });
                        actions.reopenCurrentPage();
                    }
                },
                onAddBranch: (parentNodeId: TreeNodeId) => {
                    actions.addBranchFromCurrentNode({ parentNodeId });
                },
                onInsertNode: (parentNodeId: TreeNodeId) => {
                    actions.insertNodeAfterCurrent({ parentNodeId });
                },
                onCopyNode: (nodeId: TreeNodeId) => {
                    actions.copyTreeNode({ nodeId });
                },
                onDeleteNode: (nodeId: TreeNodeId) => {
                    handleTreeNodeDelete(state, actions, nodeId);
                },
                onAddRoot: () => {
                    actions.addRootFromCurrentNode();
                },
                onCommentChange: (pageIndex: number, comment: string) => {
                    actions.updatePageComment({ pageIndex, comment });
                    // 現在ページのコメントはエディタ下部の欄と同期させる
                    if (pageIndex === state.fumen.currentIndex) {
                        actions.reopenCurrentPage();
                    }
                },
                onHandleMouseDown: (nodeId: TreeNodeId, e: MouseEvent) => {
                    beginPendingMouseDrag(nodeId, e.clientX, e.clientY);
                },
                // パネルはPC専用のためタッチ経路は実装しない
                onHandleTouchStart: () => undefined,
                onDragOverButton: (parentNodeId: TreeNodeId, buttonType: 'insert' | 'branch') => {
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
        }),
    ];
};

export const sidePanel = (state: State, actions: Actions, size: PanelSize) => {
    const currentTab = state.editorPanel.tab;
    const isTreeTabActive = currentTab === 'tree' && state.tree.enabled;

    const treeViewLayout = isTreeTabActive
        ? calculateTreeViewLayout(
            { nodes: state.tree.nodes, rootId: state.tree.rootId, version: 1 },
            state.fumen.pages,
            state.listView.trimTopBlank,
        )
        : null;

    setTreeMouseInteractionDeps({
        state,
        actions,
        treeViewLayout,
        containerSelector: PANEL_TREE_CONTAINER_SELECTOR,
    });

    // Safety net: if the drag state is gone (drop, undo, tab switch), make sure
    // the auto-scroll loop and the ghost are not left running.
    if (!isTreeTabActive || state.tree.dragState.sourceNodeId === null) {
        stopTreeDragFeedback();
    }

    const clampPanelWidth = (width: number) => {
        const bounds = getSidePanelWidthBounds(state);
        return Math.max(bounds.min, Math.min(bounds.max, Math.round(width)));
    };

    const startPanelResize = (e: MouseEvent) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        stopPanelResize();

        const startX = e.clientX;
        const startWidth = size.width;
        let latestWidth = startWidth;
        const previousCursor = document.body.style.cursor;
        const previousUserSelect = document.body.style.userSelect;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';

        const widthAt = (clientX: number) => clampPanelWidth(startWidth + clientX - startX);
        const onMouseMove = (event: MouseEvent) => {
            latestWidth = widthAt(event.clientX);
            actions.setEditorSidePanelWidth({ width: latestWidth, persist: false });
        };
        const onMouseUp = (event: MouseEvent) => {
            latestWidth = widthAt(event.clientX);
            stopPanelResize();
            actions.setEditorSidePanelWidth({ width: latestWidth, persist: true });
        };
        const onWindowBlur = () => {
            stopPanelResize();
            actions.setEditorSidePanelWidth({ width: latestWidth, persist: true });
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        window.addEventListener('blur', onWindowBlur);
        resizeCleanup = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            window.removeEventListener('blur', onWindowBlur);
            document.body.style.cursor = previousCursor;
            document.body.style.userSelect = previousUserSelect;
        };
    };

    return div({
        key: 'editor-side-panel',
        datatest: 'editor-side-panel',
        style: style({
            width: px(size.width),
            minWidth: px(size.width),
            height: px(size.height),
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#f5f5f5',
            borderRight: 'solid 1px #E2E8F0',
            boxSizing: 'border-box',
            userSelect: 'none',
            position: 'relative',
        }),
        ondestroy: () => {
            stopPanelResize();
            cancelPendingMouseDrag();
            stopTreeDragFeedback();
        },
    }, [
        div({
            key: 'editor-panel-tab-bar',
            style: style({
                height: px(SIDE_PANEL_TAB_BAR_HEIGHT),
                display: 'flex',
                flexDirection: 'row',
                flex: 'none',
                borderBottom: 'solid 1px #E2E8F0',
                backgroundColor: '#fff',
            }),
        }, [
            tabButton(actions, 'list', currentTab, i18n.EditorPanel.ListTab()),
            tabButton(actions, 'tree', currentTab, i18n.EditorPanel.TreeTab()),
        ]),

        ...(currentTab === 'tree'
            ? renderTreeTab(state, actions, size)
            : [renderListTab(state, actions, size)]),

        div({
            key: 'editor-side-panel-resize-handle',
            datatest: 'editor-side-panel-resize-handle',
            role: 'separator',
            'aria-orientation': 'vertical',
            style: style({
                position: 'absolute',
                top: 0,
                right: px(-RESIZE_HANDLE_HIT_WIDTH / 2),
                width: px(RESIZE_HANDLE_HIT_WIDTH),
                height: '100%',
                cursor: 'col-resize',
                zIndex: 10,
                display: 'flex',
                justifyContent: 'center',
            }),
            onmousedown: startPanelResize,
            ondblclick: (e: MouseEvent) => {
                e.preventDefault();
                e.stopPropagation();
                stopPanelResize();
                actions.setEditorSidePanelWidth({ width: null, persist: true });
            },
        }, [
            div({
                key: 'editor-side-panel-resize-line',
                style: style({
                    width: px(1),
                    height: '100%',
                    backgroundColor: '#CBD5E1',
                    pointerEvents: 'none',
                }),
            }),
        ]),
    ]);
};

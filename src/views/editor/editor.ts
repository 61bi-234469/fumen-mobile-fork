import { CommentType, GradientPattern, Piece, Platforms, Screens } from '../../lib/enums';
import { Coordinate, getNavigatorHeight, Size } from '../commons';
import { View } from 'hyperapp';
import { resources, State } from '../../states';
import { EditorTools } from '../../components/tools/editor_tools';
import { ColorPalette, Palette } from '../../lib/colors';
import { Actions } from '../../actions';
import { Field } from '../../components/field';
import { KonvaCanvas } from '../../components/konva_canvas';
import { DrawingEventCanvas } from '../../components/event/drawing_event_canvas';
import { button, div } from '@hyperapp/html';
import { px, style } from '../../lib/types';
import { comment } from '../../components/comment';
import { page_slider } from '../../components/page_slider';
import { navigatorElement } from '../navigator';
import { getSidePanelWidth } from './side_panel_layout';
import { sidePanel } from './side_panel';
import { editorRail } from './editor_rail';
import { editorOverlay } from './editor_overlay';
import { CONTEXT_TRAY_HEIGHT, contextTray } from './context_tray';
import { BlockIcon } from '../../components/atomics/icons';
import { composeSelectionField } from '../../lib/rect_selection';
import { SelectionOverlay } from '../../components/selection_overlay';
import { i18n } from '../../locales/keys';
import {
    DESKTOP_CONTEXT_WIDTH,
    desktopContextInspector,
} from './desktop_context_inspector';

interface FieldLayout {
    topLeft: Coordinate;
    size: Size;
}

export interface EditorLayout {
    canvas: {
        topLeft: Coordinate;
        size: Size;
    };
    field: {
        blockSize: number;
        bottomBorderWidth: number;
        topLeft: Coordinate;
        size: Size;
    };
    buttons: {
        size: Size;
    };
    comment: {
        topLeft: Coordinate;
        size: Size;
    };
    tools: {
        topLeft: Coordinate;
        size: Size;
    };
}

export const getFieldLayout = (
    { topLeftY, width, height, sidePanelWidth }: {
        topLeftY: number, width: number, height: number, sidePanelWidth: number,
    },
): FieldLayout => {
    const commentHeight = 35;
    const toolsHeight = 50;
    const borderWidthBottomField = 2.4;

    const canvasSize = {
        width: width - sidePanelWidth,
        height: height - (toolsHeight + commentHeight + topLeftY),
    };

    const blockSize = Math.min(
        (canvasSize.height - borderWidthBottomField - 2) / 24,
        (canvasSize.width - 90) / 10.5,  // 横のスペ�Eスが最低でめE0pxは残るようにする
    ) - 1;

    const fieldSize = {
        width: (blockSize + 1) * 10 + 1,
        height: (blockSize + 1) * 23.5 + 1 + borderWidthBottomField,
    };

    return {
        topLeft: {
            x: 0,
            y: (canvasSize.height - fieldSize.height) / 2.0,
        },
        size: {
            width: fieldSize.width,
            height: fieldSize.height,
        },
    };
};

const getLayout = (
    { topLeftY, width, height, sidePanelWidth, rightInspectorWidth, bottomContentHeight }: {
        topLeftY: number, width: number, height: number, sidePanelWidth: number,
        rightInspectorWidth: number, bottomContentHeight: number,
    },
): EditorLayout => {
    const toolsHeight = 50;
    const borderWidthBottomField = 2.4;

    // パネル表示中は盤面領域だけ狭める（コメント欄・ツールバーは全幅のまま）
    const canvasSize = {
        width: width - sidePanelWidth - rightInspectorWidth,
        height: height - (toolsHeight + bottomContentHeight + topLeftY),
    };

    const blockSize = Math.min(
        (canvasSize.height - borderWidthBottomField - 2) / 24,
        (canvasSize.width - 90) / 10.5,  // 横のスペ�Eスが最低でめE0pxは残るようにする
    ) - 1;

    const fieldSize = {
        width: (blockSize + 1) * 10 + 1,
        height: (blockSize + 1) * 23.5 + 1 + borderWidthBottomField + 1,
    };

    const pieceButtonsSize = {
        width: Math.min((canvasSize.width - fieldSize.width) * 0.6, 80),
        height: Math.min(
            fieldSize.height / (1.25 * 18 + 0.25),
            30,
        ),
    };

    return {
        canvas: {
            topLeft: {
                x: 0,
                y: topLeftY,
            },
            size: {
                width: fieldSize.width,
                height: canvasSize.height,
            },
        },
        field: {
            blockSize,
            bottomBorderWidth: borderWidthBottomField,
            topLeft: {
                x: 0,
                y: (canvasSize.height - fieldSize.height) / 2.0,
            },
            size: {
                width: fieldSize.width,
                height: fieldSize.height,
            },
        },
        buttons: {
            size: pieceButtonsSize,
        },
        comment: {
            topLeft: {
                x: 0,
                y: height - bottomContentHeight - toolsHeight,
            },
            size: {
                width,
                height: 35,
            },
        },
        tools: {
            topLeft: {
                x: 0,
                y: height - toolsHeight,
            },
            size: {
                width,
                height: toolsHeight,
            },
        },
    };
};

export const toolStyle = (layout: EditorLayout) => {
    const margin = (layout.canvas.size.height - layout.field.size.height) / 2;
    return style({
        marginTop: '0px',
        marginBottom: '0px',
        marginLeft: '10px',
        marginRight: '0px',
        padding: `${px(margin)} 0px`,
        display: 'flex',
        justifyContent: 'flex-end',
        flexDirection: 'column',
        alignItems: 'center',
        height: px(layout.canvas.size.height),
        width: px(layout.buttons.size.width),
    });
};

const ScreenField = (state: State, actions: Actions, layout: EditorLayout) => {
    const getGradientPattern = (piece: Piece | 'inference') => {
        if (piece === 'inference') {
            return GradientPattern.None;
        }
        const gradient = state.mode.gradient[piece];

        if (gradient) {
            return gradient;
        }
        return GradientPattern.None;
    };

    const getChildren = () => {
        return [   // canvas:Field とのマッピング用仮想DOM
            KonvaCanvas({  // canvas空間�Eみ
                actions,
                canvas: layout.canvas.size,
                hyperStage: resources.konva.stage,
            }),

            Field({
                getGradientPattern,
                fieldMarginWidth: layout.field.bottomBorderWidth,
                topLeft: layout.field.topLeft,
                blockSize: layout.field.blockSize,
                field: composeSelectionField(state),
                sentLine: state.sentLine,
                guideLineColor: state.fumen.guideLineColor,
            }),

            SelectionOverlay({
                rect: resources.konva.selectionFrame,
                selection: state.rectSelect,
                topLeft: layout.field.topLeft,
                blockSize: layout.field.blockSize,
            }),

            editorRail(state, actions, layout),

            editorOverlay(state, actions, layout) as any,
        ];
    };

    // フィールドエリアをクリチE��したらフォーカスを移動（キーボ�EドショートカチE��有効化�Eため�E�E
    const handleFieldClick = (event: MouseEvent) => {
        const target = event.target as HTMLElement;
        // コメント�E力欁E��外をクリチE��した場合、フィールドにフォーカスを移勁E
        const tagName = target.tagName.toLowerCase();
        if (tagName !== 'input' && tagName !== 'textarea') {
            const fieldTop = document.getElementById('field-top');
            if (fieldTop) {
                fieldTop.focus();
            }
        }
    };

    return div({
        key: 'field-top',
        id: 'field-top',
        tabIndex: -1, // フォーカス可能にする�E�Eabでは移動しなぁE��E
        style: style({
            display: 'flex',
            justifyContent: 'center',
            flexDirection: 'row',
            alignItems: 'center',
            userSelect: 'none',
            outline: 'none', // フォーカス時�E枠線を消す
            flex: '1 1 auto',
            minWidth: '0',
            position: 'relative',
        }),
        onclick: handleFieldClick,
    }, getChildren());
};

const Events = (state: State, actions: Actions) => {
    const mode = state.mode;
    if (mode === undefined) {
        return undefined;
    }

    return DrawingEventCanvas({
        actions,
        fieldBlocks: resources.konva.fieldBlocks,
        sentBlocks: resources.konva.sentBlocks,
        fieldLayer: resources.konva.layers.field,
    });
};

const Tools = (state: State, actions: Actions, height: number, palette: ColorPalette) => {
    return EditorTools({
        height,
        palette,
        editShortcuts: state.mode.editShortcuts,
        shortcutLabelVisible: state.mode.shortcutLabelVisible,
        actions: {
            openFumenModal: actions.openFumenModal,
            openMenuModal: actions.openMenuModal,
            executeNewFumen: actions.executeNewFumen,
            changeToListViewScreen: actions.changeToListViewScreen,
            changeToTreeViewScreen: actions.changeToTreeViewScreen,
            startAnimation: actions.startAnimation,
            pauseAnimation: actions.pauseAnimation,
            backPage: actions.backPage,
            nextPage: actions.nextPage,
            firstPage: actions.firstPage,
            lastPage: actions.lastPage,
            duplicatePageOnly: actions.duplicatePageOnly,
            duplicatePageToGray: actions.duplicatePageToGray,
            changeToDrawingToolMode: actions.changeToDrawingToolMode,
            undo: actions.undo,
            redo: actions.redo,
        },
        currentPage: state.fumen.currentIndex + 1,
        maxPage: state.fumen.maxPage,
        modeType: state.mode.type,
        undoCount: state.history.undoCount,
        redoCount: state.history.redoCount,
        inferenceCount: state.events.inferences.length,
    });
};

export const getComment = (state: State, actions: Actions, layout: EditorLayout) => {
    const currentIndex = state.fumen.currentIndex;
    const currentPage = state.fumen.pages[currentIndex];

    switch (state.mode.comment) {
    case CommentType.Writable: {
        const isCommentKey = resources.comment !== undefined
            || (currentPage !== undefined && currentPage.comment.text !== undefined);

        return comment({
            currentIndex,
            actions,
            key: `text-comment-editor-${state.comment.changeKey}`,
            dataTest: 'text-comment',
            id: 'text-comment',
            textColor: isCommentKey ? '#333' : '#757575',
            backgroundColorClass: 'white',
            height: layout.comment.size.height,
            text: resources.comment !== undefined ? resources.comment.text : state.comment.text,
            placeholder: 'comment',
            readonly: false,
        });
    }
    case CommentType.Readonly: {
        const currentIndex = state.fumen.currentIndex;
        const currentPage = state.fumen.pages[currentIndex];
        const isCommentKey = resources.comment !== undefined
            || (currentPage !== undefined && currentPage.comment.text !== undefined);

        return comment({
            currentIndex,
            actions,
            key: `text-comment-editor-readonly-${state.comment.changeKey}`,
            dataTest: 'text-comment',
            id: 'text-comment',
            textColor: isCommentKey ? '#333' : '#757575',
            backgroundColorClass: 'white',
            height: layout.comment.size.height,
            text: resources.comment !== undefined ? resources.comment.text : state.comment.text,
            readonly: true,
        });
    }
    case CommentType.PageSlider: {
        return page_slider({
            currentIndex,
            actions,
            datatest: 'range-page-slider',
            size: {
                width: layout.comment.size.width * 0.8,
                height: layout.comment.size.height,
            },
            maxPage: state.fumen.maxPage,
        });
    }
    }
};

export const view: View<State, Actions> = (state, actions) => {
    const navigatorHeight = getNavigatorHeight(state.platform);
    const sidePanelWidth = getSidePanelWidth(state);
    const rightInspectorWidth = state.platform === Platforms.PC
        && 1400 <= state.display.width - sidePanelWidth ? DESKTOP_CONTEXT_WIDTH : 0;

    const baseAvailableEditorHeight = state.display.height - navigatorHeight - 50 - 35;
    const compact = baseAvailableEditorHeight < 560;
    const pageSliderVisible = state.mode.comment === CommentType.PageSlider;
    const trayVisible = rightInspectorWidth === 0
        && !pageSliderVisible
        && (!compact || state.editorUi.compactPanel === 'tray');
    const commentVisible = pageSliderVisible || !compact || !trayVisible;
    const bottomContentHeight = (trayVisible ? CONTEXT_TRAY_HEIGHT : 0) + (commentVisible ? 35 : 0);

    // 初期匁E
    const layout = getLayout({
        bottomContentHeight,
        rightInspectorWidth,
        sidePanelWidth,
        ...state.display,
        topLeftY: navigatorHeight,
    });
    const palette = Palette(Screens.Editor);
    const batchDraw = () => resources.konva.stage.batchDraw();

    return div({
        oncreate: batchDraw,
        onupdate: batchDraw,
        key: 'view',
    }, [ // Hyperappでは最上位�Eノ�Eドが最後に実行される
        resources.konva.stage.isReady ? Events(state, actions) : undefined as any,

        navigatorElement({
            palette,
            height: navigatorHeight,
            enabled: state.editorPanel.enabled,
            screen: Screens.Editor,
            actions: {
                toggleEditorSidePanel: actions.toggleEditorSidePanel,
            },
        }),

        div({
            key: 'editor-body',
            style: style({
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'stretch',
            }),
        }, [
            ...(0 < sidePanelWidth ? [sidePanel(state, actions, {
                width: sidePanelWidth,
                height: layout.canvas.size.height,
            })] : []),

            ScreenField(state, actions, layout),

            ...(0 < rightInspectorWidth ? [desktopContextInspector(state, actions, layout.canvas.size.height)] : []),
        ]),

        div({
            key: 'menu-top',
        }, [
            ...(trayVisible ? [contextTray(state, actions)] : []),

            ...(commentVisible ? [getComment(state, actions, layout)] : []),

            ...(compact && !pageSliderVisible ? [button({
                key: 'btn-comment-tray-handle',
                datatest: 'btn-comment-tray-handle',
                type: 'button',
                'aria-label': trayVisible ? i18n.Menu.Buttons.ShowComment() : i18n.EditorUi.TrayHandle(),
                onclick: trayVisible ? actions.showCommentPanel : actions.showContextTray,
                style: style({
                    alignItems: 'center',
                    background: '#f44336',
                    border: '1px solid #d32f2f',
                    borderRadius: '0 4px 4px 0',
                    bottom: px(50),
                    color: '#fff',
                    cursor: 'pointer',
                    display: 'flex',
                    height: px(40),
                    justifyContent: 'center',
                    left: '0',
                    padding: '0',
                    position: 'absolute',
                    width: px(22),
                    zIndex: 12,
                }),
            }, [BlockIcon({ key: 'handle-icon', iconSize: 17 }, trayVisible ? 'comment' : 'tune')])] : []),

            Tools(state, actions, layout.tools.size.height, palette),
        ]),
    ]);
};

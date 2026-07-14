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
import { div } from '@hyperapp/html';
import { px, style } from '../../lib/types';
import { comment } from '../../components/comment';
import { page_slider } from '../../components/page_slider';
import { navigatorElement } from '../navigator';
import { getSidePanelWidth } from './side_panel_layout';
import { sidePanel } from './side_panel';
import { editorRail } from './editor_rail';
import { editorOverlay } from './editor_overlay';
import { CONTEXT_TRAY_HEIGHT, contextTray } from './context_tray';
import { composeSelectionField } from '../../lib/rect_selection';
import { SelectionOverlay } from '../../components/selection_overlay';
import {
    DESKTOP_CONTEXT_WIDTH,
    desktopContextInspector,
} from './desktop_context_inspector';
import { getEditorBottomMetrics, getEditorRailConfig } from './responsive_layout';

interface FieldLayout {
    topLeft: Coordinate;
    size: Size;
}

export interface EditorLayout {
    // トレイを盤面下部の枠（せり上がり部と排他）に置けるか（右インスペクタ表示中などは不可）
    trayInBottom: boolean;
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
        columns: 1 | 2;
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
    const { commentHeight, toolsHeight } = getEditorBottomMetrics(height);
    const borderWidthBottomField = 2.4;

    const canvasSize = {
        width: width - sidePanelWidth,
        height: height - (toolsHeight + commentHeight + topLeftY),
    };

    const blockSize = Math.min(
        (canvasSize.height - borderWidthBottomField - 2) / 24,
        (canvasSize.width - 90) / 10.5,
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

interface LayoutParams {
    topLeftY: number;
    width: number;
    height: number;
    sidePanelWidth: number;
    rightInspectorWidth: number;
    trayInBottom: boolean;
}

export const getLayout = (
    { topLeftY, width, height, sidePanelWidth, rightInspectorWidth, trayInBottom }: LayoutParams,
): EditorLayout => {
    const { commentHeight, toolsHeight } = getEditorBottomMetrics(height);
    const borderWidthBottomField = 2.4;

    // パネル表示中は盤面領域だけ狭める（コメント欄・ツールバーは全幅のまま）
    // 盤面サイズは develop 時点の計算式と完全に一致させる（トレイは盤面下部に
    // 「せり上がり部と同じ枠」を重ねて表示するだけで、盤面の大きさには影響しない）。
    const canvasSize = {
        width: width - sidePanelWidth - rightInspectorWidth,
        height: height - (toolsHeight + commentHeight + topLeftY),
    };

    const rail = getEditorRailConfig(canvasSize.height);

    const blockSize = Math.min(
        (canvasSize.height - borderWidthBottomField - 2) / 24,
        (canvasSize.width - rail.reserve) / 10.5,
    ) - 1;

    const fieldSize = {
        width: (blockSize + 1) * 10 + 1,
        height: (blockSize + 1) * 23.5 + 1 + borderWidthBottomField + 1,
    };

    const pieceButtonsSize = {
        width: Math.min(Math.max((canvasSize.width - fieldSize.width) * rail.widthRatio, rail.minWidth),
            rail.maxWidth),
        height: Math.min(
            fieldSize.height / (1.25 * 18 + 0.25),
            30,
        ),
    };

    return {
        trayInBottom,
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
            columns: rail.columns,
        },
        comment: {
            topLeft: {
                x: 0,
                y: height - commentHeight - toolsHeight,
            },
            size: {
                width,
                height: commentHeight,
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

    // せり上がり部と同じ「枠」にトレイを重ねる（盤面(develop と同じサイズ)はズレない）。
    // 枠の位置・高さは、Field コンポーネントがせり上がり行を描く座標と厳密に一致させる。
    const bottomTrayVisible = layout.trayInBottom && state.editorUi.bottomSlot === 'tray';
    const sentLineVisible = !bottomTrayVisible;
    const bandTop = layout.field.topLeft.y + (layout.field.blockSize + 1) * 22.5 + 1
        + layout.field.bottomBorderWidth;
    const bandHeight = layout.field.bottomBorderWidth + layout.field.blockSize;
    const pieceTrayAvailableHeight = layout.canvas.size.height - bandTop + layout.comment.size.height - 1;
    const trayHeight = state.editorUi.primaryTool === 'piece'
        ? Math.min(CONTEXT_TRAY_HEIGHT * 2, Math.max(bandHeight, pieceTrayAvailableHeight))
        : bandHeight;

    const fieldColumn = div({
        key: 'field-column',
        style: style({
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            width: px(layout.field.size.width),
        }),
    }, [
        KonvaCanvas({  // canvas空間�Eみ
            actions,
            canvas: layout.canvas.size,
            hyperStage: resources.konva.stage,
        }),

        div({
            key: 'editor-field-frame',
            datatest: 'editor-field-frame',
            style: style({
                height: px(layout.field.size.height),
                left: '0',
                pointerEvents: 'none',
                position: 'absolute',
                top: px(layout.field.topLeft.y),
                width: px(layout.field.size.width),
            }),
        }),

        Field({
            sentLineVisible,
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

        ...(bottomTrayVisible ? [div({
            key: 'field-bottom-tray',
            datatest: 'field-bottom-tray',
            style: style({
                height: px(bandHeight),
                left: '0',
                position: 'absolute',
                right: '0',
                top: px(bandTop),
                zIndex: 5,
            }),
        }, [contextTray(state, actions, trayHeight)])] : []),
    ]);

    const getChildren = () => {
        return [   // canvas:Field とのマッピング用仮想DOM
            fieldColumn,

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
        width: state.display.width,
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
            undo: actions.undo,
            redo: actions.redo,
        },
        currentPage: state.fumen.currentIndex + 1,
        maxPage: state.fumen.maxPage,
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

    const pageSliderVisible = state.mode.comment === CommentType.PageSlider;
    // トレイを盤面下部（せり上がり部と同じ枠）に置くかどうか。
    // 右インスペクタ表示中はトレイをそちらに出すため下部枠は使わない。
    const trayInBottom = rightInspectorWidth === 0 && !pageSliderVisible;
    // コメント欄は常時表示（最優先）。トレイは盤面下部の枠に重ねるだけで高さには含めない
    // （盤面サイズは develop 時点の計算式と完全に一致させる）。
    // 初期匁E
    const layout = getLayout({
        rightInspectorWidth,
        sidePanelWidth,
        trayInBottom,
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
            getComment(state, actions, layout),

            Tools(state, actions, layout.tools.size.height, palette),
        ]),
    ]);
};

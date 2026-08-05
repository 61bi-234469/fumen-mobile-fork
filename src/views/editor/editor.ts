import { CommentType, GradientPattern, ModeTypes, Piece, Screens } from '../../lib/enums';
import { Coordinate, getNavigatorHeight, Size } from '../commons';
import { View } from 'hyperapp';
import { PieceLayoutMode, resources, State } from '../../states';
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
    getEditorBottomMetrics, getEditorRailConfig, getPlayfieldCeilingOffset, getPlayPieceQueueWidth,
    getPlayPieceRailMetrics, getPlayPieceUnitBound, getResponsiveRailCellHeight, getInputStatsPanelTier,
    INPUT_STATS_GAP, PIECE_RIGHT_COLUMN_GAP,
} from './responsive_layout';
import { pieceQueueOverlays } from './piece_queue_overlay';
import { resolveCurrentColdClearMenuQueueState } from '../../actions/cold_clear';
import { computeInputStats } from '../../lib/input_stats';
import { inputStatsPanel } from './input_stats_panel';

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
        cellHeight: number;
    };
    pieceQueue: {
        visible: boolean;
        width: number;
        gap: number;
        nextMinoHeight: number;
        nextPanelHeight: number;
        railExtensionHeight: number;
        ceilingOffset: number;
    };
    comment: {
        topLeft: Coordinate;
        size: Size;
        reservedHeight: number;
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
    // PIECE状態かどうかと、その表示レイアウト
    pieceModeVisible?: boolean;
    pieceLayout?: PieceLayoutMode;
    commentVisible?: boolean;
    reserveCommentHeight?: boolean;
}

export const getLayout = (
    {
        topLeftY,
        width,
        height,
        sidePanelWidth,
        rightInspectorWidth,
        trayInBottom,
        pieceModeVisible = false,
        pieceLayout = 'select',
        commentVisible = true,
        reserveCommentHeight = commentVisible,
    }: LayoutParams,
): EditorLayout => {
    const pieceQueueVisible = pieceModeVisible && pieceLayout === 'play';
    const bottomMetrics = getEditorBottomMetrics(height);
    const visibleCommentHeight = commentVisible ? bottomMetrics.commentHeight : 0;
    const reservedCommentHeight = reserveCommentHeight ? bottomMetrics.commentHeight : 0;
    const { toolsHeight } = bottomMetrics;
    const borderWidthBottomField = 2.4;

    // パネル表示中は盤面領域だけ狭める（コメント欄・ツールバーは全幅のまま）
    // 盤面サイズは develop 時点の計算式と完全に一致させる（トレイは盤面下部に
    // 「せり上がり部と同じ枠」を重ねて表示するだけで、盤面の大きさには影響しない）。
    const canvasSize = {
        width: width - sidePanelWidth - rightInspectorWidth,
        height: height - (toolsHeight + reservedCommentHeight + topLeftY),
    };

    const rail = getEditorRailConfig(canvasSize.height);
    const pieceQueueGap = pieceQueueVisible
        ? Math.min(6, Math.max(2, canvasSize.width * .012))
        : 0;
    const heightBoundUnit = (canvasSize.height - borderWidthBottomField - 2) / 24;

    // 操作重視ではHOLD列とNEXT列を盤面のマス基準（各3.4マス）で確保する。
    // 幅・高さの両制約を同時に解いてから列幅を決め、下限クランプで溢れる場合だけ従来式へ戻す。
    let blockSize: number;
    let pieceQueueWidth = 0;
    if (pieceQueueVisible) {
        const unit = Math.min(heightBoundUnit, getPlayPieceUnitBound(canvasSize.width, pieceQueueGap));
        pieceQueueWidth = getPlayPieceQueueWidth(unit);
        const horizontalReserve = pieceQueueWidth * 2 + pieceQueueGap + PIECE_RIGHT_COLUMN_GAP;
        blockSize = unit * 10 + 1 + horizontalReserve <= canvasSize.width
            ? unit - 1
            : Math.min(heightBoundUnit, (canvasSize.width - horizontalReserve) / 10.5) - 1;
    } else {
        blockSize = Math.min(heightBoundUnit, (canvasSize.width - rail.reserve) / 10.5) - 1;
    }

    const fieldSize = {
        width: (blockSize + 1) * 10 + 1,
        height: (blockSize + 1) * 23.5 + 1 + borderWidthBottomField + 1,
    };

    const pieceQueueCeilingOffset = pieceQueueVisible ? getPlayfieldCeilingOffset(blockSize) : 0;
    const targetPieceRailCellHeight = getResponsiveRailCellHeight(fieldSize.height, 1);
    const fieldBottomGap = Math.max(0, (canvasSize.height - fieldSize.height) / 2);
    const maxPieceRailExtension = Math.max(0, reservedCommentHeight + fieldBottomGap - 1);
    const pieceRailMetrics = pieceQueueVisible
        ? getPlayPieceRailMetrics(fieldSize.height - pieceQueueCeilingOffset, pieceQueueWidth,
            targetPieceRailCellHeight, maxPieceRailExtension)
        : { nextMinoHeight: 0, nextPanelHeight: 0, railCellHeight: 0, railExtensionHeight: 0 };

    const railColumns: 1 | 2 = pieceQueueVisible ? 1 : rail.columns;
    const railCellHeight = pieceQueueVisible
        ? pieceRailMetrics.railCellHeight
        : getResponsiveRailCellHeight(fieldSize.height, railColumns);

    const pieceButtonsSize = {
        width: pieceQueueVisible ? pieceQueueWidth
            : Math.min(Math.max((canvasSize.width - fieldSize.width) * rail.widthRatio, rail.minWidth),
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
            columns: railColumns,
            cellHeight: railCellHeight,
        },
        pieceQueue: {
            visible: pieceQueueVisible,
            width: pieceQueueWidth,
            gap: pieceQueueGap,
            nextMinoHeight: pieceRailMetrics.nextMinoHeight,
            nextPanelHeight: pieceRailMetrics.nextPanelHeight,
            railExtensionHeight: pieceRailMetrics.railExtensionHeight,
            ceilingOffset: pieceQueueCeilingOffset,
        },
        comment: {
            topLeft: {
                x: 0,
                y: height - bottomMetrics.commentHeight - toolsHeight,
            },
            size: {
                width,
                height: visibleCommentHeight,
            },
            reservedHeight: reservedCommentHeight,
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
    const pieceTrayAvailableHeight = layout.canvas.size.height - bandTop + layout.comment.reservedHeight - 1;
    const pieceModeVisible = state.editorUi.primaryTool === 'piece';
    const trayHeight = pieceModeVisible
        ? Math.min(CONTEXT_TRAY_HEIGHT * 2, Math.max(bandHeight, pieceTrayAvailableHeight))
        : bandHeight;
    const queueState = layout.pieceQueue.visible
        ? resolveCurrentColdClearMenuQueueState(state)
        : null;
    const holdButtonHeight = 20 + layout.pieceQueue.nextMinoHeight;
    const inputStatsTier = getInputStatsPanelTier(layout.field.size.height - layout.pieceQueue.ceilingOffset
        - holdButtonHeight - INPUT_STATS_GAP);
    const computedInputStats = computeInputStats(state.fumen.pages, state.fumen.currentIndex, {
        rotationSystem: state.mode.rotationSystem,
        tree: state.tree.enabled ? { nodes: state.tree.nodes, rootId: state.tree.rootId, version: 2 } : undefined,
    });
    const statsPanel = layout.pieceQueue.visible && inputStatsTier !== 'hidden'
        ? inputStatsPanel({
            ...computedInputStats,
            lastAction: state.events.lastInputPlacement ?? computedInputStats.lastAction,
        }, inputStatsTier)
        : undefined;
    const queueOverlays = layout.pieceQueue.visible ? pieceQueueOverlays({
        queueState,
        statsPanel,
        width: layout.pieceQueue.width,
        gap: layout.pieceQueue.gap,
        fieldHeight: layout.field.size.height,
        ceilingOffset: layout.pieceQueue.ceilingOffset,
        nextMinoHeight: layout.pieceQueue.nextMinoHeight,
        guideLineColor: state.fumen.guideLineColor,
        infinitePieceQueue: state.editorUi.infinitePieceQueue,
        sevenBagGrayEnabled: state.mode.sevenBagGrayEnabled,
        openSettings: ({ focus }) => actions.openPieceQueueModal({ focus }),
        toggleInfinitePieceQueue: () => {
            actions.commitCommentText();
            actions.toggleInfinitePieceQueue();
        },
        toggleSevenBagGray: () => {
            actions.commitCommentText();
            actions.setSevenBagGrayEnabled({ enable: !state.mode.sevenBagGrayEnabled });
        },
    }) : null;

    const fieldColumn = div({
        key: 'field-column',
        style: style({
            display: 'flex',
            flexDirection: 'column',
            flexShrink: 0,
            position: 'relative',
            width: px(layout.field.size.width),
        }),
    }, [
        KonvaCanvas({  // canvas空間のみ
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

    // Playレイアウトのときだけ、NEXT枠・∞7bag・レールを右側の1列にまとめる
    const rightColumn = queueOverlays === null
        ? editorRail(state, actions, layout)
        : div({
            key: 'piece-right-column',
            style: style({
                alignSelf: 'center',
                boxSizing: 'border-box',
                display: 'flex',
                flexDirection: 'column',
                flexShrink: 0,
                height: px(layout.field.size.height + layout.pieceQueue.railExtensionHeight),
                marginLeft: px(PIECE_RIGHT_COLUMN_GAP),
                paddingTop: px(layout.pieceQueue.ceilingOffset),
                position: 'relative',
                top: px(layout.pieceQueue.railExtensionHeight / 2),
                width: px(layout.buttons.size.width),
            }),
        }, [
            queueOverlays.nextPanel,
            editorRail(state, actions, layout),
        ]);

    const getChildren = () => {
        return [   // canvas:Field とのマッピング用仮想DOM
            ...(queueOverlays ? [queueOverlays.holdPanel] : []),

            fieldColumn,

            rightColumn,

            editorOverlay(state, actions, layout) as any,
        ];
    };

    // フィールドエリアをクリックしたらフォーカスを移動（キーボードショートカット有効化のため）
    const handleFieldClick = (event: MouseEvent) => {
        const target = event.target as HTMLElement;
        // コメント入力欄以外をクリックした場合、フィールドにフォーカスを移動
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
        tabIndex: -1, // フォーカス可能にする（Tabでは移動しない）
        style: style({
            display: 'flex',
            justifyContent: 'center',
            flexDirection: 'row',
            alignItems: 'center',
            userSelect: 'none',
            outline: 'none', // フォーカス時の枠線を消す
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
        loop: state.mode.loop,
        actions: {
            openFumenModal: actions.openFumenModal,
            openUserSettingsModal: () => actions.openUserSettingsModal({ initialTab: 'edit' }),
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
            duplicatePageOnly: state.editorUi.primaryTool === 'piece'
                && state.editorUi.pieceLayout === 'select'
                ? actions.duplicatePageToGray
                : actions.duplicatePageOnly,
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
    case CommentType.Writable:
    case CommentType.Readonly: {
        const readonly = state.mode.comment === CommentType.Readonly;
        const isCommentKey = resources.comment !== undefined
            || (currentPage !== undefined && currentPage.comment.text !== undefined);

        return comment({
            currentIndex,
            actions,
            key: readonly
                ? `text-comment-editor-readonly-${state.comment.changeKey}`
                : `text-comment-editor-${state.comment.changeKey}`,
            dataTest: 'text-comment',
            id: 'text-comment',
            textColor: isCommentKey ? '#333' : '#757575',
            backgroundColorClass: 'white',
            height: layout.comment.size.height,
            text: resources.comment !== undefined ? resources.comment.text : state.comment.text,
            ...(readonly ? {} : { placeholder: 'comment' }),
            readonly,
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
    // Keep the context tray in the bottom slot on every platform.
    const rightInspectorWidth = 0;

    const pageSliderVisible = state.mode.comment === CommentType.PageSlider;
    // トレイを盤面下部（せり上がり部と同じ枠）に置くかどうか。
    // ページスライダー表示中はコメント欄を優先してトレイを出さない。
    const trayInBottom = !pageSliderVisible;
    const contextTrayVisible = trayInBottom && state.editorUi.bottomSlot === 'tray';
    const paintOrSelect = state.editorUi.primaryTool === 'paint'
        || state.editorUi.primaryTool === 'select';
    // PAINT/SELECTはトレイとコメントを同時に表示する。トレイと排他にするのは
    // フィールド下部のせり上がり行だけで、コメントはその下の独立行に残す。
    // PIECEでは既存のキュー／コメント表示条件を維持する。
    const commentVisible = paintOrSelect
        || !contextTrayVisible
        || state.mode.type === ModeTypes.Comment;
    const reserveCommentHeight = commentVisible || state.editorUi.primaryTool === 'piece';

    const layout = getLayout({
        rightInspectorWidth,
        sidePanelWidth,
        trayInBottom,
        commentVisible,
        reserveCommentHeight,
        pieceModeVisible: state.editorUi.primaryTool === 'piece',
        pieceLayout: state.editorUi.pieceLayout,
        ...state.display,
        topLeftY: navigatorHeight,
    });
    const palette = Palette(Screens.Editor);
    const batchDraw = () => resources.konva.stage.batchDraw();

    return div({
        oncreate: batchDraw,
        onupdate: batchDraw,
        key: 'view',
    }, [ // Hyperappでは最上位のノードが最後に実行される
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

        ]),

        div({
            key: 'menu-top',
        }, [
            commentVisible
                ? getComment(state, actions, layout)
                : layout.comment.reservedHeight > 0 ? div({
                    key: 'reserved-comment-space',
                    style: style({ height: px(layout.comment.reservedHeight) }),
                }) : undefined as any,

            Tools(state, actions, layout.tools.size.height, palette),
        ]),
    ]);
};

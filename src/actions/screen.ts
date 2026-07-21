import { NextState, sequence } from './commons';
import { action, actions, main } from '../actions';
import { CommentType, gradientPatternFrom, ModeTypes, Piece, Screens, TouchTypes } from '../lib/enums';
import { TreeViewMode } from '../lib/fumen/tree_types';
import { createTreeFromPages, findNodeByPageIndex } from '../lib/fumen/tree_utils';
import {
    EditShortcuts, InitialScreenSetting, PaletteShortcuts, PieceShortcuts, resources, RotationSystem, State,
} from '../states';
import { animationActions } from './animation';
import { gradientPieces } from './user_settings';
import { clearThumbnailCache } from '../lib/thumbnail';
import { guideLineColorFromRotationSystem, synchronizeFirstPageColorize } from '../lib/rotation_system';

const focusCommentInput = () => {
    if (typeof document === 'undefined') {
        return;
    }
    setTimeout(() => {
        const element = document.querySelector('[datatest="text-comment"]') as HTMLInputElement | null;
        element?.focus();
    }, 0);
};

export interface ScreenActions {
    changeToReaderScreen: () => action;
    changeToDrawerScreen: (data: { refresh?: boolean }) => action;
    changeToListViewScreen: () => action;
    changeToTreeViewScreen: () => action;
    changeToDrawingToolMode: () => action;
    changeToShiftMode: () => action;
    changeToCommentMode: () => action;
    changeToMovePieceMode: () => action;
    changeScreen: (data: { screen: Screens }) => action;
    changeCommentMode: (data: { type: CommentType }) => action;
    changeGhostVisible: (data: { visible: boolean }) => action;
    changeDeleteSpawnMinoOnPaintDrag: (data: { enable: boolean }) => action;
    changeInitialScreen: (data: { initialScreen: InitialScreenSetting }) => action;
    changeOpenTreeScreenOnTreeData: (data: { enable: boolean }) => action;
    changeLoop: (data: { enable: boolean }) => action;
    changeShortcutLabelVisible: (data: { visible: boolean }) => action;
    changeGradient: (data: { gradientStr: string }) => action;
    changeRotationSystem: (data: { rotationSystem: RotationSystem }) => action;
    changeNoGrayAfterHardDrop: (data: { enable: boolean }) => action;
    changePaletteShortcuts: (data: { paletteShortcuts: PaletteShortcuts }) => action;
    changeEditShortcuts: (data: { editShortcuts: EditShortcuts }) => action;
    changePieceShortcuts: (data: { pieceShortcuts: PieceShortcuts }) => action;
    changePieceShortcutDas: (data: { dasFrames: number }) => action;
    changePieceShortcutArr: (data: { arrFrames: number }) => action;
    changePieceShortcutDasCut: (data: { dasCutFrames: number }) => action;
    changePieceShortcutSdf: (data: { sdf: number }) => action;
    changeGifFrameDelay: (data: { delayMs: number }) => action;
}

export const modeActions: Readonly<ScreenActions> = {
    changeToReaderScreen: () => (state): NextState => {
        if (resources.konva.stage.isReady) {
            resources.konva.stage.reload((done) => {
                main.changeScreen({ screen: Screens.Reader });
                done();
            });
        } else {
            // Deferred so this dispatch always lands after the outer reducer's own return
            // value has been merged; dispatching synchronously here races with that merge
            // (a nested dispatch applies first, then the outer merge - built from a state
            // snapshot captured before this ran - can clobber mode.screen back).
            setTimeout(() => main.changeScreen({ screen: Screens.Reader }), 0);
        }
        return sequence(state, [
            actions.setListViewSettingsOpened({ opened: false }),
            actions.fixInferencePiece(),
            actions.resetInferencePiece(),
        ]);
    },
    changeToDrawerScreen: ({ refresh }) => (state): NextState => {
        if (resources.konva.stage.isReady) {
            resources.konva.stage.reload((done) => {
                main.changeScreen({ screen: Screens.Editor });
                done();
            });
        } else {
            // See changeToReaderScreen: deferred to avoid racing the outer reducer's own merge.
            setTimeout(() => main.changeScreen({ screen: Screens.Editor }), 0);
        }
        return sequence(state, [
            actions.setListViewSettingsOpened({ opened: false }),
            animationActions.pauseAnimation(),
            refresh ? actions.changeToDrawingToolMode() : undefined,
        ]);
    },
    changeToListViewScreen: () => (state): NextState => {
        const setTreeAutoFocus = () => {
            const shouldAutoFocus = state.tree.enabled && state.tree.viewMode === TreeViewMode.Tree;
            return {
                tree: {
                    ...state.tree,
                    autoFocusPending: shouldAutoFocus,
                },
            };
        };
        return sequence(state, [
            actions.setListViewSettingsOpened({ opened: false }),
            actions.fixInferencePiece(),
            actions.resetInferencePiece(),
            animationActions.pauseAnimation(),
            (currentState) => {
                clearThumbnailCache(currentState.fumen.pages);
                return undefined;
            },
            setTreeAutoFocus,
            () => ({
                mode: {
                    ...state.mode,
                    screen: Screens.ListView,
                },
            }),
        ]);
    },
    changeToTreeViewScreen: () => (state): NextState => {
        const ensureTreeEnabled = state.tree.enabled ? undefined : actions.toggleTreeMode();
        const rebuildTree = state.tree.enabled && (state.tree.nodes.length === 0 || state.tree.rootId === null)
            ? (currentState: State): NextState => {
                const tree = createTreeFromPages(currentState.fumen.pages);
                const currentNode = findNodeByPageIndex(tree, currentState.fumen.currentIndex);
                return {
                    tree: {
                        ...currentState.tree,
                        enabled: true,
                        nodes: tree.nodes,
                        rootId: tree.rootId,
                        activeNodeId: currentNode?.id ?? null,
                    },
                };
            }
            : undefined;
        const ensureTreeViewMode = state.tree.viewMode === TreeViewMode.Tree
            ? undefined
            : actions.setTreeViewMode({ mode: TreeViewMode.Tree });

        return sequence(state, [
            ensureTreeEnabled,
            rebuildTree,
            ensureTreeViewMode,
            actions.changeToListViewScreen(),
        ]);
    },
    changeToDrawingToolMode: () => (state): NextState => {
        return actions.changePaintTool({ tool: 'pen' })(state);
    },
    changeToShiftMode: () => (state): NextState => {
        return sequence(state, [
            actions.clearRectSelection(),
            changeTouchType({ type: TouchTypes.Select, clear: true }),
            changeModeType({ type: ModeTypes.Slide }),
            newState => ({ editorUi: {
                ...newState.editorUi,
                primaryTool: 'paint',
                inspector: 'none',
                bottomSlot: 'tray',
            } }),
            actions.beginWholeFieldMove(),
        ]);
    },
    changeToCommentMode: () => (state): NextState => {
        focusCommentInput();
        return sequence(state, [
            changeTouchType({ type: TouchTypes.Drawing, clear: true }),
            changeModeType({ type: ModeTypes.Comment }),
            newState => ({ editorUi: {
                ...newState.editorUi,
                primaryTool: 'paint',
                inspector: 'none',
                bottomSlot: 'tray',
            } }),
        ]);
    },
    changeToMovePieceMode: () => (state): NextState => {
        return actions.changePieceAction({ pieceAction: 'drag' })(state);
    },
    changeScreen: ({ screen }) => (state): NextState => {
        return {
            mode: {
                ...state.mode,
                screen,
            },
        };
    },
    changeCommentMode: ({ type }) => (state): NextState => {
        return {
            mode: {
                ...state.mode,
                comment: type,
            },
        };
    },
    changeGhostVisible: ({ visible }) => (state): NextState => {
        if (state.mode.ghostVisible === visible) {
            return undefined;
        }
        return sequence(state, [
            (state) => {
                return {
                    mode: {
                        ...state.mode,
                        ghostVisible: visible,
                    },
                };
            },
        ]);
    },
    changeDeleteSpawnMinoOnPaintDrag: ({ enable }) => (state): NextState => {
        if (state.mode.deleteSpawnMinoOnPaintDrag === enable) {
            return undefined;
        }
        return {
            mode: {
                ...state.mode,
                deleteSpawnMinoOnPaintDrag: enable,
            },
        };
    },
    changeInitialScreen: ({ initialScreen }) => (state): NextState => {
        if (state.mode.initialScreen === initialScreen) {
            return undefined;
        }
        return { mode: { ...state.mode, initialScreen } };
    },
    changeOpenTreeScreenOnTreeData: ({ enable }) => (state): NextState => {
        if (state.mode.openTreeScreenOnTreeData === enable) {
            return undefined;
        }
        return { mode: { ...state.mode, openTreeScreenOnTreeData: enable } };
    },
    changeLoop: ({ enable }) => (state): NextState => {
        if (state.mode.loop === enable) {
            return undefined;
        }
        return sequence(state, [
            (state) => {
                return {
                    mode: {
                        ...state.mode,
                        loop: enable,
                    },
                };
            },
        ]);
    },
    changeShortcutLabelVisible: ({ visible }) => (state): NextState => {
        if (state.mode.shortcutLabelVisible === visible) {
            return undefined;
        }
        return {
            mode: {
                ...state.mode,
                shortcutLabelVisible: visible,
            },
        };
    },
    changeGradient: ({ gradientStr }) => (state): NextState => {
        let str = gradientStr;
        const gradientObj: State['mode']['gradient'] = {};
        for (const piece of gradientPieces) {
            gradientObj[piece] = gradientPatternFrom(str[0] || '0');
            str = str.substring(1);
        }

        return sequence(state, [
            (state) => {
                return {
                    mode: {
                        ...state.mode,
                        gradient: gradientObj,
                    },
                };
            },
        ]);
    },
    changeRotationSystem: ({ rotationSystem }) => (state): NextState => {
        const guideLineColor = guideLineColorFromRotationSystem(rotationSystem);
        const synchronized = synchronizeFirstPageColorize(state.fumen.pages, guideLineColor);
        const { pages, changed: colorizeChanged } = synchronized;

        if (state.mode.rotationSystem === rotationSystem
            && state.fumen.guideLineColor === guideLineColor
            && !colorizeChanged) {
            return undefined;
        }

        if (colorizeChanged) {
            clearThumbnailCache(state.fumen.pages);
        }

        return {
            mode: {
                ...state.mode,
                rotationSystem,
            },
            fumen: {
                ...state.fumen,
                pages,
                guideLineColor,
            },
        };
    },
    changeNoGrayAfterHardDrop: ({ enable }) => (state): NextState => {
        if (state.mode.noGrayAfterHardDrop === enable) {
            return undefined;
        }
        return {
            mode: {
                ...state.mode,
                noGrayAfterHardDrop: enable,
            },
        };
    },
    changePaletteShortcuts: ({ paletteShortcuts }) => (state): NextState => {
        return {
            mode: {
                ...state.mode,
                paletteShortcuts,
            },
        };
    },
    changeEditShortcuts: ({ editShortcuts }) => (state): NextState => {
        return {
            mode: {
                ...state.mode,
                editShortcuts,
            },
        };
    },
    changePieceShortcuts: ({ pieceShortcuts }) => (state): NextState => {
        return {
            mode: {
                ...state.mode,
                pieceShortcuts,
            },
        };
    },
    changePieceShortcutDas: ({ dasFrames }) => (state): NextState => {
        return {
            mode: {
                ...state.mode,
                pieceShortcutDasFrames: dasFrames,
            },
        };
    },
    changePieceShortcutArr: ({ arrFrames }) => (state): NextState => {
        return {
            mode: {
                ...state.mode,
                pieceShortcutArrFrames: arrFrames,
            },
        };
    },
    changePieceShortcutDasCut: ({ dasCutFrames }) => (state): NextState => {
        return {
            mode: {
                ...state.mode,
                pieceShortcutDasCutFrames: dasCutFrames,
            },
        };
    },
    changePieceShortcutSdf: ({ sdf }) => (state): NextState => ({
        mode: { ...state.mode, pieceShortcutSdf: sdf },
    }),
    changeGifFrameDelay: ({ delayMs }) => (state): NextState => {
        return {
            mode: {
                ...state.mode,
                gifFrameDelayMs: delayMs,
            },
        };
    },
};

const changeTouchType = (
    { type, clear = false }: { type: TouchTypes, clear?: boolean },
) => (state: State): NextState => {
    if (state.mode.touch === type) {
        if (clear) {
            return actions.removeUnsettledItems()(state);
        }
        return undefined;
    }

    return sequence(state, [
        actions.removeUnsettledItems(),
        () => ({
            mode: {
                ...state.mode,
                touch: type,
            },
        }),
    ]);
};

const changeModeType = ({ type }: { type: ModeTypes }) => (state: State): NextState => {
    if (state.mode.type === type) {
        return undefined;
    }

    return {
        mode: {
            ...state.mode,
            type,
        },
    };
};

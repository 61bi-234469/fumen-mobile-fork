import { View } from 'hyperapp';
import { div } from '@hyperapp/html';
import { Actions } from './actions';
import { State } from './states';
import { Screens } from './lib/enums';
import { view as readerView } from './views/reader';
import { view as editorView } from './views/editor/editor';
import { view as listView } from './views/list_view';
import { view as replayView } from './views/replay';
import { OpenFumenModal } from './components/modals/open';
import { MenuModal } from './components/modals/menu';
import { AppendFumenModal } from './components/modals/append';
import { ClipboardModal } from './components/modals/clipboard';
import { UserSettingsModal } from './components/modals/user_settings';
import { ListViewReplaceModal } from './components/modals/list_view_replace';
import { ListViewMenuModal } from './components/modals/list_view_menu';
import { TreeDisableConfirmModal } from './components/modals/tree_disable_confirm';
import { InputWindowModal } from './components/modals/input_window';
import { describeInputState, resolveInputShareContext } from './lib/input_snapshot';
import { resolveInputRulesPreset } from './lib/input_stats';
import { ColdClearMenuModal } from './components/modals/cold_clear_menu';
import { embedTreeInPages, getPathToNode } from './lib/fumen/tree_utils';
import { SerializedTree } from './lib/fumen/tree_types';
import { getSidePanelWidth } from './views/editor/side_panel_layout';
import {
    canStartColdClearSequenceSearch,
    canStartColdClearTopBranchesSearch,
    canEvaluatePlacedSpawnMinoScore,
    isColdClearSearchBlockedByHoldQueue,
    resolveCurrentColdClearMenuQueueState,
    canClearCommentForColdClearQueue,
    resolveColdClearSearchSetupNeeds,
} from './actions/cold_clear';
import { aiEngineRotationMismatch, availableAiEngines, resolveAiEngine } from './lib/ai_engine';

export const view: View<State, Actions> = (state, actions) => {
    const searchBlockedByHoldQueue = isColdClearSearchBlockedByHoldQueue(state);
    const canSequenceSearch = !searchBlockedByHoldQueue && canStartColdClearSequenceSearch(state);
    const canTopBranchesSearch = !searchBlockedByHoldQueue && canStartColdClearTopBranchesSearch(state);
    const canPlacedSpawnScore = canEvaluatePlacedSpawnMinoScore(state);
    const pageCount = state.fumen.pages.length;
    const realTreeNodeIds = new Set(state.tree.nodes.filter(node => node.pageIndex >= 0).map(node => node.id));
    const selectedPathPageCount = state.tree.activeNodeId === null
        ? pageCount
        : getPathToNode({ nodes: state.tree.nodes, rootId: state.tree.rootId, version: 1 }, state.tree.activeNodeId)
            .filter(nodeId => realTreeNodeIds.has(nodeId))
            .length;
    const currentQueueState = resolveCurrentColdClearMenuQueueState(state);
    const canClearComment = canClearCommentForColdClearQueue(state);

    const selectView = () => {
        const screens = state.mode.screen;
        switch (screens) {
        case Screens.Reader:
            return readerView(state, actions);
        case Screens.Editor:
            return editorView(state, actions);
        case Screens.ListView:
            return listView(state, actions);
        case Screens.Replay:
            return replayView(state, actions);
        default:
            return div(['Unexpected mode']);
        }
    };

    return div([
        selectView(),

        state.modal.fumen ? OpenFumenModal({
            actions,
            errorMessage: state.fumen.errorMessage,
            textAreaValue: state.fumen.value !== undefined ? state.fumen.value : '',
        }) : undefined as any,

        state.modal.menu ? MenuModal({
            actions,
            version: state.version,
            screen: state.mode.screen,
            comment: state.mode.comment,
            treeEnabled: state.tree.enabled,
            treeViewMode: state.tree.viewMode,
            display: state.display,
            platform: state.platform,
            editorSidePanelWidth: getSidePanelWidth(state),
        }) : undefined as any,

        state.modal.append ? AppendFumenModal({
            actions,
            errorMessage: state.fumen.errorMessage,
            textAreaValue: state.fumen.value !== undefined ? state.fumen.value : '',
        }) : undefined as any,

        state.modal.clipboard ? ClipboardModal({
            actions,
            pages: (() => {
                // Embed tree data if tree mode is enabled
                const tree: SerializedTree | null = state.tree.enabled ? {
                    nodes: state.tree.nodes,
                    rootId: state.tree.rootId,
                    version: 1,
                } : null;
                return embedTreeInPages(state.fumen.pages, tree, state.tree.enabled);
            })(),
        }) : undefined as any,

        state.modal.userSettings ? UserSettingsModal({
            actions,
            ghostVisible: state.temporary.userSettings.ghostVisible,
            deleteSpawnMinoOnPaintDrag: state.temporary.userSettings.deleteSpawnMinoOnPaintDrag,
            paintPaletteMinoDesign: state.temporary.userSettings.paintPaletteMinoDesign,
            keepGrayOnPaintDrag: state.temporary.userSettings.keepGrayOnPaintDrag,
            flagsHidden: state.temporary.userSettings.flagsHidden,
            initialScreen: state.temporary.userSettings.initialScreen,
            openTreeScreenOnTreeData: state.temporary.userSettings.openTreeScreenOnTreeData,
            loop: state.temporary.userSettings.loop,
            shortcutLabelVisible: state.temporary.userSettings.shortcutLabelVisible,
            gradient: state.temporary.userSettings.gradient,
            paletteShortcuts: state.temporary.userSettings.paletteShortcuts,
            editShortcuts: state.temporary.userSettings.editShortcuts,
            pieceShortcuts: state.temporary.userSettings.pieceShortcuts,
            pieceShortcutDasFrames: state.temporary.userSettings.pieceShortcutDasFrames,
            pieceShortcutArrFrames: state.temporary.userSettings.pieceShortcutArrFrames,
            pieceShortcutDasCutFrames: state.temporary.userSettings.pieceShortcutDasCutFrames,
            pieceShortcutSdf: state.temporary.userSettings.pieceShortcutSdf,
            pieceShortcutSoftDropPriority: state.temporary.userSettings.pieceShortcutSoftDropPriority,
            pieceSpawnRotation: state.temporary.userSettings.pieceSpawnRotation,
            rotationSystem: state.temporary.userSettings.rotationSystem,
            pageRotationLimit: state.temporary.userSettings.pageRotationLimit,
            grayAfterLineClear: state.temporary.userSettings.grayAfterLineClear,
            currentTab: state.temporary.userSettingsTab,
        }) : undefined as any,

        state.modal.listViewReplace ? ListViewReplaceModal({
            actions,
        }) : undefined as any,

        state.modal.listViewMenu ? ListViewMenuModal({
            actions,
            pageCount,
            selectedPathPageCount,
            treeEnabled: state.tree.enabled,
            exportScope: state.listView.exportScope,
            menuTab: state.listView.menuTab,
            gifFrameDelayMs: state.mode.gifFrameDelayMs,
            shortenUrls: state.listView.shortenUrls,
            exportShowPageNumbers: state.listView.exportShowPageNumbers,
            exportShowComments: state.listView.exportShowComments,
            imageOptionsOpen: state.listView.exportImageOptionsOpen,
            otherSitesOpen: state.listView.exportOtherSitesOpen,
        }) : undefined as any,

        state.modal.treeDisableConfirm ? TreeDisableConfirmModal({
            actions,
        }) : undefined as any,

        state.modal.inputWindow ? (() => {
            // The State tab shows exactly what the share URL carries (same context resolution as the share action).
            const context = resolveInputShareContext(state.fumen.pages, state.fumen.currentIndex, {
                rotationSystem: state.mode.rotationSystem,
                tree: state.tree.enabled && state.tree.rootId !== null
                    ? { nodes: state.tree.nodes, rootId: state.tree.rootId, version: 2 } : undefined,
                seed: 1,
            });
            return InputWindowModal({
                actions,
                currentQueueState,
                canClearComment,
                tab: state.temporary.inputWindowTab,
                description: context === undefined ? undefined : describeInputState(context),
                preset: resolveInputRulesPreset(state.mode.rotationSystem),
                rotationSystem: state.mode.rotationSystem,
                garbageSegments: state.temporary.inputGarbageSegments,
                pieceQueueFocus: state.temporary.pieceQueueFocus,
            });
        })() : undefined as any,

        state.modal.coldClearMenu ? ColdClearMenuModal({
            canSequenceSearch,
            canTopBranchesSearch,
            canPlacedSpawnScore,
            searchBlockedByHoldQueue,
            canClearComment,
            actions,
            currentQueueState,
            engine: resolveAiEngine(state.coldClear.engine),
            engineSwitchable: availableAiEngines().length > 1,
            soldSlearBudget: state.coldClear.soldSlearBudget,
            rotationSystemMismatch: aiEngineRotationMismatch(
                resolveAiEngine(state.coldClear.engine), state.mode.rotationSystem,
            ),
            isRunning: state.coldClear.isRunning,
            progress: state.coldClear.progress,
            topBranchCount: state.coldClear.topBranchCount,
            holdAllowed: state.coldClear.holdAllowed,
            speculate: state.coldClear.speculate,
            nextLimit: state.coldClear.nextLimit,
            weightsPreset: state.coldClear.weightsPreset,
            thinkMs: state.coldClear.thinkMs,
            setupNeeds: resolveColdClearSearchSetupNeeds(state),
        }) : undefined as any,

        div({ key: 'view-end' }),
    ]);
};

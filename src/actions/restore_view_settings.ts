import { ViewSettings } from '../memento';
import { State } from '../states';

interface ViewSettingsRestorationActions {
    setListViewTrimTopBlank: (data: { enabled: boolean; persist: false }) => void;
    setListViewShortenUrls: (data: { enabled: boolean; persist: false }) => void;
    setExportShowPageNumbers: (data: { enabled: boolean; persist: false }) => void;
    setExportShowComments: (data: { enabled: boolean; persist: false }) => void;
    setListViewMenuTab: (data: { tab: 'export' | 'import'; persist: false }) => void;
    setEditorSidePanelEnabled: (data: { enabled: boolean; persist: false }) => void;
    setEditorSidePanelTab: (data: { tab: ViewSettings['editorSidePanelTab']; persist: false }) => void;
    setEditorSidePanelWidth: (data: { width: number | null; persist: false }) => void;
    changePieceLayout: (data: { layout: ViewSettings['pieceLayout']; persist: false }) => void;
    setColdClearTopBranchCount: (data: { count: number; persist: false }) => void;
    setColdClearHoldAllowed: (data: { holdAllowed: boolean; persist: false }) => void;
    setColdClearSpeculate: (data: { speculate: boolean; persist: false }) => void;
    setColdClearNextLimit: (data: { nextLimit: number | null; persist: false }) => void;
    setColdClearWeightsPreset: (data: { weightsPreset: number; persist: false }) => void;
    setColdClearThinkMs: (data: { thinkMs: number; persist: false }) => void;
    setInputAiGuideEnabled: (data: { enabled: boolean; persist: false }) => void;
    setReplayShowOpponent: (data: { showOpponent: boolean; persist: false }) => void;
    setReplayAnalysisThinkMs: (data: { thinkMs: number; persist: false }) => void;
    setTreeState: (data: Partial<State['tree']>) => void;
}

export const restoreViewSettings = (
    actions: ViewSettingsRestorationActions,
    settings: Partial<ViewSettings>,
): void => {
    if (settings.trimTopBlank !== undefined) {
        actions.setListViewTrimTopBlank({ enabled: settings.trimTopBlank, persist: false });
    }
    if (settings.shortenUrls !== undefined) {
        actions.setListViewShortenUrls({ enabled: settings.shortenUrls, persist: false });
    }
    if (settings.exportShowPageNumbers !== undefined) {
        actions.setExportShowPageNumbers({ enabled: settings.exportShowPageNumbers, persist: false });
    }
    if (settings.exportShowComments !== undefined) {
        actions.setExportShowComments({ enabled: settings.exportShowComments, persist: false });
    }
    if (settings.listViewMenuTab !== undefined) {
        actions.setListViewMenuTab({ tab: settings.listViewMenuTab, persist: false });
    }
    if (settings.editorSidePanel !== undefined) {
        actions.setEditorSidePanelEnabled({ enabled: settings.editorSidePanel, persist: false });
    }
    if (settings.editorSidePanelTab !== undefined) {
        actions.setEditorSidePanelTab({ tab: settings.editorSidePanelTab, persist: false });
    }
    if (settings.editorSidePanelWidth !== undefined) {
        actions.setEditorSidePanelWidth({ width: settings.editorSidePanelWidth, persist: false });
    }
    if (settings.pieceLayout !== undefined) {
        actions.changePieceLayout({ layout: settings.pieceLayout, persist: false });
    }
    if (settings.coldClearTopBranchCount !== undefined) {
        actions.setColdClearTopBranchCount({ count: settings.coldClearTopBranchCount, persist: false });
    }
    if (settings.coldClearHoldAllowed !== undefined) {
        actions.setColdClearHoldAllowed({ holdAllowed: settings.coldClearHoldAllowed, persist: false });
    }
    if (settings.coldClearSpeculate !== undefined) {
        actions.setColdClearSpeculate({ speculate: settings.coldClearSpeculate, persist: false });
    }
    if (settings.coldClearNextLimit !== undefined) {
        actions.setColdClearNextLimit({ nextLimit: settings.coldClearNextLimit, persist: false });
    }
    if (settings.coldClearWeightsPreset !== undefined) {
        actions.setColdClearWeightsPreset({ weightsPreset: settings.coldClearWeightsPreset, persist: false });
    }
    if (settings.coldClearThinkMs !== undefined) {
        actions.setColdClearThinkMs({ thinkMs: settings.coldClearThinkMs, persist: false });
    }
    if (settings.coldClearInputGuideEnabled !== undefined) {
        actions.setInputAiGuideEnabled({ enabled: settings.coldClearInputGuideEnabled, persist: false });
    }
    if (settings.replayShowOpponent !== undefined) {
        actions.setReplayShowOpponent({ showOpponent: settings.replayShowOpponent, persist: false });
    }
    if (settings.replayAnalysisThinkMs !== undefined) {
        actions.setReplayAnalysisThinkMs({ thinkMs: settings.replayAnalysisThinkMs, persist: false });
    }

    const tree: Partial<State['tree']> = {};
    if (settings.treeOperationScope !== undefined) {
        tree.operationScope = settings.treeOperationScope;
    }
    if (settings.grayAfterLineClear !== undefined) {
        tree.grayAfterLineClear = settings.grayAfterLineClear;
    }
    if (Object.keys(tree).length > 0) {
        actions.setTreeState(tree);
    }
};

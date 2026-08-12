import { restoreViewSettings } from '../restore_view_settings';

const createActions = () => ({
    setListViewTrimTopBlank: jest.fn(),
    setListViewShortenUrls: jest.fn(),
    setExportShowPageNumbers: jest.fn(),
    setExportShowComments: jest.fn(),
    setListViewMenuTab: jest.fn(),
    setEditorSidePanelEnabled: jest.fn(),
    setEditorSidePanelTab: jest.fn(),
    setEditorSidePanelWidth: jest.fn(),
    changePieceLayout: jest.fn(),
    setColdClearTopBranchCount: jest.fn(),
    setColdClearHoldAllowed: jest.fn(),
    setColdClearSpeculate: jest.fn(),
    setColdClearNextLimit: jest.fn(),
    setColdClearWeightsPreset: jest.fn(),
    setColdClearThinkMs: jest.fn(),
    setInputAiGuideEnabled: jest.fn(),
    setReplayShowOpponent: jest.fn(),
    setReplayAnalysisThinkMs: jest.fn(),
    setTreeState: jest.fn(),
});

describe('restoreViewSettings', () => {
    test('restores every setting without writing it back during startup', () => {
        const actions = createActions();

        restoreViewSettings(actions, {
            trimTopBlank: true,
            shortenUrls: true,
            exportShowPageNumbers: false,
            exportShowComments: false,
            listViewMenuTab: 'import',
            treeOperationScope: 'descendants',
            grayAfterLineClear: true,
            editorSidePanel: true,
            editorSidePanelTab: 'tree',
            editorSidePanelWidth: 320,
            pieceLayout: 'play',
            coldClearTopBranchCount: 7,
            coldClearHoldAllowed: false,
            coldClearSpeculate: false,
            coldClearNextLimit: 3,
            coldClearWeightsPreset: 1,
            coldClearThinkMs: 500,
            coldClearInputGuideEnabled: true,
            replayShowOpponent: false,
            replayAnalysisThinkMs: 200,
        });

        expect(actions.setListViewTrimTopBlank).toHaveBeenCalledWith({ enabled: true, persist: false });
        expect(actions.setListViewShortenUrls).toHaveBeenCalledWith({ enabled: true, persist: false });
        expect(actions.setExportShowPageNumbers).toHaveBeenCalledWith({ enabled: false, persist: false });
        expect(actions.setExportShowComments).toHaveBeenCalledWith({ enabled: false, persist: false });
        expect(actions.setListViewMenuTab).toHaveBeenCalledWith({ tab: 'import', persist: false });
        expect(actions.setEditorSidePanelEnabled).toHaveBeenCalledWith({ enabled: true, persist: false });
        expect(actions.setEditorSidePanelTab).toHaveBeenCalledWith({ tab: 'tree', persist: false });
        expect(actions.setEditorSidePanelWidth).toHaveBeenCalledWith({ width: 320, persist: false });
        expect(actions.changePieceLayout).toHaveBeenCalledWith({ layout: 'play', persist: false });
        expect(actions.setColdClearTopBranchCount).toHaveBeenCalledWith({ count: 7, persist: false });
        expect(actions.setColdClearHoldAllowed).toHaveBeenCalledWith({ holdAllowed: false, persist: false });
        expect(actions.setColdClearSpeculate).toHaveBeenCalledWith({ speculate: false, persist: false });
        expect(actions.setColdClearNextLimit).toHaveBeenCalledWith({ nextLimit: 3, persist: false });
        expect(actions.setColdClearWeightsPreset).toHaveBeenCalledWith({ weightsPreset: 1, persist: false });
        expect(actions.setColdClearThinkMs).toHaveBeenCalledWith({ thinkMs: 500, persist: false });
        expect(actions.setInputAiGuideEnabled).toHaveBeenCalledWith({ enabled: true, persist: false });
        expect(actions.setReplayShowOpponent).toHaveBeenCalledWith({ showOpponent: false, persist: false });
        expect(actions.setReplayAnalysisThinkMs).toHaveBeenCalledWith({ thinkMs: 200, persist: false });
        expect(actions.setTreeState).toHaveBeenCalledWith({
            operationScope: 'descendants',
            grayAfterLineClear: true,
        });
    });

    test('does not dispatch actions for missing settings', () => {
        const actions = createActions();

        restoreViewSettings(actions, {});

        Object.values(actions).forEach(action => expect(action).not.toHaveBeenCalled());
    });
});

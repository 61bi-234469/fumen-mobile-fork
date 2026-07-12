import { EditorSidePanelTab, State } from '../states';
import { localStorageWrapper } from '../memento';
import { TreeOperationScope } from '../lib/fumen/tree_types';

type ViewSettingsOverrides = Partial<{
    trimTopBlank: boolean;
    shortenUrls: boolean;
    treeOperationScope: TreeOperationScope;
    grayAfterLineClear: boolean;
    editorSidePanel: boolean;
    editorSidePanelTab: EditorSidePanelTab;
    editorSidePanelWidth: number | null;
    coldClearTopBranchCount: number;
    coldClearHoldAllowed: boolean;
    coldClearSpeculate: boolean;
    coldClearNextLimit: number | null;
    coldClearWeightsPreset: number;
    coldClearThinkMs: number;
    blackTransparentPaste: boolean;
    rectFloatingMenuPosition: { x: number, y: number } | null;
    rectFloatingMenuScale: number;
}>;

export const persistViewSettings = (state: Readonly<State>, overrides: ViewSettingsOverrides = {}) => {
    if (typeof localStorage === 'undefined') return;
    localStorageWrapper.saveViewSettings({
        trimTopBlank: overrides.trimTopBlank ?? state.listView.trimTopBlank,
        shortenUrls: overrides.shortenUrls ?? state.listView.shortenUrls,
        treeOperationScope: overrides.treeOperationScope ?? state.tree.operationScope ?? 'node',
        grayAfterLineClear: overrides.grayAfterLineClear ?? state.tree.grayAfterLineClear,
        editorSidePanel: overrides.editorSidePanel ?? state.editorPanel.enabled,
        editorSidePanelTab: overrides.editorSidePanelTab ?? state.editorPanel.tab,
        editorSidePanelWidth: overrides.editorSidePanelWidth !== undefined
            ? overrides.editorSidePanelWidth : state.editorPanel.width,
        coldClearTopBranchCount: overrides.coldClearTopBranchCount ?? state.coldClear.topBranchCount,
        coldClearHoldAllowed: overrides.coldClearHoldAllowed ?? state.coldClear.holdAllowed,
        coldClearSpeculate: overrides.coldClearSpeculate ?? state.coldClear.speculate,
        coldClearNextLimit: overrides.coldClearNextLimit !== undefined
            ? overrides.coldClearNextLimit : state.coldClear.nextLimit,
        coldClearWeightsPreset: overrides.coldClearWeightsPreset ?? state.coldClear.weightsPreset,
        coldClearThinkMs: overrides.coldClearThinkMs ?? state.coldClear.thinkMs,
        blackTransparentPaste: overrides.blackTransparentPaste ?? state.mode.blackTransparentPaste ?? false,
        rectFloatingMenuPosition: overrides.rectFloatingMenuPosition !== undefined
            ? overrides.rectFloatingMenuPosition : state.floatingMenu?.position ?? null,
        rectFloatingMenuScale: overrides.rectFloatingMenuScale ?? state.floatingMenu?.scale ?? 1,
    });
};

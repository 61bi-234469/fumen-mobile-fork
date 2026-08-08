import { EditorSidePanelTab, PieceLayoutMode, State } from '../states';
import { localStorageWrapper } from '../memento';
import { TreeOperationScope } from '../lib/fumen/tree_types';

type ViewSettingsOverrides = Partial<{
    trimTopBlank: boolean;
    shortenUrls: boolean;
    listViewMenuTab: 'export' | 'import';
    treeOperationScope: TreeOperationScope;
    grayAfterLineClear: boolean;
    editorSidePanel: boolean;
    editorSidePanelTab: EditorSidePanelTab;
    editorSidePanelWidth: number | null;
    pieceLayout: PieceLayoutMode;
    coldClearTopBranchCount: number;
    coldClearHoldAllowed: boolean;
    coldClearSpeculate: boolean;
    coldClearNextLimit: number | null;
    coldClearWeightsPreset: number;
    coldClearThinkMs: number;
    replaySelfPlayer: string | null;
    replayShowOpponent: boolean;
    replayShowGarbage: boolean;
}>;

// 自陣プレイヤー名は state に持たないため、全体置換の saveViewSettings で
// 消さないように保存済みの値を読み戻す。
export const loadPersistedReplaySelfPlayer = (): string | null => {
    if (typeof localStorage === 'undefined') return null;
    try {
        return localStorageWrapper.loadViewSettings().replaySelfPlayer ?? null;
    } catch {
        return null;
    }
};

// 相手盤面の表示可否（FR-34）。Replay 以外からの保存で消さないよう、同じく読み戻す。
// states.ts の DEFAULT_REPLAY_SHOW_OPPONENT と同値。states.ts は env.ts のビルド時置換に
// 依存するため、ここから値として import はしない。
const REPLAY_SHOW_OPPONENT_FALLBACK = true;

const loadPersistedReplayShowOpponent = (): boolean => {
    if (typeof localStorage === 'undefined') return REPLAY_SHOW_OPPONENT_FALLBACK;
    try {
        return localStorageWrapper.loadViewSettings().replayShowOpponent ?? REPLAY_SHOW_OPPONENT_FALLBACK;
    } catch {
        return REPLAY_SHOW_OPPONENT_FALLBACK;
    }
};

// ガベージ表示の可否（NFR-08）。states.ts の DEFAULT_REPLAY_SHOW_GARBAGE と同値。
const REPLAY_SHOW_GARBAGE_FALLBACK = true;

const loadPersistedReplayShowGarbage = (): boolean => {
    if (typeof localStorage === 'undefined') return REPLAY_SHOW_GARBAGE_FALLBACK;
    try {
        return localStorageWrapper.loadViewSettings().replayShowGarbage ?? REPLAY_SHOW_GARBAGE_FALLBACK;
    } catch {
        return REPLAY_SHOW_GARBAGE_FALLBACK;
    }
};

export const persistViewSettings = (state: Readonly<State>, overrides: ViewSettingsOverrides = {}) => {
    if (typeof localStorage === 'undefined') return;
    localStorageWrapper.saveViewSettings({
        trimTopBlank: overrides.trimTopBlank ?? state.listView.trimTopBlank,
        shortenUrls: overrides.shortenUrls ?? state.listView.shortenUrls,
        listViewMenuTab: overrides.listViewMenuTab ?? state.listView.menuTab,
        treeOperationScope: overrides.treeOperationScope ?? state.tree.operationScope ?? 'node',
        grayAfterLineClear: overrides.grayAfterLineClear ?? state.tree.grayAfterLineClear,
        editorSidePanel: overrides.editorSidePanel ?? state.editorPanel.enabled,
        editorSidePanelTab: overrides.editorSidePanelTab ?? state.editorPanel.tab,
        editorSidePanelWidth: overrides.editorSidePanelWidth !== undefined
            ? overrides.editorSidePanelWidth : state.editorPanel.width,
        pieceLayout: overrides.pieceLayout ?? state.editorUi.pieceLayout,
        coldClearTopBranchCount: overrides.coldClearTopBranchCount ?? state.coldClear.topBranchCount,
        coldClearHoldAllowed: overrides.coldClearHoldAllowed ?? state.coldClear.holdAllowed,
        coldClearSpeculate: overrides.coldClearSpeculate ?? state.coldClear.speculate,
        coldClearNextLimit: overrides.coldClearNextLimit !== undefined
            ? overrides.coldClearNextLimit : state.coldClear.nextLimit,
        coldClearWeightsPreset: overrides.coldClearWeightsPreset ?? state.coldClear.weightsPreset,
        coldClearThinkMs: overrides.coldClearThinkMs ?? state.coldClear.thinkMs,
        // 自陣プレイヤー名の記憶（FR-13）。ユーザ名で保存し、次回取り込み時に一致すれば復元する。
        replaySelfPlayer: overrides.replaySelfPlayer !== undefined
            ? overrides.replaySelfPlayer
            : loadPersistedReplaySelfPlayer(),
        // 相手盤面の表示可否（FR-34）
        replayShowOpponent: overrides.replayShowOpponent ?? loadPersistedReplayShowOpponent(),
        // ガベージ表示の可否（NFR-08）
        replayShowGarbage: overrides.replayShowGarbage ?? loadPersistedReplayShowGarbage(),
    });
};

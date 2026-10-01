import { EditorSidePanelTab, PieceLayoutMode, State } from '../states';
import { localStorageWrapper } from '../memento';
import { TreeOperationScope } from '../lib/fumen/tree_types';
import { AI_ENGINE_DEFAULT, AiEngineId, isAiEngineId, isSoldSlearAvailable } from '../lib/ai_engine';
import { SoldSlearBudgetId } from '../lib/sold_slear/budget';

type ViewSettingsOverrides = Partial<{
    trimTopBlank: boolean;
    shortenUrls: boolean;
    exportShowPageNumbers: boolean;
    exportShowComments: boolean;
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
    coldClearInputGuideEnabled: boolean;
    aiEngine: AiEngineId;
    soldSlearBudget: SoldSlearBudgetId;
    replaySelfPlayer: string | null;
    replayShowOpponent: boolean;
    replayAnalysisThinkMs: number;
    replaySoldSlearBudget: SoldSlearBudgetId;
}>;

// サイトデータをブロックしたブラウザでは localStorage の getter 自体が例外になるため、
// typeof による存在確認も例外を握る。
const isStorageAvailable = (): boolean => {
    try {
        return typeof localStorage !== 'undefined';
    } catch {
        return false;
    }
};

// 自陣プレイヤー名は state に持たないため、全体置換の saveViewSettings で
// 消さないように保存済みの値を読み戻す。
export const loadPersistedReplaySelfPlayer = (): string | null => {
    if (!isStorageAvailable()) return null;
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
    if (!isStorageAvailable()) return REPLAY_SHOW_OPPONENT_FALLBACK;
    try {
        return localStorageWrapper.loadViewSettings().replayShowOpponent ?? REPLAY_SHOW_OPPONENT_FALLBACK;
    } catch {
        return REPLAY_SHOW_OPPONENT_FALLBACK;
    }
};

// AI 解析の思考時間。他画面からの保存で消さないよう、他の replay 設定と同じく読み戻す。
// states.ts の DEFAULT_REPLAY_ANALYSIS_THINK_MS と同値。
const REPLAY_ANALYSIS_THINK_MS_FALLBACK = 100;

const loadPersistedReplayAnalysisThinkMs = (): number => {
    if (!isStorageAvailable()) return REPLAY_ANALYSIS_THINK_MS_FALLBACK;
    try {
        return localStorageWrapper.loadViewSettings().replayAnalysisThinkMs
            ?? REPLAY_ANALYSIS_THINK_MS_FALLBACK;
    } catch {
        return REPLAY_ANALYSIS_THINK_MS_FALLBACK;
    }
};

// リプレイ解析の Sold Slear 予算。replayAnalysisThinkMs と同じく他画面からの保存で消さない。
const loadPersistedReplaySoldSlearBudget = (): string => {
    if (!isStorageAvailable()) return 'standard';
    try {
        return localStorageWrapper.loadViewSettings().replaySoldSlearBudget ?? 'standard';
    } catch {
        return 'standard';
    }
};

// 本番とプレビューは同じ origin の localStorage を共有する。Sold Slear を持たないビルドが
// 保存し直してもプレビューでの選択を消さないよう、使えないビルドでは保存済みの値を書き戻す。
const persistedAiEngine = (state: Readonly<State>): string => {
    const current = state.coldClear.engine ?? AI_ENGINE_DEFAULT;
    if (isSoldSlearAvailable() || !isStorageAvailable()) {
        return current;
    }
    try {
        const saved = localStorageWrapper.loadViewSettings().aiEngine;
        return isAiEngineId(saved) ? saved : current;
    } catch {
        return current;
    }
};

export const persistViewSettings = (state: Readonly<State>, overrides: ViewSettingsOverrides = {}) => {
    if (!isStorageAvailable()) return;
    localStorageWrapper.saveViewSettings({
        trimTopBlank: overrides.trimTopBlank ?? state.listView.trimTopBlank,
        shortenUrls: overrides.shortenUrls ?? state.listView.shortenUrls,
        exportShowPageNumbers: overrides.exportShowPageNumbers ?? state.listView.exportShowPageNumbers ?? true,
        exportShowComments: overrides.exportShowComments ?? state.listView.exportShowComments ?? true,
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
        coldClearInputGuideEnabled: overrides.coldClearInputGuideEnabled
            ?? state.coldClear.inputGuide?.enabled ?? false,
        aiEngine: overrides.aiEngine ?? persistedAiEngine(state),
        soldSlearBudget: overrides.soldSlearBudget ?? state.coldClear.soldSlearBudget ?? 'standard',
        // 自陣プレイヤー名の記憶（FR-13）。ユーザ名で保存し、次回取り込み時に一致すれば復元する。
        replaySelfPlayer: overrides.replaySelfPlayer !== undefined
            ? overrides.replaySelfPlayer
            : loadPersistedReplaySelfPlayer(),
        // 相手盤面の表示可否（FR-34）
        replayShowOpponent: overrides.replayShowOpponent ?? loadPersistedReplayShowOpponent(),
        // AI 解析の思考時間。解析結果そのものは永続化しない
        replayAnalysisThinkMs: overrides.replayAnalysisThinkMs ?? loadPersistedReplayAnalysisThinkMs(),
        replaySoldSlearBudget: overrides.replaySoldSlearBudget ?? loadPersistedReplaySoldSlearBudget(),
    });
};

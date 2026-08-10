// Cold Clear の局面探索とリプレイ解析で共通の探索時間プリセット。
// リプレイ解析は手数ぶん累積するため、既定値だけは別にする。
export const COLD_CLEAR_THINK_MS_PRESETS = [100, 200, 500, 1000, 2000];

export const COLD_CLEAR_THINK_MS_DEFAULT = 1000;
export const REPLAY_ANALYSIS_THINK_MS_DEFAULT = 100;

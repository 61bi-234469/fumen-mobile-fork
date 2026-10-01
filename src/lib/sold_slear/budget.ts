// Sold Slear の探索予算。標準は champion と同じ 512 selections（決定的）。
// 時間予算は WASM に時計が無いため Worker 側で打ち切り、selections は上限として残す
// （s2-bot-lab champion-parameters.mjs の createChampionProfile と同じ形）。

export type SoldSlearBudget =
    | { mode: 'selection'; selections: number }
    | { mode: 'time'; maxMillis: number; selections: number };

export type SoldSlearBudgetId = 'standard' | 't100' | 't200' | 't500' | 't1000' | 't2000';

export const SOLD_SLEAR_BUDGET_IDS: SoldSlearBudgetId[] = ['standard', 't100', 't200', 't500', 't1000', 't2000'];
export const SOLD_SLEAR_BUDGET_DEFAULT: SoldSlearBudgetId = 'standard';

export const SOLD_SLEAR_STANDARD_SELECTIONS = 512;
export const SOLD_SLEAR_SELECTION_CAP = 1_000_000;
export const SOLD_SLEAR_TIME_MIN_MS = 10;
export const SOLD_SLEAR_TIME_MAX_MS = 10_000;

export const isSoldSlearBudgetId = (value: unknown): value is SoldSlearBudgetId => (
    typeof value === 'string' && (SOLD_SLEAR_BUDGET_IDS as string[]).includes(value)
);

export const normalizeSoldSlearBudgetId = (value: unknown): SoldSlearBudgetId => (
    isSoldSlearBudgetId(value) ? value : SOLD_SLEAR_BUDGET_DEFAULT
);

export const budgetMillisOf = (id: SoldSlearBudgetId): number | null => (
    id === 'standard' ? null : Number(id.slice(1))
);

export const soldSlearBudgetOf = (id: SoldSlearBudgetId): SoldSlearBudget => {
    const millis = budgetMillisOf(id);
    if (millis === null) {
        return { mode: 'selection', selections: SOLD_SLEAR_STANDARD_SELECTIONS };
    }
    const maxMillis = Math.max(SOLD_SLEAR_TIME_MIN_MS, Math.min(SOLD_SLEAR_TIME_MAX_MS, millis));
    return { maxMillis, mode: 'time', selections: SOLD_SLEAR_SELECTION_CAP };
};

// 進捗表示・所要時間見積もり用の 1 手あたりの目安（標準は Node 実測の約 30ms を丸めた値）。
export const estimatedMillisPerMove = (id: SoldSlearBudgetId): number => budgetMillisOf(id) ?? 50;

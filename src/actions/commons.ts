import { State } from '../states';
import { action } from '../actions';

export type NextState = Partial<State> | undefined;

// ページ表示タップで開くサムネイルスライダーを閉じる。モーダル・画面切替・読み込みなど、
// 下に隠れたまま残ると困る経路から使う
export const closePageStripState = (state: Readonly<State>): NextState => (
    state.pageStrip?.open ? { pageStrip: { ...state.pageStrip, open: false } } : undefined
);

export function sequence(
    state: Readonly<State>,
    actions: (action | undefined)[],
): Partial<Readonly<State>> {
    let currentState = state;
    let merged: Partial<Readonly<State>> = {};
    for (const action of actions) {
        if (action === undefined) {
            continue;
        }

        const partial = action(currentState);
        merged = {
            ...merged,
            ...partial,
        };
        currentState = {
            ...state,
            ...merged,
        };
    }
    return merged;
}

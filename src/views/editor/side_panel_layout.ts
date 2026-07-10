import { Platforms, Screens } from '../../lib/enums';
import { State } from '../../states';

// 表示条件: 設定ON && PC && Editor画面 && 画面幅が閾値以上
export const SIDE_PANEL_MIN_DISPLAY_WIDTH = 1024;

export const SIDE_PANEL_MIN_WIDTH = 280;
export const SIDE_PANEL_MAX_WIDTH = 400;
export const SIDE_PANEL_WIDTH_RATIO = 0.22;

export const SIDE_PANEL_TAB_BAR_HEIGHT = 40;

// パネル非表示のとき 0 を返す。エディタのレイアウトと画像保存の双方がこの値を使う。
export const getSidePanelWidth = (state: Readonly<State>): number => {
    if (!state.editorPanel.enabled
        || state.platform !== Platforms.PC
        || state.mode.screen !== Screens.Editor
        || state.display.width < SIDE_PANEL_MIN_DISPLAY_WIDTH
    ) {
        return 0;
    }

    const preferred = state.display.width * SIDE_PANEL_WIDTH_RATIO;
    return Math.round(Math.min(SIDE_PANEL_MAX_WIDTH, Math.max(SIDE_PANEL_MIN_WIDTH, preferred)));
};

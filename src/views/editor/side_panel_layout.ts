import { Platforms, Screens } from '../../lib/enums';
import { State } from '../../states';
import { getNavigatorHeight } from '../commons';
import { getEditorBottomMetrics, getEditorRailConfig } from './responsive_layout';

// 表示条件: 設定ON && PC && Editor画面 && 画面幅が閾値以上
export const SIDE_PANEL_MIN_DISPLAY_WIDTH = 1024;

export const SIDE_PANEL_MIN_WIDTH = 280;

export const SIDE_PANEL_TAB_BAR_HEIGHT = 40;

// editor.ts の getLayout と対応する定数（blockSize の高さ/幅制約の式に合わせる）
const FIELD_BOTTOM_BORDER = 2.4;
const BOARD_AREA_SLACK = 30;

// パネル表示中は盤面とレールをパネル側に寄せる。そのときのパネル右端からの間隔。
export const EDITOR_CONTENT_START_GAP = 16;
// UTILS/FLAGS の窓とレールの間隔、窓の外側の余白（editor_overlay の配置と共通）
export const EDITOR_OVERLAY_GAP = 16;
export const EDITOR_OVERLAY_EDGE_PADDING = 8;

export const getEditorOverlayPanelWidth = (fieldWidth: number): number => (
    Math.min(220, Math.max(150, fieldWidth * .8))
);

// ピン留めした UTILS は開いている間、盤面の右に常設の列として場所を取る
export const isUtilsColumnReserved = (state: Readonly<State>): boolean => (
    state.mode.utilsMenuPinned && state.editorUi.inspector === 'utils'
);

// 盤面エリアが必要とする canvas 幅。blockSize は高さ制約
// (canvasHeight - border - 2) / 24 で決まるため、幅制約 (canvasWidth - 90) / 10.5 が
// それを下回らない最小幅 + 余白を確保すれば、残りの横幅は盤面に使われない。
const getRequiredCanvasWidth = (displayHeight: number, topLeftY: number, utilsColumn: boolean): number => {
    const { commentHeight, toolsHeight } = getEditorBottomMetrics(displayHeight);
    const canvasHeight = displayHeight - (toolsHeight + commentHeight + topLeftY);
    const rail = getEditorRailConfig(canvasHeight);
    const unit = (canvasHeight - FIELD_BOTTOM_BORDER - 2) / 24;
    const utilsColumnWidth = utilsColumn
        ? getEditorOverlayPanelWidth(unit * 10 + 1) + EDITOR_OVERLAY_GAP + EDITOR_OVERLAY_EDGE_PADDING
        : 0;
    return unit * 10.5 + rail.reserve + BOARD_AREA_SLACK + utilsColumnWidth;
};

export const getSidePanelWidthBounds = (state: Readonly<State>) => {
    const topLeftY = getNavigatorHeight(state.platform);
    const availableWidth = state.display.width
        - getRequiredCanvasWidth(state.display.height, topLeftY, isUtilsColumnReserved(state));
    return {
        min: SIDE_PANEL_MIN_WIDTH,
        max: Math.max(SIDE_PANEL_MIN_WIDTH, Math.round(availableWidth)),
    };
};

// パネルを出せる環境か。画面ごとの条件（Editor画面）は含まない。ユーザー設定の項目表示にも使う。
export const canShowSidePanel = (state: Readonly<State>): boolean => (
    state.platform === Platforms.PC && state.display.width >= SIDE_PANEL_MIN_DISPLAY_WIDTH
);

// パネル非表示のとき 0 を返す。エディタのレイアウトと画像保存の双方がこの値を使う。
// 盤面サイズは高さで決まるため、盤面に不要な横幅はすべてパネルに割り当てる。
export const getSidePanelWidth = (state: Readonly<State>): number => {
    if (!state.editorPanel.enabled
        || state.mode.screen !== Screens.Editor
        || !canShowSidePanel(state)
    ) {
        return 0;
    }

    const bounds = getSidePanelWidthBounds(state);
    if (state.editorPanel.width === null || state.editorPanel.width === undefined) {
        return bounds.max;
    }
    return Math.max(bounds.min, Math.min(bounds.max, Math.round(state.editorPanel.width)));
};

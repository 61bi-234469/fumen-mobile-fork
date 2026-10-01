// 下部トレイで、どのボタンにラベルを出すかを幅から決める。
// 外寸は枠線・余白・アイコン・間隔・ラベル幅の合計で、ボタンは border-box で描く。

export const TRAY_LABEL_FONT_SIZE = 10;
export const TRAY_LABEL_FONT_WEIGHT = 400;
export const TRAY_ICON_SIZE = 18;
export const TRAY_ICON_GAP = 3;
export const TRAY_BUTTON_PADDING_X = 4;
export const TRAY_BUTTON_BORDER_WIDTH = 1;
export const TRAY_ICON_ONLY_WIDTH = 36;
// 測定値と描画のずれで「…」にならないよう、ラベル幅に足す余裕
const LABEL_SAFETY_WIDTH = 1;

export interface TrayLabelItem {
    label: string;
    active: boolean;
    // 状態によって意味が変わるボタン。入る限りラベルを出す
    preferLabel: boolean;
}

// 1: 全部 2: 選択中＋優先 3: 優先だけ 4: 選択中だけ 5: 全部アイコン 6: 全部アイコンで横スクロール
export type TrayLabelCandidate = 1 | 2 | 3 | 4 | 5 | 6;

export interface TrayLabelLayout {
    candidate: TrayLabelCandidate;
    labeled: boolean[];
    widths: number[];
    scroll: boolean;
}

type MeasureLabel = (text: string, fontSizePx: number, fontWeight: number) => number;

export const getTrayLabeledButtonWidth = (label: string, measure: MeasureLabel): number => (
    TRAY_BUTTON_BORDER_WIDTH + TRAY_BUTTON_PADDING_X * 2 + TRAY_ICON_SIZE + TRAY_ICON_GAP
    + Math.ceil(measure(label, TRAY_LABEL_FONT_SIZE, TRAY_LABEL_FONT_WEIGHT)) + LABEL_SAFETY_WIDTH
);

const sameSet = (left: boolean[], right: boolean[]) => left.every((value, index) => value === right[index]);

export const decideTrayLabels = (
    items: TrayLabelItem[],
    availableWidth: number,
    measure: MeasureLabel,
): TrayLabelLayout => {
    const labeledWidths = items.map(item => getTrayLabeledButtonWidth(item.label, measure));
    const widthsOf = (labeled: boolean[]) => labeled.map((value, index) => (
        value ? labeledWidths[index] : TRAY_ICON_ONLY_WIDTH
    ));
    const fits = (labeled: boolean[]) => widthsOf(labeled).reduce((sum, width) => sum + width, 0)
        <= availableWidth + 1e-6;

    const all = items.map(() => true);
    const none = items.map(() => false);
    const candidates: [TrayLabelCandidate, boolean[]][] = [
        [1, all],
        [2, items.map(item => item.active || item.preferLabel)],
        [3, items.map(item => item.preferLabel)],
        [4, items.map(item => item.active)],
    ];
    const tried: boolean[][] = [];
    for (const [candidate, labeled] of candidates) {
        // ラベル対象が空の候補や、試した候補と同じ集合は飛ばす（候補番号を表と一致させる）
        const empty = labeled.every(value => !value);
        if ((candidate !== 1 && empty) || tried.some(previous => sameSet(previous, labeled))) {
            continue;
        }
        tried.push(labeled);
        if (fits(labeled)) {
            return { candidate, labeled, widths: widthsOf(labeled), scroll: false };
        }
    }
    if (fits(none)) {
        return { candidate: 5, labeled: none, widths: widthsOf(none), scroll: false };
    }
    return { candidate: 6, labeled: none, widths: widthsOf(none), scroll: true };
};

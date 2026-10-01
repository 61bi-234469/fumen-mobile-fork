import { estimateTextWidth } from '../../../lib/text_measure';
import {
    decideTrayLabels, getTrayLabeledButtonWidth, TRAY_ICON_ONLY_WIDTH, TrayLabelItem,
} from '../tray_label_layout';

// 1文字10pxの見積もり（設計書 §3-6 の表と同じ前提）で測る
const measure = estimateTextWidth;

const paintItems = (active: string, toggle: string, toggleActive = false): TrayLabelItem[] => [
    { label: 'ペン', active: active === 'ペン', preferLabel: false },
    { label: '消しゴム', active: active === '消しゴム', preferLabel: false },
    { label: '塗りつぶし', active: active === '塗りつぶし', preferLabel: false },
    { label: '行を塗る', active: active === '行を塗る', preferLabel: false },
    { label: toggle, active: toggleActive, preferLabel: true },
];

const selectItems = (): TrayLabelItem[] => ['コピー', '切り取り', '左回転', '右回転', '反転']
    .map(label => ({ label, active: false, preferLabel: false }));

describe('tray label layout', () => {
    test('sums border, padding, icon, gap, and label width for a labeled button', () => {
        // 枠線1 + 余白8 + アイコン18 + 間隔3 + 「ペン」20 + 余裕1
        expect(getTrayLabeledButtonWidth('ペン', measure)).toBe(51);
        expect(getTrayLabeledButtonWidth('ブロック化', measure)).toBe(81);
    });

    test('labels every button when the tray is wide enough', () => {
        const layout = decideTrayLabels(paintItems('ペン', 'ブロック化'), 1000, measure);
        expect(layout.candidate).toBe(1);
        expect(layout.labeled).toEqual([true, true, true, true, true]);
        expect(layout.scroll).toBe(false);
    });

    test('labels the active tool and the spawn toggle on a 375px phone', () => {
        const layout = decideTrayLabels(paintItems('ペン', 'ブロック化'), 272.4, measure);
        expect(layout.candidate).toBe(2);
        expect(layout.labeled).toEqual([true, false, false, false, true]);
    });

    test('keeps candidate 2 with the widest active tool on a 375px phone', () => {
        const layout = decideTrayLabels(paintItems('塗りつぶし', 'ブロック化'), 272.4, measure);
        expect(layout.candidate).toBe(2);
        expect(layout.labeled).toEqual([false, false, true, false, true]);
    });

    test('labels only the active tool on a 320px phone when the toggle does not fit', () => {
        const layout = decideTrayLabels(paintItems('ペン', 'ブロック化'), 220, measure);
        expect(layout.candidate).toBe(4);
        expect(layout.labeled).toEqual([true, false, false, false, false]);
    });

    test('uses icons only on a 320px phone when the wide active tool does not fit', () => {
        const layout = decideTrayLabels(paintItems('塗りつぶし', 'ブロック化'), 220, measure);
        expect(layout.candidate).toBe(5);
        expect(layout.labeled.every(value => !value)).toBe(true);
    });

    test('keeps the short toggle label next to the active tool on a 320px phone', () => {
        expect(decideTrayLabels(paintItems('ペン', 'ミノ化'), 220, measure).candidate).toBe(2);
        const picking = decideTrayLabels(paintItems('ペン', 'やめる', true), 220, measure);
        expect(picking.candidate).toBe(2);
        expect(picking.labeled).toEqual([true, false, false, false, true]);
    });

    test('prefers the toggle label over the active tool label', () => {
        // 「選択中＋トグル」は入らないが、トグルだけなら入る幅
        const width = getTrayLabeledButtonWidth('ミノ化', measure) + TRAY_ICON_ONLY_WIDTH * 4;
        const layout = decideTrayLabels(paintItems('塗りつぶし', 'ミノ化'), width, measure);
        expect(layout.candidate).toBe(3);
        expect(layout.labeled).toEqual([false, false, false, false, true]);
    });

    test('skips empty candidates for trays without active or preferred buttons', () => {
        const items = selectItems();
        expect(decideTrayLabels(items, 1000, measure).candidate).toBe(1);
        expect(decideTrayLabels(items, 272.4 - 64, measure).candidate).toBe(5);
        expect(decideTrayLabels(items, 131.7 - 64, measure)).toEqual(expect.objectContaining({
            candidate: 6, scroll: true,
        }));
    });

    test('counts a toggle that is both active and preferred only once', () => {
        const items = paintItems('', 'やめる', true);
        const width = getTrayLabeledButtonWidth('やめる', measure) + TRAY_ICON_ONLY_WIDTH * 4;
        const layout = decideTrayLabels(items, width, measure);
        expect(layout.candidate).toBe(2);
        expect(layout.labeled).toEqual([false, false, false, false, true]);
    });

    test('accepts a candidate exactly at the boundary and rejects one pixel less', () => {
        const items = paintItems('ペン', 'ブロック化');
        const exact = getTrayLabeledButtonWidth('ペン', measure) + getTrayLabeledButtonWidth('ブロック化', measure)
            + TRAY_ICON_ONLY_WIDTH * 3;
        expect(decideTrayLabels(items, exact, measure).candidate).toBe(2);
        expect(decideTrayLabels(items, exact - 1, measure).candidate).not.toBe(2);
    });

    test('returns widths that fill the available space for non-scrolling candidates', () => {
        const layout = decideTrayLabels(paintItems('ペン', 'ブロック化'), 272.4, measure);
        expect(layout.widths.reduce((sum, width) => sum + width, 0)).toBeLessThanOrEqual(272.4);
        expect(layout.widths[1]).toBe(TRAY_ICON_ONLY_WIDTH);
    });

    test('works with English labels', () => {
        const items: TrayLabelItem[] = [
            { label: 'Pen', active: false, preferLabel: false },
            { label: 'Erase', active: false, preferLabel: false },
            { label: 'Fill', active: false, preferLabel: false },
            { label: 'Fill row', active: true, preferLabel: false },
            { label: 'TO PAINT', active: false, preferLabel: true },
        ];
        const layout = decideTrayLabels(items, 272.4, measure);
        expect(layout.candidate).toBe(2);
        expect(layout.labeled).toEqual([false, false, false, true, true]);
    });
});

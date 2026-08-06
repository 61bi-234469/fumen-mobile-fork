import { editorContentWidth, railAnchorOffset } from '../editor_overlay';
import { EditorLayout } from '../editor';

const createLayout = (override: any = {}): EditorLayout => ({
    canvas: { size: { width: 330, height: 800 } },
    field: { size: { width: 330, height: 700 } },
    buttons: { size: { width: 78, height: 700 } },
    pieceQueue: { visible: false, width: 0, gap: 0 },
    ...override,
} as unknown as EditorLayout);

describe('editorContentWidth', () => {
    test('counts the field and the rail with its left margin in the normal layout', () => {
        expect(editorContentWidth(createLayout())).toBe(330 + 8 + 78);
    });

    test('adds the HOLD column and its gaps in the Play layout', () => {
        const layout = createLayout({ pieceQueue: { visible: true, width: 60, gap: 6 } });

        expect(editorContentWidth(layout)).toBe(60 + 6 + 330 + 10 + 78);
    });
});

describe('railAnchorOffset', () => {
    test('places the panel just right of the rail when the window is wide enough', () => {
        // 中央寄せ済みのパネルを (盤面+レールの幅の半分 + パネル半分 + 16px) だけ右へずらす
        expect(railAnchorOffset(createLayout(), 220, 1920)).toBe(416 / 2 + 110 + 16);
    });

    test('retreats to the old spot left of the rail when it cannot fit on the right', () => {
        // 右端寄せ (280 - 110 - 8) から、レール幅 + 4 だけ左へ戻した位置
        expect(railAnchorOffset(createLayout(), 220, 560)).toBe(280 - 110 - 8 - (78 + 4));
    });

    test('never shifts left of centre', () => {
        expect(railAnchorOffset(createLayout(), 220, 200)).toBe(0);
    });

    test('falls back to the plain right-edge layout when there is no rail to anchor to', () => {
        expect(railAnchorOffset(undefined, 220, 1920)).toBeNull();
    });
});

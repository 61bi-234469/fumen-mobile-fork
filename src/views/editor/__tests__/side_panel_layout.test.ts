import { Platforms, Screens } from '../../../lib/enums';
import { getSidePanelWidth } from '../side_panel_layout';

const createState = (override: {
    enabled?: boolean;
    platform?: Platforms;
    screen?: Screens;
    width?: number;
} = {}) => ({
    editorPanel: {
        enabled: override.enabled ?? true,
        tab: 'list',
    },
    platform: override.platform ?? Platforms.PC,
    mode: {
        screen: override.screen ?? Screens.Editor,
    },
    display: {
        width: override.width ?? 1280,
        height: 800,
    },
}) as any;

describe('getSidePanelWidth', () => {
    test('returns 0 when the setting is off', () => {
        expect(getSidePanelWidth(createState({ enabled: false }))).toBe(0);
    });

    test('returns 0 on mobile', () => {
        expect(getSidePanelWidth(createState({ platform: Platforms.Mobile }))).toBe(0);
    });

    test('returns 0 outside the editor screen', () => {
        expect(getSidePanelWidth(createState({ screen: Screens.ListView }))).toBe(0);
        expect(getSidePanelWidth(createState({ screen: Screens.Reader }))).toBe(0);
    });

    test('returns 0 below the display width threshold', () => {
        expect(getSidePanelWidth(createState({ width: 1023 }))).toBe(0);
    });

    test('clamps to the minimum width at the threshold', () => {
        // 1024 * 0.22 = 225.28 -> clamped up to 280
        expect(getSidePanelWidth(createState({ width: 1024 }))).toBe(280);
    });

    test('scales with the display width between the clamp bounds', () => {
        // 1300 * 0.22 = 286
        expect(getSidePanelWidth(createState({ width: 1300 }))).toBe(286);
    });

    test('clamps to the maximum width on wide displays', () => {
        // 2000 * 0.22 = 440 -> clamped down to 400
        expect(getSidePanelWidth(createState({ width: 2000 }))).toBe(400);
    });
});

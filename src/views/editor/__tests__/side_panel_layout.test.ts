import { Platforms, Screens } from '../../../lib/enums';
import { getSidePanelWidth } from '../side_panel_layout';

const createState = (override: {
    enabled?: boolean;
    platform?: Platforms;
    screen?: Screens;
    width?: number;
    panelWidth?: number | null;
} = {}) => ({
    editorPanel: {
        enabled: override.enabled ?? true,
        tab: 'list',
        width: override.panelWidth ?? null,
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

    test('uses otherwise-unused editor width at the display threshold', () => {
        expect(getSidePanelWidth(createState({ width: 1024 }))).toBe(606);
    });

    test('grows by the available editor width', () => {
        expect(getSidePanelWidth(createState({ width: 1300 }))).toBe(882);
    });

    test('keeps all surplus width in the side panel on wide displays', () => {
        expect(getSidePanelWidth(createState({ width: 2000 }))).toBe(1582);
    });

    test('uses a manually selected width within the available bounds', () => {
        expect(getSidePanelWidth(createState({ width: 1300, panelWidth: 500 }))).toBe(500);
    });

    test('clamps a manually selected width to the available editor space', () => {
        expect(getSidePanelWidth(createState({ width: 1300, panelWidth: 1200 }))).toBe(882);
        expect(getSidePanelWidth(createState({ width: 1300, panelWidth: 100 }))).toBe(280);
    });
});

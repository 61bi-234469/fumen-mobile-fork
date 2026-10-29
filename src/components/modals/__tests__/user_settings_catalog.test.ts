import { resolveDatatest, settingsCatalog, tabLayout } from '../user_settings_catalog';
import { UserSettingsTab } from '../../../states';

describe('user settings catalog', () => {
    const tabs = Object.keys(tabLayout) as UserSettingsTab[];

    test('places every catalog setting and only catalog settings', () => {
        const placements = tabs.reduce((result, tab) => result.concat(tabLayout[tab]), [] as string[]);
        expect(placements.every(id => id in settingsCatalog)).toBe(true);
        expect(Object.keys(settingsCatalog).every(id => placements.includes(id as any))).toBe(true);
    });

    test('has no List/Tree tab and places every setting once', () => {
        expect(tabs).toEqual(['edit', 'input', 'keys', 'general']);
        const placements = tabs.reduce((result, tab) => {
            tabLayout[tab].forEach((id) => { result[id] = [...(result[id] || []), tab]; });
            return result;
        }, {} as Record<string, UserSettingsTab[]>);
        expect(placements['gray-after-line-clear']).toEqual(['edit']);
        Object.keys(placements).forEach(id => expect(placements[id]).toHaveLength(1));
    });

    test('uses the bare datatest when a switch is placed once', () => {
        expect(resolveDatatest('ghost-visible', 'input')).toBe('switch-ghost-visible');
        expect(resolveDatatest('gray-after-line-clear', 'edit')).toBe('switch-gray-after-line-clear');
    });

    test('does not offer settings whose only UI is elsewhere', () => {
        expect('seven-bag-gray' in settingsCatalog).toBe(false);
        // List/Tree display settings live in the view settings popover and the navigator toggle
        expect('trim-top-blank' in settingsCatalog).toBe(false);
        expect('editor-side-panel' in settingsCatalog).toBe(false);
    });

    test('keeps the kick table out of the tabs (it is the modal header)', () => {
        expect('rotation-system' in settingsCatalog).toBe(false);
    });

    test('does not include the Import/Export-only GIF delay setting', () => {
        expect('gif-frame-delay' in settingsCatalog).toBe(false);
    });
});

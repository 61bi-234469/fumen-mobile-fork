import { resolveDatatest, settingsCatalog, tabLayout } from '../user_settings_catalog';
import { UserSettingsTab } from '../../../states';

describe('user settings catalog', () => {
    const tabs = Object.keys(tabLayout) as UserSettingsTab[];

    test('places every catalog setting and only catalog settings', () => {
        const placements = tabs.reduce((result, tab) => result.concat(tabLayout[tab]), [] as string[]);
        expect(placements.every(id => id in settingsCatalog)).toBe(true);
        expect(Object.keys(settingsCatalog).every(id => placements.includes(id as any))).toBe(true);
    });

    test('allows only gray-after-line-clear to appear in multiple tabs', () => {
        const placements = tabs.reduce((result, tab) => {
            tabLayout[tab].forEach((id) => { result[id] = [...(result[id] || []), tab]; });
            return result;
        }, {} as Record<string, UserSettingsTab[]>);
        expect(placements['gray-after-line-clear']).toEqual(['edit', 'view']);
        Object.keys(placements).filter(id => id !== 'gray-after-line-clear')
            .forEach(id => expect(placements[id]).toHaveLength(1));
    });

    test('uses a tab suffix only for aliased switch settings', () => {
        expect(resolveDatatest('ghost-visible', 'input')).toBe('switch-ghost-visible');
        expect(resolveDatatest('gray-after-line-clear', 'edit')).toBe('switch-gray-after-line-clear-edit');
        expect(resolveDatatest('gray-after-line-clear', 'view')).toBe('switch-gray-after-line-clear-view');
    });

    test('does not include the Import/Export-only GIF delay setting', () => {
        expect('gif-frame-delay' in settingsCatalog).toBe(false);
    });
});

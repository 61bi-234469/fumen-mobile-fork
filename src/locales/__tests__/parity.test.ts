import { resources as en } from '../en/translation';
import { resources as ja } from '../ja/translation';

const flatten = (value: unknown, prefix = ''): string[] => {
    if (typeof value !== 'object' || value === null) {
        return [prefix];
    }
    return Object.keys(value).reduce<string[]>((keys, key) => {
        const path = prefix === '' ? key : `${prefix}.${key}`;
        return keys.concat(flatten((value as Record<string, unknown>)[key], path));
    }, []);
};

// The legacy menu labels are English in both languages by design; ja falls back to en for them.
// Listed one by one so that a newly added Menu key still needs a Japanese translation.
const LEGACY_MENU_BUTTONS = [
    'List', 'Tree', 'Readonly', 'Writable', 'Clipboard', 'FirstPage', 'LastPage', 'New', 'Open',
    'Help', 'ShowComment', 'ReadonlyComment', 'WritableComment', 'PageSlider', 'Append', 'UserSettings',
    'SavePlayfieldToImage', 'ForceReload',
];
const EN_ONLY = new Set(['Menu.Title', 'Menu.Build', ...LEGACY_MENU_BUTTONS.map(name => `Menu.Buttons.${name}`)]);

describe('locale parity', () => {
    const enKeys = flatten(en);
    const jaKeys = flatten(ja);

    test('every English key has a Japanese translation', () => {
        const missing = enKeys.filter(key => !jaKeys.includes(key) && !EN_ONLY.has(key));
        expect(missing).toEqual([]);
    });

    test('Japanese has no key that English lacks', () => {
        expect(jaKeys.filter(key => !enKeys.includes(key))).toEqual([]);
    });
});

import { UserSettingsTab } from '../../states';
import { i18n } from '../../locales/keys';

export type SettingId =
    | 'delete-spawn-mino-on-paint-drag' | 'paint-palette-mino-design' | 'flags-hidden'
    | 'gradient' | 'gray-after-line-clear' | 'trim-top-blank' | 'editor-side-panel'
    | 'open-tree-screen-on-tree-data' | 'utils-menu-pinned' | 'piece-shortcuts' | 'ghost-visible' | 'rotation-system'
    | 'piece-arr' | 'piece-das' | 'piece-dcd' | 'piece-sdf' | 'piece-softdrop-priority'
    | 'seven-bag-gray' | 'palette-shortcuts' | 'edit-shortcuts' | 'shortcut-label'
    | 'initial-screen' | 'loop' | 'page-rotation-limit';

type SwitchSetting = {
    type: 'switch';
    datatestBase: string;
    title: () => string;
    description?: () => string;
};

type CustomSetting = {
    type: 'custom';
    title?: () => string;
};

export type SettingDefinition = SwitchSetting | CustomSetting;

export const settingsCatalog: Record<SettingId, SettingDefinition> = {
    'delete-spawn-mino-on-paint-drag': {
        type: 'switch', datatestBase: 'switch-delete-spawn-mino-on-paint-drag',
        title: i18n.UserSettings.DeleteSpawnMinoOnPaintDrag.Title,
    },
    'paint-palette-mino-design': {
        type: 'switch', datatestBase: 'switch-paint-palette-mino-design',
        title: i18n.UserSettings.PaintPaletteMinoDesign.Title,
    },
    'flags-hidden': {
        type: 'switch', datatestBase: 'switch-flags-hidden', title: i18n.UserSettings.ShowFlags.Title,
    },
    gradient: { type: 'custom', title: i18n.UserSettings.Gradient.Title },
    'gray-after-line-clear': {
        type: 'switch', datatestBase: 'switch-gray-after-line-clear', title: i18n.TreeView.GrayAfterLineClear,
    },
    'trim-top-blank': { type: 'switch', datatestBase: 'switch-trim-top-blank', title: i18n.ListView.TrimTopBlank },
    'editor-side-panel': {
        type: 'switch', datatestBase: 'switch-editor-side-panel', title: i18n.UserSettings.EditorSidePanel,
    },
    'open-tree-screen-on-tree-data': {
        type: 'switch', datatestBase: 'switch-open-tree-screen-on-tree-data',
        title: i18n.UserSettings.OpenTreeScreenOnTreeData.Title,
        description: i18n.UserSettings.OpenTreeScreenOnTreeData.Description,
    },
    'utils-menu-pinned': {
        type: 'switch', datatestBase: 'switch-utils-menu-pinned',
        title: i18n.UserSettings.UtilsMenuPinned.Title,
        description: i18n.UserSettings.UtilsMenuPinned.Description,
    },
    'piece-shortcuts': { type: 'custom', title: i18n.UserSettings.PieceShortcuts.Title },
    'ghost-visible': { type: 'switch', datatestBase: 'switch-ghost-visible', title: i18n.UserSettings.Ghost.Title },
    'rotation-system': { type: 'custom', title: i18n.UserSettings.RotationSystem.Title },
    'piece-arr': { type: 'custom', title: i18n.UserSettings.PieceShortcuts.ArrFrames },
    'piece-das': { type: 'custom', title: i18n.UserSettings.PieceShortcuts.DasFrames },
    'piece-dcd': { type: 'custom', title: i18n.UserSettings.PieceShortcuts.DasCutFrames },
    'piece-sdf': { type: 'custom', title: i18n.UserSettings.PieceShortcuts.Sdf },
    'piece-softdrop-priority': {
        type: 'switch', datatestBase: 'switch-piece-softdrop-priority',
        title: i18n.UserSettings.PieceShortcuts.SoftDropPriority.Title,
        description: i18n.UserSettings.PieceShortcuts.SoftDropPriority.Description,
    },
    'seven-bag-gray': {
        type: 'switch', datatestBase: 'switch-seven-bag-gray', title: i18n.UserSettings.SevenBagGray.Title,
        description: i18n.UserSettings.SevenBagGray.Description,
    },
    'palette-shortcuts': { type: 'custom', title: i18n.UserSettings.PaletteShortcuts.Title },
    'edit-shortcuts': { type: 'custom', title: i18n.UserSettings.EditShortcuts.Title },
    'shortcut-label': {
        type: 'switch', datatestBase: 'switch-shortcut-label', title: i18n.UserSettings.ShortcutLabel.Title,
    },
    'initial-screen': { type: 'custom', title: i18n.UserSettings.InitialScreen.Title },
    loop: { type: 'switch', datatestBase: 'switch-loop', title: i18n.UserSettings.Loop.Title },
    'page-rotation-limit': { type: 'custom', title: i18n.UserSettings.PageRotation.Title },
};

export const tabLayout: Record<UserSettingsTab, SettingId[]> = {
    edit: [
        'delete-spawn-mino-on-paint-drag', 'paint-palette-mino-design', 'flags-hidden', 'gradient',
        'gray-after-line-clear',
    ],
    view: ['trim-top-blank', 'gray-after-line-clear', 'editor-side-panel'],
    input: [
        'ghost-visible', 'rotation-system', 'piece-arr', 'piece-das', 'piece-dcd', 'piece-sdf',
        'piece-softdrop-priority', 'seven-bag-gray',
    ],
    keys: ['palette-shortcuts', 'edit-shortcuts', 'piece-shortcuts', 'shortcut-label'],
    // 実際の描画順に合わせる。open-tree-screen-on-tree-data は初期画面の従属項目として直下に置く。
    general: [
        'loop', 'initial-screen', 'open-tree-screen-on-tree-data', 'page-rotation-limit', 'utils-menu-pinned',
    ],
};

export const resolveDatatest = (id: SettingId, tab: UserSettingsTab): string | undefined => {
    const setting = settingsCatalog[id];
    if (setting.type !== 'switch') return undefined;
    const appearances = (Object.keys(tabLayout) as UserSettingsTab[]).filter(key => tabLayout[key].includes(id));
    return appearances.length === 1 ? setting.datatestBase : `${setting.datatestBase}-${tab}`;
};

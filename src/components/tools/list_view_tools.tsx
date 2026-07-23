import { Component, px, style } from '../../lib/types';
import { h } from 'hyperapp';
import { ToolButton } from './tool_button';
import { ColorPalette } from '../../lib/colors';
import { TreeViewToggle } from '../tree/tree_view_toggle';
import { TreeViewMode } from '../../lib/fumen/tree_types';
import { i18n } from '../../locales/keys';

interface Props {
    height: number;
    palette: ColorPalette;
    treeEnabled: boolean;
    treeViewMode: TreeViewMode;
    listShortcutLabel?: string;
    treeShortcutLabel?: string;
    homeShortcutLabel?: string;
    menuShortcutLabel?: string;
    actions: {
        changeToEditorFromListView: () => void;
        openUtils: () => void;
        openListViewMenuModal: (data: { initialTab: 'export' | 'import' }) => void;
        openUserSettingsModal: () => void;
        toggleTreeMode: () => void;
        setTreeViewMode: (mode: TreeViewMode) => void;
        openMenuModal: () => void;
        executeNewFumen: () => void;
    };
}

export const ListViewTools: Component<Props> = (
    {
        height, palette, treeEnabled, treeViewMode,
        listShortcutLabel, treeShortcutLabel, homeShortcutLabel, menuShortcutLabel, actions,
    },
) => {
    const navProperties = style({
        width: '100%',
        height: px(height),
        margin: 0,
        padding: 0,
        position: 'fixed',
        bottom: 0,
        left: 0,
        zIndex: 100,
    });

    const divProperties = style({
        width: '100%',
        height: px(height),
        margin: 0,
        padding: 0,
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'flex-start',
        alignItems: 'center',
    });

    const themeColor = `page-footer tools ${palette.baseClass}`;

    return (
        <nav datatest="list-view-tools" className={themeColor} style={navProperties}>
            <div className="nav-wrapper" style={divProperties}>
                <ToolButton
                    iconName="mode_edit"
                    datatest="btn-back-to-editor"
                    width={40}
                    height={height - 10}
                    key="btn-back-to-editor"
                    fontSize={30}
                    stickyLeft={true}
                    stickyOffset={3}
                    colors={palette}
                    shortcutLabel={homeShortcutLabel}
                    actions={{
                        onclick: () => actions.changeToEditorFromListView(),
                    }}
                />

                {/* Tree mode controls (marginLeft reserves space vacated by the sticky-left back button) */}
                <div style={style({ marginLeft: px(46), display: 'flex', alignItems: 'center' })}>
                    <TreeViewToggle
                        treeEnabled={treeEnabled}
                        currentViewMode={treeViewMode}
                        height={height - 10}
                        listShortcutLabel={listShortcutLabel}
                        treeShortcutLabel={treeShortcutLabel}
                        actions={{
                            onTreeToggle: actions.toggleTreeMode,
                            onViewModeChange: actions.setTreeViewMode,
                        }}
                    />
                </div>

                <div style={style({ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: px(1) })}>
                    <ToolButton
                        iconName="widgets"
                        datatest="btn-utils-mode"
                        width={36}
                        height={height - 10}
                        key="btn-utils-mode"
                        fontSize={24}
                        colors={palette}
                        actions={{
                            onclick: () => actions.openUtils(),
                        }}
                    />

                    <ToolButton
                        iconName="file_download"
                        datatest="btn-list-view-import"
                        width={36}
                        height={height - 10}
                        key="btn-list-view-import"
                        fontSize={24}
                        title={i18n.ListViewMenu.Tabs.Import()}
                        colors={palette}
                        actions={{
                            onclick: () => actions.openListViewMenuModal({ initialTab: 'import' }),
                        }}
                    />

                    <ToolButton
                        iconName="file_upload"
                        datatest="btn-list-view-export"
                        width={36}
                        height={height - 10}
                        key="btn-list-view-export"
                        fontSize={24}
                        title={i18n.ListViewMenu.Tabs.Export()}
                        colors={palette}
                        actions={{
                            onclick: () => actions.openListViewMenuModal({ initialTab: 'export' }),
                        }}
                    />

                    <ToolButton
                        iconName="settings"
                        datatest="btn-list-view-user-settings"
                        width={36}
                        height={height - 10}
                        key="btn-list-view-user-settings"
                        fontSize={24}
                        marginRight={41}
                        colors={palette}
                        actions={{
                            onclick: () => actions.openUserSettingsModal(),
                        }}
                    />

                    <ToolButton
                        iconName="menu"
                        datatest="btn-open-menu"
                        width={36}
                        height={height - 10}
                        key="btn-open-menu"
                        fontSize={24}
                        sticky={true}
                        stickyOffset={3}
                        colors={palette}
                        shortcutLabel={menuShortcutLabel}
                        actions={{
                            onclick: () => actions.openMenuModal(),
                            onlongpress: () => actions.executeNewFumen(),
                        }}
                    />
                </div>
            </div>
        </nav>
    );
};

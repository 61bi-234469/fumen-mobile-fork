import { Component } from '../../lib/types';
import { h } from 'hyperapp';
import { ToolButton } from './tool_button';
import { ColorPalette } from '../../lib/colors';
import { TreeViewToggle } from '../tree/tree_view_toggle';
import { TreeViewMode } from '../../lib/fumen/tree_types';
import { i18n } from '../../locales/keys';
import { chooseToolbarTier, ToolbarLayout, ToolbarRow } from './toolbar_layout';
import { AppActionCluster } from './app_action_cluster';

interface Props {
    height: number;
    width: number;
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
    };
}

export const ListViewTools: Component<Props> = (
    {
        height, width, palette, treeEnabled, treeViewMode,
        listShortcutLabel, treeShortcutLabel, homeShortcutLabel, menuShortcutLabel, actions,
    },
) => {
    const fit = chooseToolbarTier({ width, treeEnabled, screen: 'list' });
    const metrics = fit.metrics;
    const buttonHeight = height - metrics.buttonInset;

    const left = [
        <ToolButton
            iconName="mode_edit"
            datatest="btn-back-to-editor"
            width={metrics.edgeWidth}
            height={buttonHeight}
            key="btn-back-to-editor"
            fontSize={metrics.edgeIconSize}
            colors={palette}
            shortcutLabel={homeShortcutLabel}
            actions={{
                onclick: () => actions.changeToEditorFromListView(),
            }}
        />,

        <div key="tree-view-toggle" style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <TreeViewToggle
                treeEnabled={treeEnabled}
                currentViewMode={treeViewMode}
                height={buttonHeight}
                listShortcutLabel={listShortcutLabel}
                treeShortcutLabel={treeShortcutLabel}
                actions={{
                    onTreeToggle: actions.toggleTreeMode,
                    onViewModeChange: actions.setTreeViewMode,
                }}
            />
        </div>,
    ];

    const transferButtons = fit.hideListTransfer ? [] : [
        <ToolButton
            iconName="file_download"
            datatest="btn-list-view-import"
            width={metrics.edgeWidth}
            height={buttonHeight}
            key="btn-list-view-import"
            fontSize={metrics.edgeIconSize}
            title={i18n.ListViewMenu.Tabs.Import()}
            colors={palette}
            actions={{
                onclick: () => actions.openListViewMenuModal({ initialTab: 'import' }),
            }}
        />,

        <ToolButton
            iconName="file_upload"
            datatest="btn-list-view-export"
            width={metrics.edgeWidth}
            height={buttonHeight}
            key="btn-list-view-export"
            fontSize={metrics.edgeIconSize}
            title={i18n.ListViewMenu.Tabs.Export()}
            colors={palette}
            actions={{
                onclick: () => actions.openListViewMenuModal({ initialTab: 'export' }),
            }}
        />,
    ];

    const right = [
        <ToolbarRow key="list-view-tool-row" gap={metrics.gap}>
            <ToolButton
                iconName="widgets"
                datatest="btn-utils-mode"
                width={metrics.edgeWidth}
                height={buttonHeight}
                key="btn-utils-mode"
                fontSize={metrics.edgeIconSize}
                colors={palette}
                actions={{
                    onclick: () => actions.openUtils(),
                }}
            />
            {transferButtons}
        </ToolbarRow>,

        <AppActionCluster buttonHeight={buttonHeight} metrics={metrics} colors={palette}
                          settingsDatatest="btn-list-view-user-settings"
                          menuShortcutLabel={menuShortcutLabel}
                          actions={{
                              openUserSettingsModal: actions.openUserSettingsModal,
                              openMenuModal: actions.openMenuModal,
                          }}/>,
    ];

    return (
        <ToolbarLayout datatest="list-view-tools" className={`page-footer tools ${palette.baseClass}`}
                       height={height} fixedToBottom={true}
                       left={left} center={[]} right={right} leftGap={metrics.gap} centerGap={metrics.gap}/>
    );
};

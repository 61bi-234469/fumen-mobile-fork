import { Component, px, style } from '../../lib/types';
import { h } from 'hyperapp';
import { ToolButton } from './tool_button';
import { ColorPalette } from '../../lib/colors';
import { TreeViewToggle } from '../tree/tree_view_toggle';
import { TreeViewMode } from '../../lib/fumen/tree_types';

interface Props {
    height: number;
    palette: ColorPalette;
    treeEnabled: boolean;
    treeViewMode: TreeViewMode;
    listShortcutLabel?: string;
    treeShortcutLabel?: string;
    homeShortcutLabel?: string;
    actions: {
        changeToEditorFromListView: () => void;
        convertAllToMirror: () => void;
        openListViewReplaceModal: () => void;
        openListViewMenuModal: () => void;
        openUserSettingsModal: () => void;
        toggleTreeMode: () => void;
        setTreeViewMode: (mode: TreeViewMode) => void;
    };
}

export const ListViewTools: Component<Props> = (
    {
        height, palette, treeEnabled, treeViewMode,
        listShortcutLabel, treeShortcutLabel, homeShortcutLabel, actions,
    },
) => {
    const navProperties = style({
        width: '100%',
        height: px(height),
        margin: 0,
        padding: 0,
        position: 'fixed',
        top: 0,
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
                    marginLeft={3}
                    marginRight={4}
                    colors={palette}
                    shortcutLabel={homeShortcutLabel}
                    actions={{
                        onclick: () => actions.changeToEditorFromListView(),
                    }}
                />

                {/* Tree mode controls */}
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

                <div style={style({ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: px(1) })}>
                    <ToolButton
                        iconName="flip"
                        datatest="btn-all-mirror"
                        width={36}
                        height={height - 10}
                        key="btn-all-mirror"
                        fontSize={24}
                        colors={palette}
                        actions={{
                            onclick: () => actions.convertAllToMirror(),
                        }}
                    />

                    <ToolButton
                        iconName="find_replace"
                        datatest="btn-replace"
                        width={36}
                        height={height - 10}
                        key="btn-replace"
                        fontSize={24}
                        colors={palette}
                        actions={{
                            onclick: () => actions.openListViewReplaceModal(),
                        }}
                    />

                    <ToolButton
                        iconName="import_export"
                        datatest="btn-list-view-menu"
                        width={36}
                        height={height - 10}
                        key="btn-list-view-menu"
                        fontSize={24}
                        colors={palette}
                        actions={{
                            onclick: () => actions.openListViewMenuModal(),
                        }}
                    />

                    <ToolButton
                        iconName="settings"
                        datatest="btn-list-view-user-settings"
                        width={36}
                        height={height - 10}
                        key="btn-list-view-user-settings"
                        fontSize={24}
                        marginRight={3}
                        colors={palette}
                        actions={{
                            onclick: () => actions.openUserSettingsModal(),
                        }}
                    />
                </div>
            </div>
        </nav>
    );
};

import { Component } from '../../lib/types';
import { h } from 'hyperapp';
import { ToolButton } from './tool_button';
import { ToolText } from './tool_text';
import { ColorPalette } from '../../lib/colors';
import { EditShortcuts } from '../../states';
import { displayShortcut } from '../../lib/shortcuts';
import { chooseToolbarTier, ToolbarLayout, ToolbarSeparator } from './toolbar_layout';
import { AppActionCluster } from './app_action_cluster';

interface Props {
    height: number;
    width: number;
    currentPage: number;
    maxPage: number;
    palette: ColorPalette;
    undoCount: number;
    redoCount: number;
    inferenceCount: number;
    editShortcuts: EditShortcuts;
    shortcutLabelVisible: boolean;
    loop: boolean;
    actions: {
        openFumenModal: () => void;
        openUserSettingsModal: () => void;
        openMenuModal: () => void;
        changeToListViewScreen: () => void;
        changeToTreeViewScreen: () => void;
        startAnimation: () => void;
        pauseAnimation: () => void;
        backPage: (data: { loop: boolean }) => void;
        nextPage: (data: { loop: boolean }) => void;
        firstPage: () => void;
        lastPage: () => void;
        duplicatePageOnly: (data: { index: number }) => void;
        duplicatePageToGray: (data: { index: number }) => void;
        undo: () => void;
        redo: () => void;
    };
}

export const EditorTools: Component<Props> = (
    {
        currentPage,
        maxPage,
        height,
        width,
        palette,
        undoCount,
        redoCount,
        inferenceCount,
        editShortcuts,
        shortcutLabelVisible,
        loop,
        actions,
    },
) => {
    const fit = chooseToolbarTier({ width, currentPage, maxPage, screen: 'editor' });
    const metrics = fit.metrics;
    const buttonHeight = height - metrics.buttonInset;

    // ショートカットラベルを取得
    const getLabel = (key: keyof EditShortcuts): string | undefined => {
        if (fit.tier !== 'normal' || !shortcutLabelVisible) {
            return undefined;
        }
        const code = editShortcuts[key];
        return code ? displayShortcut(code) : undefined;
    };

    const colors = {
        baseClass: palette.baseClass,
        baseCode: palette.baseCode,
        darkCode: palette.darkCode,
    };

    const left = [
        <ToolButton iconName="view_list" datatest="btn-list-view"
                    width={metrics.edgeWidth} height={buttonHeight}
                    key="btn-list-view" fontSize={metrics.edgeIconSize} colors={colors}
                    shortcutLabel={getLabel('ListView')}
                    actions={{
                        onclick: () => actions.changeToListViewScreen(),
                        onlongpress: () => actions.changeToTreeViewScreen(),
                    }}/>,
        <ToolbarSeparator key="tools-left-separator"/>,
    ];

    const center = [
        <ToolButton iconName="undo" datatest="btn-undo" width={metrics.navigationWidth} height={buttonHeight}
                    key="btn-undo" fontSize={metrics.iconSize} colors={colors}
                    shortcutLabel={getLabel('Undo')} shortcutLabelColor="#fff"
                    actions={{ onclick: () => actions.undo() }} enable={0 < undoCount || 0 < inferenceCount}/>,

        <ToolButton iconName="redo" datatest="btn-redo" width={metrics.navigationWidth} height={buttonHeight}
                    key="btn-redo" fontSize={metrics.iconSize} colors={colors}
                    shortcutLabel={getLabel('Redo')} shortcutLabelColor="#fff"
                    actions={{ onclick: () => actions.redo() }} enable={0 < redoCount}/>,

        <ToolButton iconName="navigate_before" datatest="btn-back-page"
                    width={metrics.navigationWidth} height={buttonHeight}
                    key="btn-back-page" fontSize={metrics.iconSize} colors={colors}
                    shortcutLabel={getLabel('PrevPage')}
                    actions={{
                        onclick: () => actions.backPage({ loop }),
                        onlongpress: () => actions.firstPage(),
                    }} enable={loop || 1 < currentPage}/>,

        <ToolText key="text-pages" datatest="text-pages" height={buttonHeight}
                  minWidth={fit.pageMinWidth} fontSize={fit.pageFontSize} title={fit.pageTitle}>
            {fit.pageText}
        </ToolText>,

        <ToolButton iconName="navigate_next" datatest="btn-next-page"
                    width={metrics.navigationWidth} height={buttonHeight}
                    key="btn-next-page" fontSize={metrics.iconSize} colors={colors}
                    shortcutLabel={getLabel('NextPage')}
                    actions={{
                        onclick: () => actions.nextPage({ loop }),
                        onlongpress: () => actions.lastPage(),
                    }}
                    enable={loop || currentPage < maxPage}/>,

        <ToolButton iconName="add" datatest="btn-insert-page" width={metrics.addWidth} height={buttonHeight}
                    key="btn-insert-page" fontSize={metrics.edgeIconSize} colors={colors}
                    shortcutLabel={getLabel('InsertPage')}
                    actions={{ onclick: () => actions.duplicatePageOnly({ index: currentPage }) }}/>,
    ];

    const right = [
        <AppActionCluster buttonHeight={buttonHeight} metrics={metrics} colors={colors}
                          settingsDatatest="btn-editor-user-settings"
                          menuShortcutLabel={getLabel('Menu')}
                          actions={{
                              openUserSettingsModal: actions.openUserSettingsModal,
                              openMenuModal: actions.openMenuModal,
                          }}/>,
    ];

    return (
        <ToolbarLayout datatest="tools" className={`page-footer tools ${palette.baseClass}`} height={height}
                       left={left} center={center} right={right} leftGap={0} centerGap={metrics.gap}/>
    );
};

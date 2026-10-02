import { Component } from '../../lib/types';
import { h } from 'hyperapp';
import { ToolButton } from './tool_button';
import { ToolText } from './tool_text';
import { AnimationState } from '../../lib/enums';
import { ColorPalette } from '../../lib/colors';
import { EditShortcuts } from '../../states';
import { displayShortcut } from '../../lib/shortcuts';
import { chooseToolbarTier, ToolbarLayout } from './toolbar_layout';
import { AppActionCluster } from './app_action_cluster';

interface Props {
    currentPage: number;
    maxPage: number;
    height: number;
    width: number;
    animationState: AnimationState;
    palette: ColorPalette;
    loop: boolean;
    editShortcuts: EditShortcuts;
    shortcutLabelVisible: boolean;
    actions: {
        changeToDrawerScreen: (data: { refresh?: boolean }) => void;
        changeToListViewScreen: () => void;
        changeToTreeViewScreen: () => void;
        openMenuModal: () => void;
        openUserSettingsModal: () => void;
        startAnimation: () => void;
        pauseAnimation: () => void;
        backPage: (data: { loop: boolean }) => void;
        nextPage: (data: { loop: boolean }) => void;
        firstPage: () => void;
        lastPage: () => void;
    };
}

export const ReaderTools: Component<Props> = (
    {
        currentPage,
        maxPage,
        height,
        width,
        animationState,
        palette,
        loop,
        editShortcuts,
        shortcutLabelVisible,
        actions,
    },
) => {
    const fit = chooseToolbarTier({ width, currentPage, maxPage, screen: 'reader' });
    const metrics = fit.metrics;
    const buttonHeight = height - metrics.buttonInset;

    // ショートカットラベルを取得
    const getLabel = (key: keyof EditShortcuts): string | undefined => {
        if (!shortcutLabelVisible) {
            return undefined;
        }
        const code = editShortcuts[key];
        return code ? displayShortcut(code) : undefined;
    };

    const left = [
        <ToolButton iconName="view_list" datatest="btn-list-view"
                    width={metrics.edgeWidth} height={buttonHeight}
                    key="btn-list-view" fontSize={metrics.edgeIconSize} colors={palette}
                    shortcutLabel={getLabel('ListView')}
                    actions={{
                        onclick: () => actions.changeToListViewScreen(),
                        onlongpress: () => actions.changeToTreeViewScreen(),
                    }}/>,

        <ToolButton iconName={animationState !== 'pause' ? 'pause' : 'play_arrow'} datatest="btn-play-anime"
                    key="btn-play-anime" width={metrics.edgeWidth} height={buttonHeight}
                    fontSize={metrics.playIconSize} colors={palette}
                    actions={{
                        onclick: () => {
                            switch (animationState) {
                            case AnimationState.Play:
                                actions.pauseAnimation();
                                break;
                            default:
                                actions.startAnimation();
                                break;
                            }
                        },
                    }}/>,
    ];

    const center = [
        <ToolButton iconName="navigate_before" datatest="btn-back-page"
                    width={metrics.navigationWidth} height={buttonHeight}
                    key="btn-back-page" fontSize={metrics.iconSize} colors={palette}
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
                    key="btn-next-page" fontSize={metrics.iconSize} colors={palette}
                    shortcutLabel={getLabel('NextPage')}
                    enable={loop || currentPage < maxPage}
                    actions={{
                        onclick: () => actions.nextPage({ loop }),
                        onlongpress: () => actions.lastPage(),
                    }}/>,

        <ToolButton iconName="mode_edit" datatest="btn-writable-in-reader"
                    width={metrics.edgeWidth} height={buttonHeight}
                    key="btn-writable-in-reader" fontSize={metrics.iconSize} colors={palette}
                    shortcutLabel={getLabel('EditHome')}
                    actions={{
                        onclick: () => {
                            actions.changeToDrawerScreen({ refresh: true });
                        },
                    }}/>,
    ];

    const right = [
        <AppActionCluster buttonHeight={buttonHeight} metrics={metrics} colors={palette}
                          settingsDatatest="btn-reader-user-settings"
                          menuShortcutLabel={getLabel('Menu')}
                          actions={{
                              openUserSettingsModal: actions.openUserSettingsModal,
                              openMenuModal: actions.openMenuModal,
                          }}/>,
    ];

    return (
        <ToolbarLayout datatest="tools" className={`page-footer tools ${palette.baseClass}`} height={height}
                       left={left} center={center} right={right}
                       leftGap={metrics.gap} centerGap={metrics.gap}/>
    );
};

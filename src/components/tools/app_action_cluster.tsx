import { h } from 'hyperapp';
import { Component, style } from '../../lib/types';
import { ToolButton } from './tool_button';
import { ToolbarMetrics, ToolbarSeparator } from './toolbar_layout';
import { i18n } from '../../locales/keys';

interface Props {
    buttonHeight: number;
    metrics: ToolbarMetrics;
    settingsDatatest: string;
    menuShortcutLabel?: string;
    colors: {
        baseClass: string;
        baseCode: string;
        darkCode: string;
    };
    actions: {
        openUserSettingsModal: () => void;
        openMenuModal: () => void;
    };
}

// 全画面で共通の右端のまとまり［区切り｜歯車｜⋮］。⋮ を右端に置き、長押しの割り当ては持たない
export const AppActionCluster: Component<Props> = (
    { buttonHeight, metrics, settingsDatatest, menuShortcutLabel, colors, actions },
) => (
    <div key="app-action-cluster" style={style({ display: 'flex', flexDirection: 'row', alignItems: 'center' })}>
        <ToolbarSeparator key="app-action-separator" datatest="tools-cluster-separator"/>

        <ToolButton iconName="settings" datatest={settingsDatatest} key={settingsDatatest}
                    width={metrics.edgeWidth} height={buttonHeight} fontSize={metrics.edgeIconSize}
                    title={i18n.EditorUi.Settings()} colors={colors}
                    actions={{ onclick: () => actions.openUserSettingsModal() }}/>

        <ToolButton iconName="more_vert" datatest="btn-open-menu" key="btn-open-menu"
                    width={metrics.edgeWidth} height={buttonHeight} fontSize={metrics.menuIconSize}
                    title={i18n.EditorUi.More()} colors={colors}
                    shortcutLabel={menuShortcutLabel}
                    actions={{ onclick: () => actions.openMenuModal() }}/>
    </div>
);

import { a, div } from '@hyperapp/html';
import { px, style } from '../lib/types';
import { ColorPalette } from '../lib/colors';
import { i18n } from '../locales/keys';
import { Screens } from '../lib/enums';

interface Props {
    height: number;
    palette: ColorPalette;
    enabled: boolean;
    screen: Screens;
    actions: {
        toggleEditorSidePanel: () => void;
    };
}

export const navigatorElement = (
    { height, palette, enabled, screen, actions }: Props,
) => {
    if (!height) {
        return undefined;
    }

    const showSidePanel = screen === Screens.Reader || !enabled;
    const label = showSidePanel
        ? i18n.Navigator.ShowSidePanel()
        : i18n.Navigator.HideSidePanel();

    return div({
        className: `${palette.baseClass} lighten-5`,
        style: style({
            height: px(height),
            display: 'flex',
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            fontSize: '16px',
        }),
    }, [
        a({
            href: '#',
            datatest: 'navigator-side-panel-toggle',
            onclick: (event: MouseEvent) => {
                event.preventDefault();
                actions.toggleEditorSidePanel();
            },
        }, label),
    ]);
};

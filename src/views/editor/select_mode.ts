import { div } from '@hyperapp/html';
import { iconContents, toolButton, toolSpace } from '../editor_buttons';
import { EditorLayout, toolStyle } from './editor';

export const selectMode = ({ layout, actions }: {
    layout: EditorLayout;
    actions: {
        commitRectSelect: () => void;
        cancelRectSelect: () => void;
        mirrorSelection: () => void;
        copySelectionToParts: () => void;
        cutSelectionToParts: () => void;
        deleteSelection: () => void;
        setFloatingMenuEnabled: (data: { enabled: boolean }) => void;
        toggleRectSelectMenu: () => void;
    };
}) => {
    const button = (key: string, iconName: string, onclick: () => void) => toolButton({
        key, onclick,
        borderWidth: 1, width: layout.buttons.size.width, margin: 4,
        backgroundColorClass: 'white', textColor: '#333', borderColor: '#333',
        datatest: key,
    }, iconContents({ iconName, description: '', iconSize: 22 }));
    return div({ style: toolStyle(layout) }, [
        toolSpace({ flexGrow: 100, width: layout.buttons.size.width, margin: 4, key: 'select-space' }),
        button('btn-rect-select', 'crop_free', actions.toggleRectSelectMenu),
        button('btn-rect-menu', 'view_comfy', () => actions.setFloatingMenuEnabled({ enabled: true })),
        button('btn-rect-copy', 'content_copy', actions.copySelectionToParts),
        button('btn-rect-cut', 'content_cut', actions.cutSelectionToParts),
        button('btn-rect-mirror', 'flip', actions.mirrorSelection),
        button('btn-rect-delete', 'delete', actions.deleteSelection),
        button('btn-rect-cancel-side', 'close', actions.cancelRectSelect),
        button('btn-rect-commit-side', 'check', actions.commitRectSelect),
    ]);
};

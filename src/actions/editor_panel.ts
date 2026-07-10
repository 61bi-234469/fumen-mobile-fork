import { action } from '../actions';
import { NextState } from './commons';
import { EditorSidePanelTab } from '../states';
import { persistViewSettings } from './view_settings';

export interface EditorPanelActions {
    setEditorSidePanelEnabled: (data: { enabled: boolean }) => action;
    setEditorSidePanelTab: (data: { tab: EditorSidePanelTab }) => action;
}

export const editorPanelActions: Readonly<EditorPanelActions> = {
    setEditorSidePanelEnabled: ({ enabled }) => (state): NextState => {
        if (state.editorPanel.enabled === enabled) {
            return undefined;
        }

        persistViewSettings(state, { editorSidePanel: enabled });
        return {
            editorPanel: {
                ...state.editorPanel,
                enabled,
            },
        };
    },
    setEditorSidePanelTab: ({ tab }) => (state): NextState => {
        if (state.editorPanel.tab === tab) {
            return undefined;
        }

        persistViewSettings(state, { editorSidePanelTab: tab });
        return {
            editorPanel: {
                ...state.editorPanel,
                tab,
            },
        };
    },
};

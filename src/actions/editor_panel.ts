import { action } from '../actions';
import { NextState } from './commons';
import { EditorSidePanelTab } from '../states';
import { persistViewSettings } from './view_settings';

export interface EditorPanelActions {
    setEditorSidePanelEnabled: (data: { enabled: boolean }) => action;
    setEditorSidePanelTab: (data: { tab: EditorSidePanelTab }) => action;
    setEditorSidePanelWidth: (data: { width: number | null; persist?: boolean }) => action;
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
    setEditorSidePanelWidth: ({ width, persist = true }) => (state): NextState => {
        if (persist) {
            persistViewSettings(state, { editorSidePanelWidth: width });
        }
        if (state.editorPanel.width === width) {
            return undefined;
        }
        return {
            editorPanel: {
                ...state.editorPanel,
                width,
            },
        };
    },
};

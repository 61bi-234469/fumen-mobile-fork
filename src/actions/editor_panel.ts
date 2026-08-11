import { action, actions } from '../actions';
import { NextState, sequence } from './commons';
import { EditorSidePanelTab } from '../states';
import { persistViewSettings } from './view_settings';
import { Screens } from '../lib/enums';

export interface EditorPanelActions {
    setEditorSidePanelEnabled: (data: { enabled: boolean; persist?: boolean }) => action;
    toggleEditorSidePanel: () => action;
    setEditorSidePanelTab: (data: { tab: EditorSidePanelTab; persist?: boolean }) => action;
    setEditorSidePanelWidth: (data: { width: number | null; persist?: boolean }) => action;
}

export const editorPanelActions: Readonly<EditorPanelActions> = {
    setEditorSidePanelEnabled: ({ enabled, persist = true }) => (state): NextState => {
        if (state.editorPanel.enabled === enabled) {
            return undefined;
        }

        if (persist) {
            persistViewSettings(state, { editorSidePanel: enabled });
        }
        return {
            editorPanel: {
                ...state.editorPanel,
                enabled,
            },
        };
    },
    toggleEditorSidePanel: () => (state): NextState => {
        const fromReader = state.mode.screen === Screens.Reader;
        const enabled = fromReader ? true : !state.editorPanel.enabled;

        return sequence(state, [
            actions.setEditorSidePanelEnabled({ enabled }),
            fromReader ? actions.changeToDrawerScreen({}) : undefined,
        ]);
    },
    setEditorSidePanelTab: ({ tab, persist = true }) => (state): NextState => {
        if (state.editorPanel.tab === tab) {
            return undefined;
        }

        if (persist) {
            persistViewSettings(state, { editorSidePanelTab: tab });
        }
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

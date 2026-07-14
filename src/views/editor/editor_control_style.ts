import { CSSProperties } from 'typestyle/lib/types';

export const EDITOR_ACTIVE_COLOR = '#1976d2';
export const EDITOR_ACTIVE_TEXT_COLOR = '#1565c0';
export const EDITOR_ACTIVE_BACKGROUND = '#e8f1fb';
export const EDITOR_PALETTE_BACKGROUND = '#f4f8fd';
export const EDITOR_DANGER_COLOR = '#c62828';

export type EditorControlState = 'idle' | 'active' | 'palette' | 'status' | 'danger';

export const editorControlStateStyle = (state: EditorControlState): CSSProperties => {
    switch (state) {
    case 'active':
        return {
            background: EDITOR_ACTIVE_BACKGROUND,
            boxShadow: `inset 0 -3px 0 ${EDITOR_ACTIVE_COLOR}`,
            color: EDITOR_ACTIVE_TEXT_COLOR,
        };
    case 'palette':
        return {
            background: EDITOR_PALETTE_BACKGROUND,
            boxShadow: `inset 0 0 0 2px ${EDITOR_ACTIVE_COLOR}`,
            color: '#333',
        };
    case 'status':
        return {
            background: EDITOR_ACTIVE_BACKGROUND,
            boxShadow: 'none',
            color: EDITOR_ACTIVE_TEXT_COLOR,
        };
    case 'danger':
        return {
            background: '#fff',
            boxShadow: 'none',
            color: EDITOR_DANGER_COLOR,
        };
    case 'idle':
        return {
            background: '#fff',
            boxShadow: 'none',
            color: '#333',
        };
    }
};

import { div, span } from '@hyperapp/html';
import { Actions } from '../../actions';
import { px, style } from '../../lib/types';
import { State } from '../../states';
import { CONTEXT_TRAY_HEIGHT, contextTray } from './context_tray';
import { i18n } from '../../locales/keys';

export const DESKTOP_CONTEXT_WIDTH = 240;

export const desktopContextInspector = (state: State, actions: Actions, height: number) => {
    const rect = state.rectSelect.rect;
    const selectionSummary = rect === null ? i18n.EditorUi.NoSelection()
        : `${rect.maxX - rect.minX + 1}×${rect.maxY - rect.minY + 1}`;
    return div({
        key: 'editor-context-inspector',
        datatest: 'editor-context-inspector',
        style: style({
            background: '#fafafa',
            borderLeft: '1px solid #d0d0d0',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            height: px(height),
            minWidth: px(DESKTOP_CONTEXT_WIDTH),
            overflow: 'hidden',
            width: px(DESKTOP_CONTEXT_WIDTH),
        }),
    }, [
        div({
            key: 'context-heading',
            style: style({
                alignItems: 'center',
                borderBottom: '1px solid #ddd',
                display: 'flex',
                fontSize: px(12),
                fontWeight: '700',
                height: px(34),
                justifyContent: 'space-between',
                letterSpacing: '.06em',
                padding: '0 10px',
                textTransform: 'uppercase',
            }),
        }, [
            span({ key: 'tool' }, state.editorUi.primaryTool),
            span({ key: 'selection', style: style({ color: '#666', fontSize: px(10), fontWeight: '400' }) },
                selectionSummary),
        ]),
        contextTray(state, actions, CONTEXT_TRAY_HEIGHT * 2),
        div({
            key: 'context-details',
            style: style({ display: 'grid', gap: px(6), overflowY: 'auto', padding: px(10) }),
        }, [
            span({ key: 'palette', style: style({ color: '#666', fontSize: px(11) }) },
                `${i18n.EditorUi.Palette()}: ${state.editorUi.paletteSelection === 'comp'
                    ? 'COMP' : PieceLabel(state.editorUi.paletteSelection)}`),
            ...(state.parts.items.length === 0 ? [] : [
                span({
                    key: 'parts-title',
                    style: style({ fontSize: px(11), fontWeight: '700' }),
                }, i18n.EditorUi.Parts()),
                ...state.parts.items.map(part => span({
                    key: `part-${part.id}`,
                    style: style({
                        background: part.id === state.parts.selectedId ? '#ffebee' : '#fff',
                        border: '1px solid #ddd',
                        borderRadius: '0',
                        fontSize: px(10),
                        padding: '5px 7px',
                    }),
                }, `${part.width}×${part.height}${part.pinned ? ` • ${i18n.EditorUi.Pinned()}` : ''}`)),
            ]),
        ]),
    ]);
};

const PieceLabel = (piece: number): string => {
    const names = ['Empty', 'I', 'L', 'O', 'Z', 'T', 'J', 'S', 'Gray'];
    return names[piece] ?? '';
};

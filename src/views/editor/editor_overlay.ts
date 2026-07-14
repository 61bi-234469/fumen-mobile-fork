import { button, div, span } from '@hyperapp/html';
import { Actions } from '../../actions';
import { State } from '../../states';
import { px, style } from '../../lib/types';
import { BlockIcon } from '../../components/atomics/icons';
import { EditorLayout } from './editor';
import { i18n } from '../../locales/keys';
import { editorControlStateStyle, EditorControlState } from './editor_control_style';

const overlayButton = ({
    key, datatest, label, iconName, active = false, danger = false, onclick,
}: {
    key: string;
    datatest: string;
    label: string;
    iconName: string;
    active?: boolean;
    danger?: boolean;
    onclick: () => void;
}) => {
    const controlState: EditorControlState = active ? 'active' : danger ? 'danger' : 'idle';
    const stateStyle = editorControlStateStyle(controlState);
    return button({
        key,
        datatest,
        type: 'button',
        className: 'editor-control',
        'data-active': active ? 'true' : 'false',
        'aria-label': label,
        'aria-pressed': active ? 'true' : 'false',
        onclick: (event: MouseEvent) => {
            onclick();
            event.preventDefault();
            event.stopPropagation();
        },
        style: style({
            alignItems: 'center',
            background: stateStyle.background,
            border: '1px solid #333',
            borderRadius: '0',
            boxShadow: stateStyle.boxShadow,
            color: stateStyle.color,
            cursor: 'pointer',
            display: 'flex',
            fontFamily: 'inherit',
            fontSize: px(11),
            gap: px(5),
            height: px(34),
            justifyContent: 'flex-start',
            padding: '0 8px',
            textAlign: 'left',
            width: '100%',
        }),
    }, [
        BlockIcon({ key: `${key}-icon`, iconSize: 18 }, iconName),
        span({ key: `${key}-label` }, label),
    ]);
};

export const editorOverlay = (state: State, actions: Actions, layout: EditorLayout) => {
    const inspector = state.editorUi.inspector;
    if (inspector === 'none') {
        return undefined;
    }
    const page = state.fumen.pages[state.fumen.currentIndex];
    if (page === undefined) {
        return undefined;
    }
    const closeAndRun = (run: () => void) => {
        actions.closeEditorInspector();
        run();
    };
    const utilities = [
        overlayButton({
            key: 'btn-all-mirror', datatest: 'btn-all-mirror', label: i18n.EditorUi.AllMirror(), iconName: 'compare_arrows',
            onclick: actions.convertAllToMirror,
        }),
        overlayButton({
            key: 'btn-mirror', datatest: 'btn-mirror', label: i18n.EditorUi.Mirror(), iconName: 'compare_arrows',
            onclick: actions.convertToMirror,
        }),
        overlayButton({
            key: 'btn-convert-to-gray', datatest: 'btn-convert-to-gray', label: i18n.EditorUi.ToGray(), iconName: 'color_lens',
            onclick: actions.convertToGray,
        }),
        overlayButton({
            key: 'btn-clear-field', datatest: 'btn-clear-field', label: i18n.EditorUi.Clear(), iconName: 'clear',
            danger: true,
            onclick: actions.clearField,
        }),
        overlayButton({
            key: 'btn-fill-mode', datatest: 'btn-fill-mode', label: i18n.EditorUi.Fill(), iconName: 'format_color_fill',
            active: state.editorUi.paintTool === 'fill',
            onclick: () => closeAndRun(() => actions.changePaintTool({ tool: 'fill' })),
        }),
        overlayButton({
            key: 'btn-fill-row-mode', datatest: 'btn-fill-row-mode', label: i18n.EditorUi.FillRow(), iconName: 'power_input',
            active: state.editorUi.paintTool === 'fillRow',
            onclick: () => closeAndRun(() => actions.changePaintTool({ tool: 'fillRow' })),
        }),
        overlayButton({
            key: 'btn-slide-mode', datatest: 'btn-slide-mode', label: i18n.EditorUi.Slide(), iconName: 'swap_vert',
            onclick: () => closeAndRun(actions.changeToShiftMode),
        }),
        overlayButton({
            key: 'btn-comment-mode', datatest: 'btn-comment-mode', label: i18n.EditorUi.Comment(), iconName: 'title',
            onclick: () => closeAndRun(actions.changeToCommentMode),
        }),
    ];
    const keyPage = page.field.obj !== undefined;
    const flags = [
        overlayButton({
            key: 'btn-key-ref-page', datatest: `btn-key-page-${keyPage ? 'on' : 'off'}`,
            label: keyPage ? i18n.EditorUi.KeyPage() : i18n.EditorUi.ReferencePage(),
            iconName: keyPage ? 'vpn_key' : 'link', active: keyPage,
            onclick: keyPage
                ? () => actions.changeToRef({ index: state.fumen.currentIndex })
                : () => actions.changeToKey({ index: state.fumen.currentIndex }),
        }),
        overlayButton({
            key: 'btn-lock-flag', datatest: `btn-lock-flag-${page.flags.lock ? 'on' : 'off'}`,
            label: i18n.EditorUi.Lock(), iconName: 'lock', active: page.flags.lock,
            onclick: () => actions.changeLockFlag({ index: state.fumen.currentIndex, enable: !page.flags.lock }),
        }),
        overlayButton({
            key: 'btn-rise-flag', datatest: `btn-rise-flag-${page.flags.rise ? 'on' : 'off'}`,
            label: i18n.EditorUi.Rise(), iconName: 'vertical_align_top', active: page.flags.rise,
            onclick: () => actions.changeRiseFlag({ index: state.fumen.currentIndex, enable: !page.flags.rise }),
        }),
        overlayButton({
            key: 'btn-mirror-flag', datatest: `btn-mirror-flag-${page.flags.mirror ? 'on' : 'off'}`,
            label: i18n.EditorUi.MirrorFlag(), iconName: 'flip', active: page.flags.mirror,
            onclick: () => actions.changeMirrorFlag({ index: state.fumen.currentIndex, enable: !page.flags.mirror }),
        }),
    ];
    const title = inspector === 'utils' ? 'UTILS' : 'FLAGS';

    return div({
        key: 'editor-overlay-backdrop',
        style: style({
            alignItems: 'flex-start',
            background: 'rgba(0, 0, 0, .08)',
            bottom: '0',
            display: 'flex',
            justifyContent: 'flex-end',
            left: '0',
            padding: px(8),
            position: 'absolute',
            right: '0',
            top: '0',
            zIndex: 20,
        }),
        onclick: actions.closeEditorInspector,
    }, [
        div({
            key: `overlay-${inspector}`,
            datatest: `overlay-${inspector}`,
            role: 'menu',
            tabIndex: -1,
            'aria-label': title,
            oncreate: (element: HTMLElement) => element.focus(),
            onkeydown: (event: KeyboardEvent) => {
                if (event.key === 'Escape') {
                    actions.closeEditorInspector();
                    event.preventDefault();
                    event.stopPropagation();
                }
            },
            onclick: (event: MouseEvent) => event.stopPropagation(),
            style: style({
                background: '#fafafa',
                border: '1px solid #333',
                borderRadius: '0',
                boxShadow: '0 6px 20px rgba(0, 0, 0, .22)',
                boxSizing: 'border-box',
                display: 'grid',
                gap: px(5),
                marginRight: px(layout.buttons.size.width + 4),
                maxHeight: `calc(100% - ${px(16)})`,
                overflowY: 'auto',
                padding: px(8),
                width: px(Math.min(220, Math.max(150, layout.field.size.width * .8))),
            }),
        }, [
            div({
                key: 'overlay-heading',
                style: style({ alignItems: 'center', display: 'flex', justifyContent: 'space-between' }),
            }, [
                span({
                    key: 'title',
                    style: style({ fontSize: px(12), fontWeight: '700', letterSpacing: '.08em' }),
                }, title),
                button({
                    key: 'close',
                    datatest: 'btn-inspector-close',
                    type: 'button',
                    'aria-label': i18n.EditorUi.Close(),
                    onclick: actions.closeEditorInspector,
                    style: style({ background: 'transparent', border: '0', cursor: 'pointer', fontSize: px(20), padding: '0 4px' }),
                }, '×'),
            ]),
            ...(inspector === 'utils' ? utilities : flags),
        ]),
    ]);
};

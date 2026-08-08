import { button, div, span } from '@hyperapp/html';
import { VNode } from 'hyperapp';
import { Actions } from '../../actions';
import { State } from '../../states';
import { px, style } from '../../lib/types';
import { BlockIcon } from '../../components/atomics/icons';
import { EditorLayout } from './editor';
import { PIECE_RIGHT_COLUMN_GAP } from './responsive_layout';
import { getSidePanelWidth } from './side_panel_layout';
import { i18n } from '../../locales/keys';
import { editorControlStateStyle, EditorControlState } from './editor_control_style';
import { Screens } from '../../lib/enums';
import { spawnMinoToggleDirection } from '../../lib/editor_interaction';

const overlayButton = ({
    key, datatest, label, iconName, active = false, danger = false, checkbox = false, disabled = false, onclick,
}: {
    key: string;
    datatest: string;
    label: string;
    iconName: string;
    active?: boolean;
    danger?: boolean;
    checkbox?: boolean;
    disabled?: boolean;
    onclick: () => void;
}) => {
    const controlState: EditorControlState = active ? 'active' : danger ? 'danger' : 'idle';
    const stateStyle = editorControlStateStyle(controlState);
    const checkboxIndicator = checkbox ? span({
        key: `${key}-checkbox`,
        datatest: `${datatest}-checkbox`,
        'aria-hidden': 'true',
        style: style({
            alignItems: 'center',
            background: active ? '#1565c0' : '#fff',
            border: '1px solid #333',
            boxSizing: 'border-box',
            color: '#fff',
            display: 'inline-flex',
            fontSize: px(13),
            fontWeight: '700',
            height: px(16),
            justifyContent: 'center',
            marginLeft: 'auto',
            width: px(16),
        }),
    }, active ? '✓' : '') : undefined;

    return button({
        key,
        datatest,
        disabled,
        type: 'button',
        className: `editor-control${disabled ? ' disabled' : ''}`,
        'data-active': active ? 'true' : 'false',
        'aria-label': label,
        'aria-pressed': active ? 'true' : 'false',
        onclick: (event: MouseEvent) => {
            if (!disabled) {
                onclick();
            }
            event.preventDefault();
            event.stopPropagation();
        },
        style: style({
            alignItems: 'center',
            background: stateStyle.background,
            border: `1px solid ${disabled ? '#bdbdbd' : '#333'}`,
            borderRadius: '0',
            boxShadow: stateStyle.boxShadow,
            color: disabled ? '#bdbdbd' : stateStyle.color,
            cursor: disabled ? 'default' : 'pointer',
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
        ...(checkbox ? [checkboxIndicator!] : []),
    ]);
};

const readOverlayOffset = (element: HTMLElement) => {
    const storedX = element.getAttribute('data-overlay-x');
    const storedY = element.getAttribute('data-overlay-y');
    if (storedX !== null && storedY !== null) {
        return { x: Number(storedX), y: Number(storedY) };
    }
    const match = element.style.transform.match(/^translate\((-?\d+(?:\.\d+)?)px,\s*(-?\d+(?:\.\d+)?)px\)$/);
    return match === null ? { x: 0, y: 0 } : { x: Number(match[1]), y: Number(match[2]) };
};

const restoreOverlayOffset = (element: HTMLElement) => {
    const offset = readOverlayOffset(element);
    if (offset.x !== 0 || offset.y !== 0) {
        element.style.transform = `translate(${offset.x}px, ${offset.y}px)`;
    }
};

const startOverlayDrag = (event: PointerEvent) => {
    if (event.pointerType === 'mouse' && event.button !== 0) {
        return;
    }

    const handle = event.currentTarget as HTMLElement;
    const overlay = handle.parentElement as HTMLElement;
    const backdrop = overlay.parentElement as HTMLElement;
    const startOffset = readOverlayOffset(overlay);
    const overlayRect = overlay.getBoundingClientRect();
    const backdropRect = backdrop.getBoundingClientRect();
    const minX = startOffset.x + backdropRect.left + 8 - overlayRect.left;
    const maxX = startOffset.x + backdropRect.right - 8 - overlayRect.width - overlayRect.left;
    const minY = startOffset.y + backdropRect.top + 8 - overlayRect.top;
    const maxY = startOffset.y + backdropRect.bottom - 8 - overlayRect.height - overlayRect.top;

    const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max));
    const move = (moveEvent: PointerEvent) => {
        if (moveEvent.pointerId !== event.pointerId) {
            return;
        }
        const x = clamp(startOffset.x + moveEvent.clientX - event.clientX, minX, maxX);
        const y = clamp(startOffset.y + moveEvent.clientY - event.clientY, minY, maxY);
        overlay.style.transform = `translate(${x}px, ${y}px)`;
        overlay.setAttribute('data-overlay-x', String(x));
        overlay.setAttribute('data-overlay-y', String(y));
        moveEvent.preventDefault();
    };
    const stop = (stopEvent: PointerEvent) => {
        if (stopEvent.pointerId !== event.pointerId) {
            return;
        }
        document.removeEventListener('pointermove', move);
        document.removeEventListener('pointerup', stop);
        document.removeEventListener('pointercancel', stop);
        handle.style.cursor = 'grab';
    };

    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', stop);
    document.addEventListener('pointercancel', stop);
    handle.style.cursor = 'grabbing';
    event.preventDefault();
    event.stopPropagation();
};

// レール右端とパネル左端の間隔
const RAIL_ANCHOR_GAP = 16;
// 通常レイアウトのレール左マージン（editor_rail.ts の railStyle と対応）
const RAIL_MARGIN_LEFT = 8;

// field-top は「(HOLD列 +) 盤面 + レール」を中央寄せで並べる。その並びの実幅を返す。
export const editorContentWidth = (layout: EditorLayout): number => (
    layout.pieceQueue.visible
        ? layout.pieceQueue.width + layout.pieceQueue.gap
            + layout.field.size.width + PIECE_RIGHT_COLUMN_GAP + layout.buttons.size.width
        : layout.field.size.width + RAIL_MARGIN_LEFT + layout.buttons.size.width
);

// 中央寄せしたパネルを、レール右端の外側へ何px ずらすか。`availableWidth` はオーバーレイが
// 敷かれる領域（サイドパネルを除いたエディタ領域）の幅。
// レール右に置けるだけの幅がないときは、レールを覆わない従来位置（レールの左隣・右端寄せ）へ退避する。
// レイアウト未指定（List/Tree画面）は基準にするレールがないので null を返し、従来どおり右端寄せにする。
export const railAnchorOffset = (
    layout: EditorLayout | undefined, panelWidth: number, availableWidth: number,
): number | null => {
    if (layout === undefined) {
        return null;
    }
    const rightEdgeOffset = availableWidth / 2 - panelWidth / 2 - 8;
    const desired = editorContentWidth(layout) / 2 + panelWidth / 2 + RAIL_ANCHOR_GAP;
    if (desired <= rightEdgeOffset) {
        return desired;
    }
    return Math.max(0, rightEdgeOffset - (layout.buttons.size.width + 4));
};

const overlaySection = ({ key, datatest, label, children }: {
    key: string;
    datatest: string;
    label: string;
    children: VNode<{}>[];
}) => div({
    key,
    datatest,
    role: 'group',
    'aria-label': label,
    style: style({
        display: 'grid',
        gap: px(5),
    }),
}, [
    div({
        key: `${key}-heading`,
        datatest: `${datatest}-heading`,
        role: 'heading',
        'aria-level': 3,
        style: style({
            borderBottom: '1px solid #c7c7c7',
            color: '#555',
            fontSize: px(10),
            fontWeight: '700',
            letterSpacing: '.04em',
            lineHeight: px(16),
            padding: '0 2px 2px',
        }),
    }, label),
    ...children,
]);

export const editorOverlay = (state: State, actions: Actions, layout?: EditorLayout) => {
    const inspector = state.editorUi.inspector;
    if (inspector === 'none') {
        return undefined;
    }
    const page = state.fumen.pages[state.fumen.currentIndex];
    if (page === undefined) {
        return undefined;
    }
    // UTILSはメニュー項目を選ぶたびに閉じる。「開いたままにする」設定のときだけ閉じずに残し、
    // 併せて背景の暗転とクリック遮断も外して、メニューを開いたまま通常操作できるようにする。
    const pinned = inspector === 'utils' && state.mode.utilsMenuPinned;
    const closeAndRun = (run: () => void) => {
        if (!pinned) {
            actions.closeEditorInspector();
        }
        run();
    };
    const isEditorView = state.mode.screen === Screens.Editor;
    const utilities = [
        overlaySection({
            key: 'utils-current-page',
            datatest: 'utils-scope-current-page',
            label: i18n.EditorUi.UtilsCurrentPage(),
            children: [
                overlayButton({
                    key: 'btn-mirror', datatest: 'btn-mirror',
                    label: i18n.EditorUi.Mirror(), iconName: 'compare_arrows',
                    onclick: () => closeAndRun(actions.convertToMirror),
                }),
                overlayButton({
                    key: 'btn-convert-to-gray', datatest: 'btn-convert-to-gray',
                    label: i18n.EditorUi.ToGray(), iconName: 'color_lens',
                    onclick: () => closeAndRun(actions.convertToGray),
                }),
                overlayButton({
                    key: 'btn-convert-to-black', datatest: 'btn-convert-to-black',
                    label: i18n.EditorUi.ToBlack(), iconName: 'filter_b_and_w',
                    onclick: () => closeAndRun(actions.convertToBlack),
                }),
                overlayButton({
                    key: 'btn-spawn-mino-toggle', datatest: 'btn-spawn-mino-toggle',
                    label: i18n.EditorUi.SpawnMinoToggle.UtilsLabel(), iconName: 'swap_horiz',
                    // 一覧なので走査しやすさを優先し、トレイと違って方向でラベルを変えない
                    disabled: spawnMinoToggleDirection(state) === 'none',
                    onclick: () => closeAndRun(actions.toggleSpawnMinoAndBlocks),
                }),
                overlayButton({
                    key: 'btn-clear-field', datatest: 'btn-clear-field',
                    label: i18n.EditorUi.Clear(), iconName: 'clear',
                    danger: true,
                    onclick: () => closeAndRun(actions.clearField),
                }),
            ],
        }),
        overlaySection({
            key: 'utils-all-pages',
            datatest: 'utils-scope-all-pages',
            label: i18n.EditorUi.UtilsAllPages(),
            children: [
                overlayButton({
                    key: 'btn-all-mirror', datatest: 'btn-all-mirror', label: i18n.EditorUi.AllMirror(), iconName: 'compare_arrows',
                    onclick: () => closeAndRun(actions.convertAllToMirror),
                }),
                overlayButton({
                    key: 'btn-replace', datatest: 'btn-replace', label: i18n.ListViewReplace.Title(), iconName: 'find_replace',
                    onclick: () => closeAndRun(actions.openListViewReplaceModal),
                }),
                overlayButton({
                    key: 'btn-reset-all-comments', datatest: 'btn-reset-all-comments',
                    label: i18n.EditorUi.ResetAllComments(), iconName: 'speaker_notes_off',
                    danger: true,
                    onclick: () => closeAndRun(actions.resetAllCommentTexts),
                }),
            ],
        }),
        overlaySection({
            key: 'utils-replay',
            datatest: 'utils-scope-replay',
            label: i18n.Replay.Title(),
            children: [
                overlayButton({
                    key: 'btn-open-replay', datatest: 'btn-open-replay',
                    label: i18n.Replay.OpenMenu(), iconName: 'movie',
                    onclick: () => closeAndRun(actions.openReplayScreen),
                }),
            ],
        }),
        overlaySection({
            key: 'utils-pages',
            datatest: 'utils-scope-pages',
            label: i18n.EditorUi.UtilsPages(),
            children: [
                overlayButton({
                    key: 'btn-clear-past', datatest: 'btn-clear-past',
                    label: i18n.Menu.Buttons.ClearPast(), iconName: 'arrow_back',
                    danger: true,
                    disabled: state.fumen.currentIndex <= 0,
                    onclick: () => closeAndRun(actions.clearPast),
                }),
                overlayButton({
                    key: 'btn-clear-to-end', datatest: 'btn-clear-to-end',
                    label: i18n.Menu.Buttons.ClearToEnd(), iconName: 'arrow_forward',
                    danger: true,
                    disabled: state.fumen.maxPage - 1 <= state.fumen.currentIndex,
                    onclick: () => closeAndRun(actions.clearToEnd),
                }),
            ],
        }),
        ...(isEditorView ? [
            overlaySection({
                key: 'utils-editing-modes',
                datatest: 'utils-scope-editing-modes',
                label: i18n.EditorUi.UtilsModes(),
                children: [
                    overlayButton({
                        key: 'btn-slide-mode', datatest: 'btn-slide-mode', label: i18n.EditorUi.Slide(), iconName: 'swap_vert',
                        onclick: () => closeAndRun(actions.changeToShiftMode),
                    }),
                    overlayButton({
                        key: 'btn-comment-mode', datatest: 'btn-comment-mode',
                        label: i18n.EditorUi.Comment(), iconName: 'title',
                        onclick: () => closeAndRun(actions.changeToCommentMode),
                    }),
                ],
            }),
        ] : []),
    ];
    const keyPage = page.field.obj !== undefined;
    const flags = [
        overlayButton({
            key: 'btn-key-ref-page', datatest: `btn-key-page-${keyPage ? 'on' : 'off'}`,
            label: keyPage ? i18n.EditorUi.KeyPage() : i18n.EditorUi.ReferencePage(),
            iconName: keyPage ? 'vpn_key' : 'link', active: keyPage, checkbox: true,
            onclick: keyPage
                ? () => actions.changeToRef({ index: state.fumen.currentIndex })
                : () => actions.changeToKey({ index: state.fumen.currentIndex }),
        }),
        overlayButton({
            key: 'btn-lock-flag', datatest: `btn-lock-flag-${page.flags.lock ? 'on' : 'off'}`,
            label: i18n.EditorUi.Lock(), iconName: 'lock', active: page.flags.lock, checkbox: true,
            onclick: () => actions.changeLockFlag({ index: state.fumen.currentIndex, enable: !page.flags.lock }),
        }),
        overlayButton({
            key: 'btn-rise-flag', datatest: `btn-rise-flag-${page.flags.rise ? 'on' : 'off'}`,
            label: i18n.EditorUi.Rise(), iconName: 'vertical_align_top', active: page.flags.rise, checkbox: true,
            onclick: () => actions.changeRiseFlag({ index: state.fumen.currentIndex, enable: !page.flags.rise }),
        }),
        overlayButton({
            key: 'btn-mirror-flag', datatest: `btn-mirror-flag-${page.flags.mirror ? 'on' : 'off'}`,
            label: i18n.EditorUi.MirrorFlag(), iconName: 'flip', active: page.flags.mirror, checkbox: true,
            onclick: () => actions.changeMirrorFlag({ index: state.fumen.currentIndex, enable: !page.flags.mirror }),
        }),
    ];
    const title = inspector === 'utils' ? 'UTILS' : 'FLAGS';
    const panelWidth = Math.min(220, Math.max(150, (layout?.field.size.width ?? state.display.width) * .8));
    const anchorOffset = railAnchorOffset(layout, panelWidth, state.display.width - getSidePanelWidth(state));

    return div({
        key: 'editor-overlay-backdrop',
        datatest: `overlay-backdrop-${pinned ? 'pinned' : 'modal'}`,
        style: style({
            alignItems: 'flex-start',
            background: pinned ? 'transparent' : 'rgba(0, 0, 0, .08)',
            bottom: '0',
            display: 'flex',
            // レール右を基準に置くときは中央寄せしてから実測分だけ右へずらす。
            // 画面端寄せだと、盤面が中央に寄る広い画面でレールから大きく離れてしまうため。
            justifyContent: anchorOffset === null ? 'flex-end' : 'center',
            left: '0',
            padding: px(8),
            pointerEvents: pinned ? 'none' : 'auto',
            position: 'absolute',
            right: '0',
            top: '0',
            zIndex: 20,
        }),
        onclick: pinned ? undefined : actions.closeEditorInspector,
    }, [
        div({
            key: `overlay-${inspector}`,
            datatest: `overlay-${inspector}`,
            role: 'menu',
            tabIndex: -1,
            'aria-label': title,
            oncreate: (element: HTMLElement) => element.focus(),
            onupdate: restoreOverlayOffset,
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
                ...(anchorOffset === null
                    ? { marginRight: px(4) }
                    : { position: 'relative' as const, left: px(anchorOffset) }),
                maxHeight: `calc(100% - ${px(16)})`,
                overflowY: 'auto',
                padding: px(8),
                pointerEvents: 'auto',
                transform: 'translate(0px, 0px)',
                width: px(panelWidth),
            }),
        }, [
            div({
                key: 'overlay-heading',
                datatest: 'overlay-heading',
                onpointerdown: startOverlayDrag,
                style: style({
                    alignItems: 'center',
                    cursor: 'grab',
                    display: 'flex',
                    justifyContent: 'space-between',
                    touchAction: 'none',
                    userSelect: 'none',
                }),
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
                    onpointerdown: (event: PointerEvent) => event.stopPropagation(),
                    style: style({ background: 'transparent', border: '0', cursor: 'pointer', fontSize: px(20), padding: '0 4px' }),
                }, '×'),
            ]),
            ...(inspector === 'utils' ? utilities : flags),
        ]),
    ]);
};

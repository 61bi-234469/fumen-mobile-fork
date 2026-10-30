import { Component, px, style } from '../../lib/types';
import { h } from 'hyperapp';
import { ColdClearMenuQueueState } from '../../actions/cold_clear';
import { Piece } from '../../lib/enums';
import { InputGarbageSegment } from '../../lib/input_replay';
import { InputStateDescription } from '../../lib/input_snapshot';
import { InputRulesPreset } from '../../lib/input_stats';
import { i18n } from '../../locales/keys';
import { InputWindowTab, PieceQueueFocus, resources, RotationSystem, UserSettingsTab } from '../../states';
import { EDITOR_ACTIVE_COLOR } from '../../views/editor/editor_control_style';
import { InputGarbagePane } from './input_garbage';
import { InputStatePane } from './input_state';
import { PieceQueuePane } from './piece_queue';

declare const M: any;

interface InputWindowModalProps {
    tab: InputWindowTab;
    // undefined when the current page cannot be shared (same resolution as the share action)
    description: InputStateDescription | undefined;
    preset: InputRulesPreset;
    rotationSystem: RotationSystem;
    garbageSegments: InputGarbageSegment[];
    currentQueueState: ColdClearMenuQueueState | null;
    canClearComment: boolean;
    pieceQueueFocus: PieceQueueFocus;
    actions: {
        selectInputWindowTab: (data: { tab: InputWindowTab }) => void;
        closeInputWindow: () => void;
        setInputChainCounters: (data: { b2bChain?: number; renChain?: number }) => void;
        openUserSettingsModal: (data?: { initialTab?: UserSettingsTab }) => void;
        copyInputShareUrlToClipboard: (data?: { native?: boolean }) => void;
        updateInputGarbageDraft: (data: { segments: InputGarbageSegment[] }) => void;
        previewColdClearQueueComment: (data: {
            hold: Piece | null;
            current: Piece | null;
            queue: Piece[];
            b2b: boolean | number;
            combo: number;
            syncCurrentPiece?: boolean;
        }) => void;
        clearCommentForColdClearQueue: () => void;
        appendColdClearOneBagToComment: () => void;
    };
}

const TABS: InputWindowTab[] = ['queue', 'state', 'garbage'];

const tabLabel = (tab: InputWindowTab): string => {
    switch (tab) {
    case 'state':
        return i18n.InputWindow.Tabs.State();
    case 'garbage':
        return i18n.InputWindow.Tabs.Garbage();
    case 'queue':
        return i18n.InputWindow.Tabs.Queue();
    }
};

export const InputWindowModal: Component<InputWindowModalProps> = (props) => {
    const { tab, actions } = props;
    const destroy = () => {
        resources.modals.inputWindow = undefined;
    };

    const close = () => {
        actions.closeInputWindow();
        const modal = resources.modals.inputWindow;
        if (modal !== undefined) {
            modal.close();
        }
        destroy();
    };

    const oncreate = (element: HTMLDivElement) => {
        const instance = M.Modal.init(element, {
            onCloseStart: () => {
                actions.closeInputWindow();
                destroy();
            },
        });

        instance.open();
        resources.modals.inputWindow = instance;
    };

    // Shared by every tab for now. Closing first applies the garbage draft and commits the queue,
    // so the URL carries what the window shows.
    const share = (native: boolean) => {
        close();
        actions.copyInputShareUrlToClipboard({ native });
    };

    const nativeShareAvailable = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
    const shareButtonStyle = {
        alignItems: 'center', color: EDITOR_ACTIVE_COLOR, display: 'flex', fontSize: px(13), height: px(32),
        lineHeight: px(32), padding: '0 8px', textTransform: 'none',
    } as const;

    const pane = () => {
        switch (tab) {
        case 'state':
            return props.description === undefined ? undefined as any : InputStatePane({
                actions,
                description: props.description,
                preset: props.preset,
                rotationSystem: props.rotationSystem,
                // Closing applies the garbage draft and commits the queue, as the close button does.
                openRotationSettings: () => {
                    close();
                    actions.openUserSettingsModal({ initialTab: 'input' });
                },
            });
        case 'garbage':
            return InputGarbagePane({ actions, segments: props.garbageSegments });
        case 'queue':
            return PieceQueuePane({
                actions,
                currentQueueState: props.currentQueueState,
                canClearComment: props.canClearComment,
                initialFocus: props.pieceQueueFocus,
            });
        }
    };

    return (
        <div key="input-window-modal-top">
            <div key="mdl-input-window" datatest="mdl-input-window" data-tab={tab}
                 className="modal modal-fixed-footer" oncreate={oncreate}
                 style={style({ height: `min(${px(460)}, 75%)`, maxWidth: px(480), width: '92%' })}>
                {/* A fixed height keeps the window still when tabs of different lengths swap in. */}
                {/* A column so a pane can fill the fixed height and pin controls to its bottom. No bottom
                    padding: a sticky bottom row stops at the padding edge and rows would show beneath it. */}
                <div key="modal-content" className="modal-content" style={style({
                    display: 'flex', flexDirection: 'column', paddingBottom: '0', paddingTop: '0',
                })}>
                    {/* Above the panes' waves-effect buttons (z-index 1) and the garbage add row (2). */}
                    <div key="header" style={style({
                        background: '#fff', flexShrink: 0, paddingTop: px(12), position: 'sticky', top: '0', zIndex: 3,
                    })}>
                        {/* Share lives up here, away from Close, so finishing an edit never shares by mistake. */}
                        <div key="title-row" style={style({ alignItems: 'center', display: 'flex', gap: px(4) })}>
                            <div key="title" style={style({
                                color: '#333', flexGrow: 1, fontSize: px(20), fontWeight: '500', lineHeight: px(28),
                            })}>
                                {i18n.InputWindow.Title()}
                            </div>
                            <a href="#" key="btn-share" datatest="btn-input-share-url"
                               className="waves-effect waves-teal btn-flat"
                               title={i18n.InputState.Share()}
                               style={style(shareButtonStyle)}
                               onclick={(event: MouseEvent) => {
                                   event.preventDefault();
                                   share(false);
                               }}>
                                <i key="icon" className="material-icons notranslate"
                                   style={style({ fontSize: px(20), marginRight: px(4) })}>link</i>
                                {i18n.InputState.Share()}
                            </a>
                            {nativeShareAvailable ? (
                                <a href="#" key="btn-share-native" datatest="btn-input-share-native"
                                   className="waves-effect waves-teal btn-flat"
                                   title={i18n.InputState.NativeShare()}
                                   aria-label={i18n.InputState.NativeShare()}
                                   style={style({ ...shareButtonStyle, padding: '0 6px' })}
                                   onclick={(event: MouseEvent) => {
                                       event.preventDefault();
                                       share(true);
                                   }}>
                                    <i key="icon" className="material-icons notranslate"
                                       style={style({ fontSize: px(20) })}>share</i>
                                </a>
                            ) : undefined as any}
                        </div>
                        <div key="tabs" role="tablist" style={style({
                            borderBottom: 'solid 1px #ddd', display: 'flex', marginTop: px(8),
                        })}>
                            {TABS.map(current => (
                                <a href="#" key={`tab-input-window-${current}`} datatest={`tab-input-window-${current}`}
                                   role="tab" aria-selected={tab === current ? 'true' : 'false'}
                                   style={style({
                                       borderBottom: tab === current
                                           ? `solid 2px ${EDITOR_ACTIVE_COLOR}` : 'solid 2px transparent',
                                       color: tab === current ? EDITOR_ACTIVE_COLOR : '#666',
                                       cursor: 'pointer',
                                       flexGrow: 1,
                                       fontSize: px(13),
                                       fontWeight: tab === current ? 'bold' : 'normal',
                                       padding: '8px 4px',
                                       textAlign: 'center',
                                       whiteSpace: 'nowrap',
                                   })}
                                   onclick={(event: MouseEvent) => {
                                       event.preventDefault();
                                       event.stopPropagation();
                                       actions.selectInputWindowTab({ tab: current });
                                   }}>
                                    {tabLabel(current)}
                                </a>
                            ))}
                        </div>
                    </div>
                    <div key="pane" style={style({
                        color: '#333', display: 'flex', flex: '1 0 auto', flexDirection: 'column', marginTop: px(12),
                    })}>
                        {pane()}
                    </div>
                </div>

                <div key="modal-footer" className="modal-footer">
                    <a href="#" key="btn-close" datatest="btn-input-window-close"
                       className="waves-effect waves-teal btn-flat"
                       onclick={(event: MouseEvent) => {
                           event.preventDefault();
                           close();
                       }}>
                        {i18n.InputWindow.Close()}
                    </a>
                </div>
            </div>
        </div>
    );
};

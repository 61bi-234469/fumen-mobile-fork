import { Component, px, style } from '../../lib/types';
import { h } from 'hyperapp';
import { resources } from '../../states';
import { Piece } from '../../lib/enums';
import { i18n } from '../../locales/keys';
import {
    COLD_CLEAR_NEXT_LIMIT_DEFAULT,
    COLD_CLEAR_NEXT_LIMIT_MAX,
    COLD_CLEAR_NEXT_LIMIT_MIN,
    COLD_CLEAR_TOP_BRANCH_COUNT_MAX,
    COLD_CLEAR_TOP_BRANCH_COUNT_MIN,
    COLD_CLEAR_THINK_MS_PRESETS,
} from '../../actions/cold_clear';
import {
    parsePieceHoldText,
    parsePieceQueueText,
    PIECE_QUEUE_ORDER,
    PIECE_QUEUE_TO_CHAR,
    pieceQueueToText,
} from '../../lib/piece_queue';

declare const M: any;

interface ColdClearQueueState {
    hold: Piece | null;
    current: Piece | null;
    queue: Piece[];
    b2b: boolean;
    combo: number;
    score: number | null;
}

interface ColdClearMenuModalProps {
    isRunning: boolean;
    progress: { current: number; total: number } | null;
    topBranchCount: number;
    holdAllowed: boolean;
    speculate: boolean;
    nextLimit: number | null;
    weightsPreset: number;
    thinkMs: number;
    currentQueueState: ColdClearQueueState | null;
    canSequenceSearch: boolean;
    canTopBranchesSearch: boolean;
    canPlacedSpawnScore: boolean;
    searchBlockedByHoldQueue: boolean;
    canClearComment: boolean;
    actions: {
        closeColdClearMenuModal: () => void;
        startColdClearSearch: () => void;
        startColdClearTopThreeSearch: () => void;
        setColdClearTopBranchCount: (data: { count: number }) => void;
        setColdClearHoldAllowed: (data: { holdAllowed: boolean }) => void;
        setColdClearSpeculate: (data: { speculate: boolean }) => void;
        setColdClearNextLimit: (data: { nextLimit: number | null }) => void;
        setColdClearWeightsPreset: (data: { weightsPreset: number }) => void;
        setColdClearThinkMs: (data: { thinkMs: number }) => void;
        previewColdClearQueueComment: (data: {
            hold: Piece | null;
            current: Piece | null;
            queue: Piece[];
            b2b: boolean;
            combo: number;
        }) => void;
        commitColdClearQueueComment: () => void;
        clearCommentForColdClearQueue: () => void;
        evaluatePlacedSpawnMinoScore: () => void;
        appendColdClearOneBagToComment: () => void;
        stopColdClearSearch: () => void;
    };
}

type MenuItem = {
    key: string;
    datatest: string;
    iconName: string;
    title: string;
    description: string;
    warning?: string;
    enabled: boolean;
    danger?: boolean;
    onclick: () => void;
    onDisabledClick?: () => void;
};

const PIECE_ORDER = PIECE_QUEUE_ORDER;
const PIECE_TO_CHAR = PIECE_QUEUE_TO_CHAR;
const toQueueText = pieceQueueToText;
const parseQueueText = parsePieceQueueText;
const parseHoldText = parsePieceHoldText;

type QueueFocusTarget = 'hold' | 'current' | 'next';
let queueFocusTarget: QueueFocusTarget = 'next';

export const ColdClearMenuModal: Component<ColdClearMenuModalProps> = (
    {
        isRunning,
        progress,
        topBranchCount,
        holdAllowed,
        speculate,
        nextLimit,
        weightsPreset,
        thinkMs,
        currentQueueState,
        canSequenceSearch,
        canTopBranchesSearch,
        canPlacedSpawnScore,
        searchBlockedByHoldQueue,
        canClearComment,
        actions,
    },
) => {
    const syncRunningState = (element: HTMLDivElement) => {
        element.dataset.coldClearRunning = isRunning ? '1' : '0';
    };

    const close = () => {
        const modal = resources.modals.coldClearMenu;
        if (modal !== undefined) {
            modal.close();
        }
    };

    const destroy = () => {
        resources.modals.coldClearMenu = undefined;
    };

    const closeMenu = () => {
        if (isRunning) {
            return;
        }
        actions.commitColdClearQueueComment();
        actions.closeColdClearMenuModal();
        close();
        destroy();
    };

    const oncreate = (element: HTMLDivElement) => {
        syncRunningState(element);
        const instance = M.Modal.init(element, {
            onCloseStart: () => {
                if (element.dataset.coldClearRunning === '1') {
                    const modal = resources.modals.coldClearMenu;
                    if (modal) {
                        setTimeout(() => modal.open(), 0);
                    }
                    return;
                }
                actions.commitColdClearQueueComment();
                actions.closeColdClearMenuModal();
                destroy();
            },
        });

        instance.open();
        resources.modals.coldClearMenu = instance;
    };

    const ondestroy = () => {
        close();
        destroy();
    };

    const contentStyle = style({
        padding: '0px',
    });
    const sectionStyle = style({
        margin: '0px',
        padding: `${px(10)} ${px(20)} 0px ${px(20)}`,
    });
    const headerStyle = style({
        margin: '0px',
        padding: `${px(14)} ${px(20)}`,
        borderBottom: '1px solid #eee',
        fontSize: px(20),
    });
    const progressStyle = style({
        margin: '0px',
        padding: `${px(10)} ${px(20)} 0px ${px(20)}`,
        color: '#666',
        fontSize: px(12),
    });
    const sectionTitleStyle = style({
        margin: '0px',
        padding: `${px(8)} 0px`,
        fontSize: px(14),
        fontWeight: 700,
        color: '#111827',
        borderTop: '2px solid #e5e7eb',
    });
    const rowStyle = style({
        margin: `${px(8)} 0px`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: px(12),
    });
    const labelStyle = style({
        margin: '0px',
        color: '#374151',
        fontSize: px(13),
        fontWeight: 700,
    });
    const descriptionStyle = style({
        margin: `${px(2)} 0px 0px 0px`,
        color: '#6b7280',
        fontSize: px(11),
    });
    const menuItemWarningStyle = style({
        margin: `${px(2)} 0px 0px 0px`,
        color: '#e65100',
        fontSize: px(11),
        fontWeight: 600,
    });
    const numberInputStyle = style({
        width: px(84),
        margin: '0px',
        textAlign: 'center',
        height: px(32),
    });
    const textInputStyle = style({
        width: '100%',
        margin: '0px',
        height: px(34),
        boxSizing: 'border-box',
    });
    const checkboxStyle = style({
        margin: '0px',
    });
    const menuListStyle = style({
        margin: '0px',
        padding: `${px(8)} ${px(10)} ${px(12)} ${px(10)}`,
        display: 'flex',
        flexDirection: 'column',
        gap: px(8),
    });
    const queueButtonsStyle = style({
        display: 'flex',
        flexWrap: 'wrap',
        gap: px(6),
        marginTop: px(8),
    });
    const queueButtonStyle = style({
        minWidth: px(34),
        height: px(30),
        border: '1px solid #cbd5e1',
        borderRadius: '6px',
        background: '#fff',
        cursor: isRunning ? 'not-allowed' : 'pointer',
    });
    const summaryStyle = style({
        margin: `${px(6)} 0px`,
        color: '#4b5563',
        fontSize: px(12),
    });
    const warningStyle = style({
        margin: `${px(4)} 0px`,
        color: '#92400e',
        fontSize: px(12),
    });

    const commitTopBranchCount = (event: Event) => {
        const target = event.target as HTMLInputElement;
        const value = Number(target.value);
        // The action clamps to [MIN, MAX]; only reject non-integers here.
        if (!Number.isInteger(value)) {
            return;
        }
        actions.setColdClearTopBranchCount({ count: value });
    };

    // Reflect the typed value on every keystroke so the controlled `value`
    // never rewinds to the old state between `.type()` and the change commit
    // (the CI flake in cold_clear_spec.js:84). Skip transient empty input so
    // the field can be cleared while editing; blur normalizes it via onchange.
    const onInputTopBranchCount = (event: Event) => {
        const target = event.target as HTMLInputElement;
        if (target.value === '') {
            return;
        }
        commitTopBranchCount(event);
    };

    const applyFocusHighlight = (target: QueueFocusTarget) => {
        const panes: QueueFocusTarget[] = ['hold', 'current', 'next'];
        for (const pane of panes) {
            const paneElement = document.querySelector(
                `[datatest="pane-cold-clear-${pane}"]`,
            ) as HTMLElement | null;
            if (paneElement) {
                paneElement.style.border = target === pane ? '2px solid #3b82f6' : '2px solid #e5e7eb';
                paneElement.style.background = target === pane ? '#eff6ff' : '#fff';
                const label = paneElement.querySelector('p') as HTMLElement | null;
                if (label) {
                    label.style.color = target === pane ? '#2563eb' : '#374151';
                }
            }
        }
        const oneBagBtn = document
            .querySelector('[datatest="btn-cold-clear-append-one-bag"]') as HTMLButtonElement | null;
        if (oneBagBtn) {
            oneBagBtn.disabled = isRunning || target !== 'next';
        }
    };

    const setQueueFocus = (target: QueueFocusTarget) => {
        queueFocusTarget = target;
        applyFocusHighlight(target);
    };

    const queueEditorDisabled = isRunning || currentQueueState === null;
    const updateQueueState = (
        updater: (current: ColdClearQueueState) => {
            hold: Piece | null;
            current: Piece | null;
            queue: Piece[];
            b2b: boolean;
            combo: number;
        },
    ) => {
        if (queueEditorDisabled || currentQueueState === null) {
            return;
        }
        const next = updater(currentQueueState);
        actions.previewColdClearQueueComment({
            hold: next.hold,
            current: next.current,
            queue: next.queue,
            b2b: next.b2b,
            combo: Math.max(0, Math.floor(next.combo)),
        });
    };

    const itemStyle = (enabled: boolean, danger: boolean, clickable: boolean) => style({
        width: '100%',
        border: 'none',
        borderRadius: '12px',
        padding: `${px(12)} ${px(14)}`,
        display: 'flex',
        alignItems: 'center',
        gap: px(12),
        backgroundColor: enabled ? (danger ? '#ffebee' : '#f7f9fc') : '#f2f2f2',
        color: enabled ? (danger ? '#c62828' : '#1f2937') : '#9e9e9e',
        cursor: clickable ? 'pointer' : 'default',
        textAlign: 'left',
    });
    const iconStyle = (enabled: boolean, danger: boolean) => style({
        fontSize: px(32),
        width: px(32),
        color: enabled ? (danger ? '#d32f2f' : '#1565c0') : '#bdbdbd',
    });
    const titleStyle = style({
        margin: '0px',
        fontSize: px(17),
        fontWeight: 700,
        lineHeight: '1.2',
    });
    const itemDescriptionStyle = (enabled: boolean) => style({
        margin: `${px(2)} 0px 0px 0px`,
        fontSize: px(12),
        color: enabled ? '#6b7280' : '#9e9e9e',
        lineHeight: '1.25',
    });

    const items: MenuItem[] = [
        ...(isRunning ? [{
            key: 'btn-cold-clear-stop-action',
            datatest: 'btn-cold-clear-stop-action',
            iconName: 'stop_circle',
            title: i18n.ColdClear.StopSearchLabel(),
            description: i18n.ColdClear.StopSearchDescription(),
            enabled: true,
            danger: true,
            onclick: () => {
                actions.stopColdClearSearch();
            },
        }] : []),
        {
            key: 'btn-cold-clear-sequence-search',
            datatest: 'btn-cold-clear-sequence-search',
            iconName: 'timeline',
            title: i18n.ColdClear.SequenceSearchLabel(),
            description: i18n.ColdClear.SequenceSearchDescription(),
            warning: (thinkMs >= 5000 && speculate && nextLimit === null)
                ? i18n.ColdClear.SequenceSearchCrashWarning() : undefined,
            enabled: !isRunning && canSequenceSearch,
            onclick: () => {
                actions.startColdClearSearch();
            },
            onDisabledClick: () => {
                if (!isRunning) {
                    if (searchBlockedByHoldQueue) {
                        const msg = i18n.ColdClear.InsufficientQueueForHold();
                        M.toast({ html: msg, classes: 'top-toast', displayLength: 1500 });
                    } else {
                        actions.startColdClearSearch();
                    }
                }
            },
        },
        {
            key: 'btn-cold-clear-top-branches-search',
            datatest: 'btn-cold-clear-top-branches-search',
            iconName: 'account_tree',
            title: i18n.ColdClear.TopBranchesSearchLabel(),
            description: i18n.ColdClear.TopBranchesSearchDescription(topBranchCount),
            enabled: !isRunning && canTopBranchesSearch,
            onclick: () => {
                actions.startColdClearTopThreeSearch();
            },
            onDisabledClick: () => {
                if (!isRunning) {
                    if (searchBlockedByHoldQueue) {
                        const msg = i18n.ColdClear.InsufficientQueueForHold();
                        M.toast({ html: msg, classes: 'top-toast', displayLength: 1500 });
                    } else {
                        actions.startColdClearTopThreeSearch();
                    }
                }
            },
        },
        {
            key: 'btn-cold-clear-evaluate-placed-spawn-score',
            datatest: 'btn-cold-clear-evaluate-placed-spawn-score',
            iconName: 'grade',
            title: i18n.ColdClear.EvaluatePlacedSpawnScoreLabel(),
            description: i18n.ColdClear.EvaluatePlacedSpawnScoreDescription(),
            enabled: !isRunning && canPlacedSpawnScore,
            onclick: () => {
                actions.evaluatePlacedSpawnMinoScore();
            },
            onDisabledClick: () => {
                if (!isRunning) {
                    actions.evaluatePlacedSpawnMinoScore();
                }
            },
        },
    ];

    return (
        <div key="cold-clear-menu-modal-top">
            <div
                key="mdl-cold-clear-menu"
                datatest="mdl-cold-clear-menu"
                className="modal bottom-sheet"
                oncreate={oncreate}
                onupdate={syncRunningState}
                ondestroy={ondestroy}
            >
                <div key="cold-clear-menu-content" className="modal-content" style={contentStyle}>
                    <h4 key="cold-clear-menu-title" style={headerStyle}>{i18n.ColdClear.MenuTitle()}</h4>
                    {isRunning && progress
                        ? <p key="cold-clear-progress" style={progressStyle}>
                            {i18n.ColdClear.Progress(progress.current, progress.total)}
                        </p>
                        : undefined}

                    <div key="cold-clear-menu-list" style={menuListStyle}>
                        {items.map((item) => {
                            const clickable = item.enabled || item.onDisabledClick !== undefined;
                            return h('button', {
                                key: item.key,
                                datatest: item.datatest,
                                style: itemStyle(item.enabled, item.danger ?? false, clickable),
                                'aria-disabled': !item.enabled,
                                onclick: (event: MouseEvent) => {
                                    event.preventDefault();
                                    if (!item.enabled) {
                                        item.onDisabledClick?.();
                                        return;
                                    }
                                    item.onclick();
                                },
                            }, [
                                h('i', {
                                    key: `${item.key}-icon`,
                                    className: 'material-icons',
                                    style: iconStyle(item.enabled, item.danger ?? false),
                                }, item.iconName),
                                h('div', { key: `${item.key}-texts`, style: style({ flex: 1 }) }, [
                                    h('p', { key: `${item.key}-title`, style: titleStyle }, item.title),
                                    h('p', {
                                        key: `${item.key}-description`,
                                        style: itemDescriptionStyle(item.enabled),
                                    }, item.description),
                                    ...(item.warning ? [h('p', {
                                        key: `${item.key}-warning`,
                                        style: menuItemWarningStyle,
                                    }, `⚠ ${item.warning}`)] : []),
                                ]),
                            ]);
                        })}
                    </div>

                    <div key="cold-clear-queue-state" style={sectionStyle}>
                        <p style={sectionTitleStyle}>{i18n.ColdClear.QueueStateSectionTitle()}</p>
                        {!currentQueueState
                            ? (canClearComment
                                ? <div>
                                    <p style={descriptionStyle}>{i18n.ColdClear.QueueStateUnavailable()}</p>
                                    <button
                                        key="btn-cold-clear-clear-comment"
                                        datatest="btn-cold-clear-clear-comment"
                                        disabled={isRunning}
                                        onclick={(event: MouseEvent) => {
                                            event.preventDefault();
                                            actions.clearCommentForColdClearQueue();
                                        }}
                                        style={style({
                                            width: '100%',
                                            marginTop: px(8),
                                            padding: `${px(8)} ${px(12)}`,
                                            border: '1px solid #e5e7eb',
                                            borderRadius: '6px',
                                            background: '#fff',
                                            cursor: isRunning ? 'default' : 'pointer',
                                            fontSize: px(13),
                                            color: '#2563eb',
                                        })}
                                    >
                                        {i18n.ColdClear.QueueStateClearAndEdit()}
                                    </button>
                                </div>
                                : <p style={descriptionStyle}>{i18n.ColdClear.QueueStateUnavailable()}</p>
                            )
                            : [
                                <p key="cold-clear-queue-summary" style={summaryStyle}>
                                    {i18n.ColdClear.QueueStateSummary(
                                        currentQueueState.hold === null ? '' : PIECE_TO_CHAR[currentQueueState.hold],
                                        currentQueueState.current === null
                                            ? '' : PIECE_TO_CHAR[currentQueueState.current],
                                        toQueueText(currentQueueState.queue),
                                    )}
                                </p>,
                                currentQueueState.score !== null
                                    ? <p key="cold-clear-score-summary" style={summaryStyle}>
                                        {i18n.ColdClear.QueueStateScore(currentQueueState.score.toFixed(2))}
                                    </p>
                                    : undefined as any,
                                <div key="cold-clear-hold-next-row" style={style({
                                    display: 'flex',
                                    gap: px(8),
                                    marginTop: px(8),
                                })}>
                                    <div
                                        key="cold-clear-hold-pane"
                                        datatest="pane-cold-clear-hold"
                                        onclick={() => {
                                            setQueueFocus('hold');
                                        }}
                                        style={style({
                                            flex: '1',
                                            minWidth: '0',
                                            padding: px(8),
                                            borderRadius: '6px',
                                            cursor: queueEditorDisabled ? 'default' : 'pointer',
                                            border: queueFocusTarget === 'hold'
                                                ? '2px solid #3b82f6'
                                                : '2px solid #e5e7eb',
                                            background: queueFocusTarget === 'hold'
                                                ? '#eff6ff'
                                                : '#fff',
                                        })}
                                    >
                                        <p style={style({
                                            margin: '0px',
                                            fontSize: px(11),
                                            fontWeight: 700,
                                            color: queueFocusTarget === 'hold' ? '#2563eb' : '#374151',
                                            marginBottom: px(4),
                                        })}>{i18n.ColdClear.QueueHoldLabel()}</p>
                                        <input
                                            datatest="input-cold-clear-queue-hold"
                                            type="text"
                                            maxLength={1}
                                            value={
                                                currentQueueState.hold === null
                                                    ? ''
                                                    : PIECE_TO_CHAR[currentQueueState.hold]
                                            }
                                            disabled={queueEditorDisabled}
                                            onfocus={() => {
                                                setQueueFocus('hold');
                                            }}
                                            onchange={(event: Event) => {
                                                const target = event.target as HTMLInputElement;
                                                const parsed = parseHoldText(target.value);
                                                if (parsed === undefined) {
                                                    return;
                                                }
                                                updateQueueState(queueState => ({
                                                    ...queueState,
                                                    hold: parsed,
                                                }));
                                            }}
                                            style={style({
                                                width: '100%',
                                                margin: '0px',
                                                textAlign: 'center',
                                                height: px(32),
                                                boxSizing: 'border-box',
                                            })}
                                        />
                                    </div>
                                    <div
                                        key="cold-clear-current-pane"
                                        datatest="pane-cold-clear-current"
                                        onclick={() => {
                                            setQueueFocus('current');
                                        }}
                                        style={style({
                                            flex: '1',
                                            minWidth: '0',
                                            padding: px(8),
                                            borderRadius: '6px',
                                            cursor: queueEditorDisabled ? 'default' : 'pointer',
                                            border: queueFocusTarget === 'current'
                                                ? '2px solid #3b82f6'
                                                : '2px solid #e5e7eb',
                                            background: queueFocusTarget === 'current'
                                                ? '#eff6ff'
                                                : '#fff',
                                        })}
                                    >
                                        <p style={style({
                                            margin: '0px',
                                            fontSize: px(11),
                                            fontWeight: 700,
                                            color: queueFocusTarget === 'current' ? '#2563eb' : '#374151',
                                            marginBottom: px(4),
                                        })}>{i18n.ColdClear.QueueCurrentLabel()}</p>
                                        <input
                                            datatest="input-cold-clear-queue-current"
                                            type="text"
                                            maxLength={1}
                                            value={
                                                currentQueueState.current === null
                                                    ? ''
                                                    : PIECE_TO_CHAR[currentQueueState.current]
                                            }
                                            disabled={queueEditorDisabled}
                                            onfocus={() => {
                                                setQueueFocus('current');
                                            }}
                                            onchange={(event: Event) => {
                                                const target = event.target as HTMLInputElement;
                                                const parsed = parseHoldText(target.value);
                                                if (parsed === undefined) {
                                                    return;
                                                }
                                                updateQueueState(queueState => ({
                                                    ...queueState,
                                                    current: parsed,
                                                }));
                                            }}
                                            style={style({
                                                width: '100%',
                                                margin: '0px',
                                                textAlign: 'center',
                                                height: px(32),
                                                boxSizing: 'border-box',
                                            })}
                                        />
                                    </div>
                                    <div
                                        key="cold-clear-next-pane"
                                        datatest="pane-cold-clear-next"
                                        onclick={() => {
                                            setQueueFocus('next');
                                        }}
                                        style={style({
                                            flex: '2',
                                            minWidth: '0',
                                            padding: px(8),
                                            borderRadius: '6px',
                                            cursor: queueEditorDisabled ? 'default' : 'pointer',
                                            border: queueFocusTarget === 'next'
                                                ? '2px solid #3b82f6'
                                                : '2px solid #e5e7eb',
                                            background: queueFocusTarget === 'next'
                                                ? '#eff6ff'
                                                : '#fff',
                                        })}
                                    >
                                        <p style={style({
                                            margin: '0px',
                                            fontSize: px(11),
                                            fontWeight: 700,
                                            color: queueFocusTarget === 'next' ? '#2563eb' : '#374151',
                                            marginBottom: px(4),
                                        })}>{i18n.ColdClear.QueuePiecesLabel()}</p>
                                        <input
                                            datatest="input-cold-clear-queue"
                                            type="text"
                                            value={toQueueText(currentQueueState.queue)}
                                            disabled={queueEditorDisabled}
                                            onfocus={() => {
                                                setQueueFocus('next');
                                            }}
                                            onchange={(event: Event) => {
                                                const target = event.target as HTMLInputElement;
                                                const parsed = parseQueueText(target.value);
                                                if (parsed === null) {
                                                    return;
                                                }
                                                updateQueueState(queueState => ({
                                                    ...queueState,
                                                    queue: parsed,
                                                }));
                                            }}
                                            style={textInputStyle}
                                        />
                                    </div>
                                </div>,
                                <div key="cold-clear-queue-buttons-row" style={queueButtonsStyle}>
                                    {PIECE_ORDER.map(piece => (
                                        <button
                                            key={`cold-clear-add-piece-${PIECE_TO_CHAR[piece]}`}
                                            datatest={`btn-cold-clear-queue-add-${PIECE_TO_CHAR[piece]}`}
                                            disabled={queueEditorDisabled}
                                            onclick={(event: MouseEvent) => {
                                                event.preventDefault();
                                                if (queueFocusTarget === 'hold') {
                                                    updateQueueState(queueState => ({
                                                        ...queueState,
                                                        hold: piece,
                                                    }));
                                                } else if (queueFocusTarget === 'current') {
                                                    updateQueueState(queueState => ({
                                                        ...queueState,
                                                        current: piece,
                                                    }));
                                                } else {
                                                    updateQueueState(queueState => ({
                                                        ...queueState,
                                                        queue: queueState.queue.concat(piece),
                                                    }));
                                                }
                                            }}
                                            style={queueButtonStyle}
                                        >
                                            {PIECE_TO_CHAR[piece]}
                                        </button>
                                    ))}
                                    <button
                                        key="cold-clear-clear-target"
                                        datatest="btn-cold-clear-queue-clear"
                                        disabled={queueEditorDisabled}
                                        onclick={(event: MouseEvent) => {
                                            event.preventDefault();
                                            if (queueFocusTarget === 'hold') {
                                                updateQueueState(queueState => ({
                                                    ...queueState,
                                                    hold: null,
                                                }));
                                            } else if (queueFocusTarget === 'current') {
                                                updateQueueState(queueState => ({
                                                    ...queueState,
                                                    current: null,
                                                }));
                                            } else {
                                                updateQueueState(queueState => ({
                                                    ...queueState,
                                                    queue: [],
                                                }));
                                            }
                                        }}
                                        style={queueButtonStyle}
                                    >
                                        {i18n.ColdClear.QueueClearLabel()}
                                    </button>
                                    <button
                                        key="cold-clear-append-one-bag"
                                        datatest="btn-cold-clear-append-one-bag"
                                        disabled={isRunning || queueFocusTarget !== 'next'}
                                        onclick={(event: MouseEvent) => {
                                            event.preventDefault();
                                            actions.appendColdClearOneBagToComment();
                                        }}
                                        style={queueButtonStyle}
                                    >
                                        {i18n.ColdClear.OneBagAddShortLabel()}
                                    </button>
                                </div>,
                                <div key="cold-clear-b2b-combo-row" style={rowStyle}>
                                    <p style={labelStyle}>{i18n.ColdClear.QueueB2BLabel()}</p>
                                    <label>
                                        <input
                                            datatest="toggle-cold-clear-queue-b2b"
                                            type="checkbox"
                                            checked={currentQueueState.b2b}
                                            disabled={queueEditorDisabled}
                                            onchange={(event: Event) => {
                                                const target = event.target as HTMLInputElement;
                                                updateQueueState(queueState => ({
                                                    ...queueState,
                                                    b2b: target.checked,
                                                }));
                                            }}
                                        />
                                        <span />
                                    </label>
                                    <div style={style({ width: px(16) })} />
                                    <p style={labelStyle}>{i18n.ColdClear.QueueComboLabel()}</p>
                                    <input
                                        datatest="input-cold-clear-queue-combo"
                                        type="number"
                                        value={currentQueueState.combo}
                                        min={0}
                                        step={1}
                                        disabled={queueEditorDisabled}
                                        onchange={(event: Event) => {
                                            const target = event.target as HTMLInputElement;
                                            const combo = Number(target.value);
                                            if (Number.isNaN(combo)) {
                                                return;
                                            }
                                            updateQueueState(queueState => ({
                                                ...queueState,
                                                combo: Math.max(0, Math.floor(combo)),
                                            }));
                                        }}
                                        style={numberInputStyle}
                                    />
                                </div>,
                            ]}
                    </div>

                    <div key="cold-clear-settings" style={sectionStyle}>
                        <p style={sectionTitleStyle}>{i18n.ColdClear.SettingsSectionTitle()}</p>

                        <div key="cold-clear-hold-allowed-row" style={rowStyle}>
                            <div>
                                <p style={labelStyle}>{i18n.ColdClear.HoldAllowedLabel()}</p>
                                <p style={descriptionStyle}>{i18n.ColdClear.HoldAllowedDescription()}</p>
                            </div>
                            <label>
                                <input
                                    datatest="toggle-cold-clear-hold-allowed"
                                    type="checkbox"
                                    checked={holdAllowed}
                                    disabled={isRunning}
                                    style={checkboxStyle}
                                    onchange={(event: Event) => {
                                        const target = event.target as HTMLInputElement;
                                        actions.setColdClearHoldAllowed({ holdAllowed: target.checked });
                                    }}
                                />
                                <span />
                            </label>
                        </div>

                        <div key="cold-clear-next-limit-row" style={rowStyle}>
                            <div>
                                <p style={labelStyle}>{i18n.ColdClear.NextLimitLabel()}</p>
                                <p style={descriptionStyle}>{i18n.ColdClear.NextLimitDescription()}</p>
                            </div>
                            <div style={style({ display: 'flex', alignItems: 'center', gap: px(8) })}>
                                <label>
                                    <input
                                        datatest="toggle-cold-clear-next-limit-enabled"
                                        type="checkbox"
                                        checked={nextLimit !== null}
                                        disabled={isRunning}
                                        onchange={(event: Event) => {
                                            const target = event.target as HTMLInputElement;
                                            actions.setColdClearNextLimit({
                                                nextLimit: target.checked ? COLD_CLEAR_NEXT_LIMIT_DEFAULT : null,
                                            });
                                        }}
                                    />
                                    <span />
                                </label>
                                <input
                                    datatest="input-cold-clear-next-limit"
                                    type="number"
                                    value={nextLimit === null ? '' : nextLimit}
                                    min={COLD_CLEAR_NEXT_LIMIT_MIN}
                                    max={COLD_CLEAR_NEXT_LIMIT_MAX}
                                    step={1}
                                    disabled={isRunning || nextLimit === null}
                                    onchange={(event: Event) => {
                                        const target = event.target as HTMLInputElement;
                                        const value = Number(target.value);
                                        if (Number.isNaN(value)) {
                                            return;
                                        }
                                        const normalized = Math.max(
                                            COLD_CLEAR_NEXT_LIMIT_MIN,
                                            Math.min(COLD_CLEAR_NEXT_LIMIT_MAX, Math.floor(value)),
                                        );
                                        actions.setColdClearNextLimit({ nextLimit: normalized });
                                    }}
                                    style={numberInputStyle}
                                />
                            </div>
                        </div>

                        <div key="cold-clear-think-time-row" style={rowStyle}>
                            <div>
                                <p style={labelStyle}>{i18n.ColdClear.ThinkTimeLabel()}</p>
                                <p style={descriptionStyle}>{i18n.ColdClear.ThinkTimeDescription()}</p>
                            </div>
                            <select
                                key="select-cold-clear-think-time"
                                datatest="select-cold-clear-think-time"
                                value={String(thinkMs)}
                                disabled={isRunning}
                                onchange={(event: Event) => {
                                    const target = event.target as HTMLSelectElement;
                                    actions.setColdClearThinkMs({
                                        thinkMs: Number(target.value),
                                    });
                                }}
                                style={style({
                                    width: px(120),
                                    height: px(32),
                                    margin: '0px',
                                    fontSize: px(13),
                                    display: 'block',
                                })}
                            >
                                {COLD_CLEAR_THINK_MS_PRESETS.map(ms =>
                                    <option key={`think-${ms}`} value={String(ms)}>
                                        {ms >= 1000 ? `${ms / 1000}s` : `${ms}ms`}
                                    </option>,
                                )}
                            </select>
                        </div>

                        <div key="cold-clear-weights-preset-row" style={rowStyle}>
                            <div>
                                <p style={labelStyle}>{i18n.ColdClear.WeightsPresetLabel()}</p>
                                <p style={descriptionStyle}>{i18n.ColdClear.WeightsPresetDescription()}</p>
                            </div>
                            <select
                                key="select-cold-clear-weights-preset"
                                datatest="select-cold-clear-weights-preset"
                                value={String(weightsPreset)}
                                disabled={isRunning}
                                onchange={(event: Event) => {
                                    const target = event.target as HTMLSelectElement;
                                    actions.setColdClearWeightsPreset({
                                        weightsPreset: Number(target.value),
                                    });
                                }}
                                style={style({
                                    width: px(120),
                                    height: px(32),
                                    margin: '0px',
                                    fontSize: px(13),
                                    display: 'block',
                                })}
                            >
                                <option value="0">{i18n.ColdClear.WeightsPresetDefault()}</option>
                                <option value="1">{i18n.ColdClear.WeightsPresetFast()}</option>
                            </select>
                        </div>

                        <div key="cold-clear-speculate-row" style={rowStyle}>
                            <div>
                                <p style={labelStyle}>{i18n.ColdClear.SpeculateLabel()}</p>
                                <p style={descriptionStyle}>{i18n.ColdClear.SpeculateDescription()}</p>
                            </div>
                            <label>
                                <input
                                    datatest="toggle-cold-clear-speculate"
                                    type="checkbox"
                                    checked={speculate}
                                    disabled={isRunning}
                                    style={checkboxStyle}
                                    onchange={(event: Event) => {
                                        const target = event.target as HTMLInputElement;
                                        actions.setColdClearSpeculate({ speculate: target.checked });
                                    }}
                                />
                                <span />
                            </label>
                        </div>

                        {speculate && nextLimit !== null
                            ? <p style={warningStyle}>{i18n.ColdClear.SpeculateNextLimitHint()}</p>
                            : undefined}

                        <div key="cold-clear-top-branch-count-row" style={rowStyle}>
                            <div>
                                <p style={labelStyle}>{i18n.ColdClear.TopBranchCountLabel()}</p>
                                <p style={descriptionStyle}>{i18n.ColdClear.TopBranchCountDescription()}</p>
                            </div>
                            <input
                                key="input-cold-clear-top-branch-count"
                                datatest="input-cold-clear-top-branch-count"
                                type="number"
                                value={topBranchCount}
                                min={COLD_CLEAR_TOP_BRANCH_COUNT_MIN}
                                max={COLD_CLEAR_TOP_BRANCH_COUNT_MAX}
                                step={1}
                                disabled={isRunning}
                                oninput={onInputTopBranchCount}
                                onchange={commitTopBranchCount}
                                style={numberInputStyle}
                            />
                        </div>
                    </div>
                </div>

                <div key="cold-clear-menu-footer" className="modal-footer">
                    <a
                        href="#"
                        key="btn-cold-clear-menu-close"
                        datatest="btn-cold-clear-menu-close"
                        className="waves-effect waves-teal btn-flat"
                        disabled={isRunning}
                        onclick={(event: MouseEvent) => {
                            event.preventDefault();
                            closeMenu();
                        }}
                    >
                        {i18n.ColdClear.CloseButton()}
                    </a>
                </div>
            </div>
        </div>
    );
};

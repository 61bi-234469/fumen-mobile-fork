import { h } from 'hyperapp';
import { ColdClearMenuQueueState } from '../../actions/cold_clear';
import { Piece } from '../../lib/enums';
import {
    parsePieceHoldText,
    parsePieceQueueText,
    PIECE_QUEUE_ORDER,
    pieceQueuePieceToChar,
    pieceQueueToText,
} from '../../lib/piece_queue';
import { Component, px, style } from '../../lib/types';
import { i18n } from '../../locales/keys';
import { PieceQueueFocus } from '../../states';

interface PieceQueuePaneProps {
    currentQueueState: ColdClearMenuQueueState | null;
    canClearComment: boolean;
    initialFocus: PieceQueueFocus;
    actions: {
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

type FocusTarget = 'hold' | 'current' | 'next';
let focusTarget: FocusTarget = 'next';
let paneMounted = false;

export const PieceQueuePane: Component<PieceQueuePaneProps> = ({
    currentQueueState,
    canClearComment,
    initialFocus,
    actions,
}) => {
    const renderedFocusTarget: FocusTarget = paneMounted ? focusTarget : initialFocus;
    const oncreate = () => {
        paneMounted = true;
        focusTarget = initialFocus;
        // The pane is created before the window's modal opens; focus once it is displayed.
        setTimeout(() => setFocus(focusTarget), 0);
    };

    const sectionStyle = style({
        margin: '0px',
    });
    const descriptionStyle = style({
        color: '#6b7280',
        fontSize: px(12),
        lineHeight: '1.4',
        margin: `${px(4)} 0px ${px(10)} 0px`,
    });
    const inputStyle = style({
        boxSizing: 'border-box',
        height: px(34),
        margin: '0px',
        textAlign: 'center',
        width: '100%',
    });
    const pieceButtonStyle = style({
        background: '#fff',
        border: '1px solid #333',
        borderRadius: '0',
        cursor: 'pointer',
        fontSize: px(13),
        fontWeight: '700',
        height: px(34),
        minWidth: px(34),
        padding: `0 ${px(8)}`,
    });
    const updateQueue = (
        updater: (queue: ColdClearMenuQueueState) => ColdClearMenuQueueState,
        syncCurrentPiece = false,
    ) => {
        if (currentQueueState === null) {
            return;
        }
        const next = updater(currentQueueState);
        actions.previewColdClearQueueComment({
            syncCurrentPiece,
            hold: next.hold,
            current: next.current,
            queue: next.queue,
            b2b: next.b2bLevel,
            combo: next.combo,
        });
    };
    const paneStyle = (target: FocusTarget, flex: string) => style({
        flex,
        background: renderedFocusTarget === target ? '#eff6ff' : '#fff',
        border: renderedFocusTarget === target ? '2px solid #1976d2' : '2px solid #e0e0e0',
        borderRadius: '0',
        boxSizing: 'border-box',
        cursor: 'pointer',
        minWidth: '0',
        padding: px(8),
    });
    const setFocus = (target: FocusTarget) => {
        focusTarget = target;
        const panes: FocusTarget[] = ['hold', 'current', 'next'];
        for (const pane of panes) {
            const paneElement = document.querySelector(
                `[datatest="pane-piece-queue-${pane}"]`,
            ) as HTMLElement | null;
            if (paneElement) {
                paneElement.style.border = target === pane ? '2px solid #1976d2' : '2px solid #e0e0e0';
                paneElement.style.background = target === pane ? '#eff6ff' : '#fff';
            }
        }
        const oneBagButton = document.querySelector(
            '[datatest="btn-piece-queue-one-bag"]',
        ) as HTMLButtonElement | null;
        if (oneBagButton) {
            oneBagButton.disabled = target !== 'next';
        }
        const input = document.querySelector(
            `[datatest="input-piece-queue-${target}"]`,
        ) as HTMLInputElement | null;
        input?.focus();
    };

    return (
        <div
            key="panel-input-window-queue"
            datatest="panel-input-window-queue"
            oncreate={oncreate}
            ondestroy={() => {
                paneMounted = false;
            }}
        >
            <div key="piece-queue-editor" style={sectionStyle}>
                {currentQueueState === null
                    ? <div>
                        <p style={descriptionStyle}>{i18n.ColdClear.QueueStateUnavailable()}</p>
                        {canClearComment ? <button
                            key="btn-piece-queue-clear-comment"
                            datatest="btn-piece-queue-clear-comment"
                            onclick={(event: MouseEvent) => {
                                event.preventDefault();
                                actions.clearCommentForColdClearQueue();
                            }}
                            style={style({ ...pieceButtonStyle, width: '100%' })}
                        >{i18n.ColdClear.QueueStateClearAndEdit()}</button> : undefined}
                    </div>
                    : <div>
                        <div style={style({ display: 'flex', gap: px(8) })}>
                            <div
                                key="piece-queue-hold-pane"
                                datatest="pane-piece-queue-hold"
                                onclick={() => setFocus('hold')}
                                style={paneStyle('hold', '1')}
                            >
                                <p style={style({
                                    fontSize: px(11),
                                    fontWeight: '700',
                                    margin: `0 0 ${px(4)} 0`,
                                })}>
                                    {i18n.PieceQueue.HoldLabel()}
                                </p>
                                <input
                                    datatest="input-piece-queue-hold"
                                    type="text"
                                    maxlength={1}
                                    value={currentQueueState.hold === null
                                        ? '' : pieceQueuePieceToChar(currentQueueState.hold)}
                                    onfocus={() => setFocus('hold')}
                                    onchange={(event: Event) => {
                                        const value = (event.target as HTMLInputElement).value;
                                        const parsed = parsePieceHoldText(value);
                                        if (parsed === undefined) {
                                            return;
                                        }
                                        updateQueue(queue => ({ ...queue, hold: parsed }));
                                    }}
                                    style={inputStyle}
                                />
                            </div>
                            <div
                                key="piece-queue-current-pane"
                                datatest="pane-piece-queue-current"
                                onclick={() => setFocus('current')}
                                style={paneStyle('current', '1')}
                            >
                                <p style={style({
                                    fontSize: px(11),
                                    fontWeight: '700',
                                    margin: `0 0 ${px(4)} 0`,
                                })}>
                                    {i18n.PieceQueue.CurrentLabel()}
                                </p>
                                <input
                                    datatest="input-piece-queue-current"
                                    type="text"
                                    maxlength={1}
                                    placeholder={i18n.PieceQueue.CurrentEmpty()}
                                    value={currentQueueState.current === null
                                        ? '' : pieceQueuePieceToChar(currentQueueState.current)}
                                    onfocus={() => setFocus('current')}
                                    onchange={(event: Event) => {
                                        const value = (event.target as HTMLInputElement).value;
                                        const parsed = parsePieceHoldText(value);
                                        if (parsed === undefined) {
                                            return;
                                        }
                                        updateQueue(queue => ({ ...queue, current: parsed }), true);
                                    }}
                                    style={inputStyle}
                                />
                            </div>
                            <div
                                key="piece-queue-next-pane"
                                datatest="pane-piece-queue-next"
                                onclick={() => setFocus('next')}
                                style={paneStyle('next', '2')}
                            >
                                <p style={style({
                                    fontSize: px(11),
                                    fontWeight: '700',
                                    margin: `0 0 ${px(4)} 0`,
                                })}>
                                    {i18n.PieceQueue.NextLabel()}
                                </p>
                                <input
                                    datatest="input-piece-queue-next"
                                    type="text"
                                    value={pieceQueueToText(currentQueueState.queue)}
                                    onfocus={() => setFocus('next')}
                                    onchange={(event: Event) => {
                                        const value = (event.target as HTMLInputElement).value;
                                        const parsed = parsePieceQueueText(value);
                                        if (parsed === null) {
                                            return;
                                        }
                                        updateQueue(queue => ({ ...queue, queue: parsed }));
                                    }}
                                    style={inputStyle}
                                />
                            </div>
                        </div>

                        <div style={style({
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: px(6),
                            marginTop: px(10),
                        })}>
                            {PIECE_QUEUE_ORDER.map(piece => <button
                                key={`btn-piece-queue-add-${pieceQueuePieceToChar(piece)}`}
                                datatest={`btn-piece-queue-add-${pieceQueuePieceToChar(piece)}`}
                                onclick={(event: MouseEvent) => {
                                    event.preventDefault();
                                    updateQueue((queue) => {
                                        switch (focusTarget) {
                                        case 'hold':
                                            return { ...queue, hold: piece };
                                        case 'current':
                                            return { ...queue, current: piece };
                                        default:
                                            return { ...queue, queue: queue.queue.concat(piece) };
                                        }
                                    }, focusTarget === 'current');
                                }}
                                style={pieceButtonStyle}
                            >{pieceQueuePieceToChar(piece)}</button>)}
                            <button
                                key="btn-piece-queue-clear"
                                datatest="btn-piece-queue-clear"
                                onclick={(event: MouseEvent) => {
                                    event.preventDefault();
                                    updateQueue((queue) => {
                                        switch (focusTarget) {
                                        case 'hold':
                                            return { ...queue, hold: null };
                                        case 'current':
                                            return { ...queue, current: null };
                                        default:
                                            return { ...queue, queue: [] };
                                        }
                                    }, focusTarget === 'current');
                                }}
                                style={pieceButtonStyle}
                            >{i18n.ColdClear.QueueClearLabel()}</button>
                            <button
                                key="btn-piece-queue-one-bag"
                                datatest="btn-piece-queue-one-bag"
                                disabled={renderedFocusTarget !== 'next'}
                                onclick={(event: MouseEvent) => {
                                    event.preventDefault();
                                    actions.appendColdClearOneBagToComment();
                                }}
                                style={pieceButtonStyle}
                            >{i18n.ColdClear.OneBagAddShortLabel()}</button>
                        </div>
                    </div>}
            </div>
        </div>
    );
};

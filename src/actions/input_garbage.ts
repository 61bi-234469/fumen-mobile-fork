import { action, actions } from '../actions';
import { NextState, sequence } from './commons';
import { toPrimitivePage, toSinglePageTask } from '../history_task';
import { PageFieldOperation, Pages } from '../lib/pages';
import { computeInputStats } from '../lib/input_stats';
import {
    InputGarbageSegment,
    applyInputGarbageRows,
    createDefaultInputReplayContext,
    inputGarbageSegments,
    inputGarbageView,
    withInputGarbageSegments,
} from '../lib/input_replay';
import { State } from '../states';

export const INPUT_GARBAGE_MAX_SEGMENTS = 10;
export const INPUT_GARBAGE_MAX_AMOUNT = 20;

export interface InputGarbageActions {
    openInputGarbageModal: () => action;
    closeInputGarbageModal: () => action;
    updateInputGarbageDraft: (data: { segments: InputGarbageSegment[] }) => action;
    applyInputGarbageDraft: () => action;
    applyInputGarbageDraftAndOpenState: () => action;
    openInputStateModal: () => action;
    closeInputStateModal: () => action;
}

const clampSegment = (segment: InputGarbageSegment): InputGarbageSegment => ({
    amount: Math.max(1, Math.min(INPUT_GARBAGE_MAX_AMOUNT, Math.floor(segment.amount))),
    column: segment.column === null ? null : Math.max(0, Math.min(9, Math.floor(segment.column))),
});

const currentSegments = (state: State): InputGarbageSegment[] => {
    const context = state.fumen.pages[state.fumen.currentIndex]?.internal?.inputReplayContext;
    return context === undefined ? [] : inputGarbageSegments(context);
};

export const inputGarbageActions: Readonly<InputGarbageActions> = {
    openInputGarbageModal: () => (state): NextState => ({
        modal: { ...state.modal, inputGarbage: true },
        temporary: { ...state.temporary, inputGarbageSegments: currentSegments(state) },
    }),
    closeInputGarbageModal: () => (state): NextState => ({
        modal: { ...state.modal, inputGarbage: false },
    }),
    updateInputGarbageDraft: ({ segments }) => (state): NextState => ({
        temporary: {
            ...state.temporary,
            inputGarbageSegments: segments.slice(0, INPUT_GARBAGE_MAX_SEGMENTS).map(clampSegment),
        },
    }),
    // The current page keeps its unplaced piece; only its battle context and the
    // one-row rise preview change, exactly as a replay-imported INPUT page shows them.
    applyInputGarbageDraft: () => (state): NextState => {
        const pageIndex = state.fumen.currentIndex;
        const page = state.fumen.pages[pageIndex];
        const close = inputGarbageActions.closeInputGarbageModal();
        if (page === undefined) {
            return close(state);
        }
        const segments = state.temporary.inputGarbageSegments.map(clampSegment);
        const existing = page.internal?.inputReplayContext;
        if (existing === undefined && segments.length === 0) {
            return close(state);
        }
        const base = existing ?? createDefaultInputReplayContext(
            computeInputStats(state.fumen.pages, pageIndex, {
                rotationSystem: state.mode.rotationSystem,
                tree: state.tree.enabled
                    ? { nodes: state.tree.nodes, rootId: state.tree.rootId, version: 2 } : undefined,
            }),
            Math.floor(Math.random() * 0x7fffffff),
        );
        const context = withInputGarbageSegments(base, segments);
        const view = inputGarbageView(context);
        const previousPage = toPrimitivePage(page);
        const field = new Pages(state.fumen.pages).getField(pageIndex, PageFieldOperation.Command);
        page.field = { obj: applyInputGarbageRows(field, [], view.nextRise) };
        page.commands = undefined;
        page.flags.rise = view.nextRise !== undefined;
        page.internal = { ...page.internal, inputReplayContext: context };
        return sequence(state, [
            // A deliberate setup step: INPUT's queue-unit undo stops here instead of discarding it with the lock.
            actions.registerHistoryTask({ task: toSinglePageTask(pageIndex, previousPage, page), pieceSpawn: true }),
            actions.reopenCurrentPage(),
            close,
        ]);
    },
    // The draft is not on the page until applied; opening the sheet first would share the old garbage.
    applyInputGarbageDraftAndOpenState: () => (state): NextState => sequence(state, [
        inputGarbageActions.applyInputGarbageDraft(),
        inputGarbageActions.openInputStateModal(),
    ]),
    openInputStateModal: () => (state): NextState => ({
        modal: { ...state.modal, inputState: true },
    }),
    closeInputStateModal: () => (state): NextState => ({
        modal: { ...state.modal, inputState: false },
    }),
};

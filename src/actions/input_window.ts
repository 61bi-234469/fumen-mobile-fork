import { action, actions } from '../actions';
import { NextState, sequence } from './commons';
import { coldClearActions } from './cold_clear';
import { currentInputGarbageSegments, inputGarbageActions } from './input_garbage';
import { toPrimitivePage, toSinglePageTask } from '../history_task';
import { withQueueChainTokens } from '../lib/cold_clear/queueParser';
import { parseSevenBagGrayProgress } from '../lib/comment_metadata';
import { cloneInputReplayContext, createDefaultInputReplayContext } from '../lib/input_replay';
import { capB2bChain, computeInputStats, resolveInputRulesPreset, toCommentCombo } from '../lib/input_stats';
import { resolvePageCommentText } from '../lib/pages';
import { InputWindowTab, PieceQueueFocus, State } from '../states';

export interface InputWindowActions {
    openInputWindow: (data: { tab: InputWindowTab; focus?: PieceQueueFocus }) => action;
    selectInputWindowTab: (data: { tab: InputWindowTab }) => action;
    closeInputWindow: () => action;
    // Counts are chains: B2B = consecutive B2B clears, COMBO = consecutive clears (shown as chain - 1).
    setInputChainCounters: (data: { b2bChain?: number; renChain?: number }) => action;
}

const toCount = (value: number): number => Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

const enterTab = (tab: InputWindowTab) => (state: State): NextState => {
    const select = (nextState: State): NextState => ({
        temporary: {
            ...nextState.temporary,
            inputWindowTab: tab,
            inputWindowQueueVisited: nextState.temporary.inputWindowQueueVisited || tab === 'queue',
        },
    });
    // スポーンミノがあればカレント枠に反映してからQueueタブを出す
    return tab === 'queue'
        ? sequence(state, [coldClearActions.seedQueuePreviewFromSpawnedPiece(), select])
        : select(state);
};

// INPUT State・せり上がり・ピースキューを1つのウィンドウのタブで扱う。
// せり上がりの下書きはタブを離れるか閉じるときに適用し、State と共有URLが常に適用後の内容を示すようにする。
export const inputWindowActions: Readonly<InputWindowActions> = {
    openInputWindow: ({ tab, focus }) => (state): NextState => sequence(state, [
        nextState => ({
            modal: { ...nextState.modal, inputWindow: true },
            temporary: {
                ...nextState.temporary,
                inputWindowQueueVisited: false,
                inputGarbageSegments: currentInputGarbageSegments(nextState),
                pieceQueueFocus: focus ?? 'next',
            },
        }),
        enterTab(tab),
    ]),
    selectInputWindowTab: ({ tab }) => (state): NextState => {
        if (!state.modal.inputWindow || state.temporary.inputWindowTab === tab) {
            return undefined;
        }
        return sequence(state, [
            ...(state.temporary.inputWindowTab === 'garbage' ? [inputGarbageActions.applyInputGarbageDraft()] : []),
            // B2B / COMBO writes the same comment, so a pending queue edit must land first.
            ...(state.temporary.inputWindowTab === 'queue' ? [coldClearActions.commitColdClearQueueComment()] : []),
            enterTab(tab),
        ]);
    },
    // 閉じるボタンとMaterializeのonCloseStartの両方から呼ばれるため、2回目は何もしない。
    // Queueタブを開いていたら、カレントが空でもNEXTがあれば繰り上げてからコメントを確定する
    closeInputWindow: () => (state): NextState => {
        if (!state.modal.inputWindow) {
            return undefined;
        }
        return sequence(state, [
            ...(state.temporary.inputWindowQueueVisited ? [
                coldClearActions.promoteQueueNextToCurrent(),
                coldClearActions.commitColdClearQueueComment(),
            ] : []),
            inputGarbageActions.applyInputGarbageDraft(),
            nextState => ({ modal: { ...nextState.modal, inputWindow: false } }),
        ]);
    },
    // The page becomes an INPUT boundary carrying the new counts (what computeInputStats reads), and the
    // queue comment's b2b= / combo= follow so the AI and a reload agree. 7bag gray reads only the comment.
    setInputChainCounters: ({ b2bChain, renChain }) => (state): NextState => {
        const pageIndex = state.fumen.currentIndex;
        const page = state.fumen.pages[pageIndex];
        if (page === undefined) {
            return undefined;
        }
        const current = computeInputStats(state.fumen.pages, pageIndex, {
            rotationSystem: state.mode.rotationSystem,
            tree: state.tree.enabled ? { nodes: state.tree.nodes, rootId: state.tree.rootId, version: 2 } : undefined,
        });
        const nextB2b = capB2bChain(toCount(b2bChain ?? current.b2bChain), resolveInputRulesPreset(
            state.mode.rotationSystem,
        ));
        const nextRen = toCount(renChain ?? current.renChain);
        if (nextB2b === current.b2bChain && nextRen === current.renChain) {
            return undefined;
        }
        const comment = resolvePageCommentText(state.fumen.pages, pageIndex);
        const nextComment = withQueueChainTokens(comment, nextB2b, toCommentCombo(nextRen));
        const sevenBagGray = page.internal?.sevenBagGrayProgress ?? parseSevenBagGrayProgress(comment);
        if (sevenBagGray !== undefined && nextComment === null) {
            return undefined;
        }
        const previousPage = toPrimitivePage(page);
        if (sevenBagGray === undefined) {
            const base = page.internal?.inputReplayContext
                ?? createDefaultInputReplayContext(current, Math.floor(Math.random() * 0x7fffffff));
            const context = cloneInputReplayContext(base);
            context.stats = { ...context.stats, b2bChain: nextB2b, renChain: nextRen };
            page.internal = { ...page.internal, inputReplayContext: context };
        }
        const task = toSinglePageTask(pageIndex, previousPage, page);
        return sequence(state, [
            actions.registerHistoryTask({ task }),
            ...(nextComment === null || nextComment === comment ? [] : [
                actions.setCommentText({ pageIndex, text: nextComment, mergeKey: task.key }),
            ]),
            actions.reopenCurrentPage(),
        ]);
    },
};

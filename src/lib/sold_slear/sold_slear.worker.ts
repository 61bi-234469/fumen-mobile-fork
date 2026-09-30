import { findPlacedIndexByKey } from '../cold_clear/move_match';
import { CCAnalyzePositionMessage, CCInitMessage, WorkerMessage, WorkerResponse } from '../cold_clear/types';
import { soldSlearBudgetOf, SOLD_SLEAR_BUDGET_DEFAULT } from './budget';
import { decisionToMoves, DecisionOutcome } from './convert';
import { createSoldSlearEngine, SoldSlearEngine } from './engine';
import { createSoldSlearProfile } from './profile';
import { buildF14DecideRequest, isPieceLetter, PieceLetter, SoldSlearPosition } from './request';

// Sold Slear 用 Worker。Cold Clear の Worker と同じメッセージを受け、同じ応答を返す。
// 要求は 1 回ごとに完結させ、局面の遷移（連続探索の盤面・キュー・連鎖状態）は main 側が持つ。
// そのため requestSequence は受け付けない。

let engine: SoldSlearEngine | null = null;
let position: SoldSlearPosition | null = null;
let budgetId = SOLD_SLEAR_BUDGET_DEFAULT;
let nextRequestId = 1;

const postResponse = (msg: WorkerResponse) => {
    (self as any).postMessage(msg);
};

const ensureEngine = async (): Promise<SoldSlearEngine> => {
    if (engine !== null) {
        return engine;
    }
    const response = await fetch(new URL('../sold_slear_wasm/cold_clear_2_s2.wasm', import.meta.url).toString());
    if (!response.ok) {
        throw new Error(`Failed to load Sold Slear WASM: ${response.status}`);
    }
    engine = await createSoldSlearEngine(await response.arrayBuffer());
    return engine;
};

const LETTERS = ['I', 'O', 'T', 'L', 'J', 'S', 'Z'];
// Cold Clear の piece 番号（I=0, O=1, T=2, L=3, J=4, S=5, Z=6）→ 文字
const ccToLetter = (value: number): PieceLetter | null => {
    const letter = LETTERS[value];
    return isPieceLetter(letter) ? letter : null;
};

const toPosition = (msg: CCInitMessage | CCAnalyzePositionMessage): SoldSlearPosition | null => {
    if (msg.fieldCells === undefined) {
        return null;
    }
    const queue: PieceLetter[] = [];
    for (const value of msg.queue) {
        const letter = ccToLetter(value);
        if (letter === null) {
            return null;
        }
        queue.push(letter);
    }
    return {
        queue,
        cells: msg.fieldCells,
        hold: ccToLetter(msg.hold),
        chain: { combo: msg.combo, b2b: msg.b2bLevel ?? (msg.b2b ? 1 : 0) },
    };
};

const decidePosition = async (target: SoldSlearPosition): Promise<DecisionOutcome> => {
    const bot = await ensureEngine();
    const requestId = `fumen-${nextRequestId}`;
    nextRequestId += 1;
    const built = buildF14DecideRequest(target, createSoldSlearProfile(soldSlearBudgetOf(budgetId)), requestId);
    if (built.request === undefined) {
        return built.error === 'shortQueue'
            ? { kind: 'noMove' }
            : { kind: 'error', message: `Sold Slear: ${built.error}` };
    }
    return decisionToMoves(bot.decide(built.request), target.queue[0]);
};

(self as any).onmessage = async (event: MessageEvent<WorkerMessage>) => {
    const msg = event.data;
    try {
        if (msg.type === 'init') {
            await ensureEngine();
            position = toPosition(msg);
            budgetId = msg.soldSlearBudget ?? SOLD_SLEAR_BUDGET_DEFAULT;
            if (position === null) {
                postResponse({ type: 'error', message: 'Sold Slear: invalid position' });
                return;
            }
            postResponse({ type: 'initDone' });
        } else if (msg.type === 'requestMove' || msg.type === 'requestTopMoves') {
            if (position === null) {
                postResponse({ type: 'error', message: 'Bot not initialized' });
                return;
            }
            // incoming（せり上がり予告）は Sold Slear の profile が受け付けないため使わない
            const outcome = await decidePosition(position);
            if (outcome.kind === 'error') {
                postResponse({ type: 'error', message: outcome.message });
            } else if (outcome.kind === 'noMove') {
                postResponse({ type: 'noMove' });
            } else if (msg.type === 'requestMove') {
                postResponse({ type: 'moveResult', ...outcome.moves[0] });
            } else {
                const count = Math.max(0, Math.floor(msg.count));
                postResponse({ type: 'topMovesResult', moves: outcome.moves.slice(0, count) });
            }
        } else if (msg.type === 'requestSequence') {
            postResponse({ type: 'error', message: 'Sold Slear does not support requestSequence' });
        } else if (msg.type === 'analyzePosition') {
            budgetId = msg.soldSlearBudget ?? SOLD_SLEAR_BUDGET_DEFAULT;
            const target = toPosition(msg);
            if (target === null) {
                postResponse({ type: 'error', message: 'Sold Slear: invalid position' });
                return;
            }
            const outcome = await decidePosition(target);
            if (outcome.kind === 'error') {
                postResponse({ type: 'error', message: outcome.message });
                return;
            }
            if (outcome.kind === 'noMove') {
                postResponse({ type: 'noMove' });
                return;
            }
            const placedIndex = findPlacedIndexByKey(outcome.moves, msg.placedCellKey, msg.placedSpin);
            // 順位で評価する。スコアは最終順位と一致しないため返さない（best/played は 0 固定）
            postResponse({
                type: 'analysisResult',
                index: msg.index,
                bestScore: 0,
                playedScore: placedIndex < 0 ? null : 0,
                rank: placedIndex < 0 ? null : placedIndex + 1,
                candidateCount: outcome.returnedCount,
            });
        }
    } catch (e) {
        postResponse({ type: 'error', message: String(e) });
    }
};

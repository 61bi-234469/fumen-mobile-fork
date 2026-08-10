// tslint:disable-next-line:import-name
import initWasm, { ColdClearBot } from '../cold_clear_wasm/cold_clear_wasm_api';
import { findPlacedIndexByKey } from './move_match';
import { CCMove, WorkerMessage, WorkerResponse } from './types';

let bot: ColdClearBot | null = null;
let thinkMs = 1000;
// 解析は局面ごとに一時 bot を作り直すため、WASM 初期化だけ 1 回に抑える。
let wasmReady = false;

const ensureWasm = async (): Promise<void> => {
    if (wasmReady) {
        return;
    }
    await initWasm();
    wasmReady = true;
};

const postResponse = (msg: WorkerResponse) => {
    (self as any).postMessage(msg);
};

const toMove = (result: any): CCMove => ({
    hold: result.hold,
    piece: result.piece,
    rotation: result.rotation,
    x: result.x,
    y: result.y,
    b2b: result.b2b === true,
    combo: typeof result.combo === 'number' ? result.combo : 0,
    score: typeof result.score === 'number' ? result.score : undefined,
});

(self as any).onmessage = async (event: MessageEvent<WorkerMessage>) => {
    const msg = event.data;
    try {
        if (msg.type === 'init') {
            await ensureWasm();
            bot = new ColdClearBot(
                msg.field,
                msg.hold,
                msg.b2b,
                msg.combo,
                new Uint8Array(msg.queue),
                msg.holdAllowed,
                msg.speculate,
            );
            if (msg.weightsPreset !== 0) {
                bot.set_weights_preset(msg.weightsPreset);
            }
            thinkMs = msg.thinkMs;
            postResponse({ type: 'initDone' });
        } else if (msg.type === 'requestMove') {
            if (!bot) {
                postResponse({ type: 'error', message: 'Bot not initialized' });
                return;
            }
            const incoming = Math.max(0, Math.floor(msg.incoming ?? 0));
            const result = incoming > 0
                ? bot.suggest_move_sync_with_incoming(thinkMs, incoming)
                : bot.suggest_move_sync(thinkMs);
            if (result) {
                postResponse({
                    type: 'moveResult',
                    ...toMove(result),
                });
            } else {
                postResponse({ type: 'noMove' });
            }
        } else if (msg.type === 'requestTopMoves') {
            if (!bot) {
                postResponse({ type: 'error', message: 'Bot not initialized' });
                return;
            }
            const requestCount = Math.max(0, Math.floor(msg.count));
            if (requestCount <= 0) {
                postResponse({ type: 'topMovesResult', moves: [] });
                return;
            }
            const incoming = Math.max(0, Math.floor(msg.incoming ?? 0));
            const results = incoming > 0
                ? bot.suggest_top_moves_sync_with_incoming(thinkMs, requestCount, incoming)
                : bot.suggest_top_moves_sync(thinkMs, requestCount);
            const moves: CCMove[] = Array.isArray(results) ? results.map(toMove) : [];

            if (moves.length === 0) {
                postResponse({ type: 'noMove' });
            } else {
                postResponse({ type: 'topMovesResult', moves: moves.slice(0, requestCount) });
            }
        } else if (msg.type === 'requestSequence') {
            if (!bot) {
                postResponse({ type: 'error', message: 'Bot not initialized' });
                return;
            }
            const requestCount = Math.max(0, Math.floor(msg.count));
            if (requestCount <= 0) {
                postResponse({ type: 'sequenceDone' });
                return;
            }

            const incoming = Math.max(0, Math.floor(msg.incoming ?? 0));
            for (let i = 0; i < requestCount; i += 1) {
                const result = i === 0 && incoming > 0
                    ? bot.suggest_move_sync_with_incoming(thinkMs, incoming)
                    : bot.suggest_move_sync(thinkMs);
                if (!result) {
                    postResponse({ type: 'noMove' });
                    return;
                }
                postResponse({
                    type: 'moveResult',
                    ...toMove(result),
                });
            }
            postResponse({ type: 'sequenceDone' });
        } else if (msg.type === 'analyzePosition') {
            await ensureWasm();

            // 局面ごとに盤面・キュー・B2B・REN が変わるため bot は使い回せない。
            // 探索用の init セッション（bot）とは独立させ、必ず解放する。
            const analysisBot = new ColdClearBot(
                msg.field,
                msg.hold,
                msg.b2b,
                msg.combo,
                new Uint8Array(msg.queue),
                msg.holdAllowed,
                msg.speculate,
            );
            try {
                if (msg.weightsPreset !== 0) {
                    analysisBot.set_weights_preset(msg.weightsPreset);
                }

                const count = Math.max(1, Math.floor(msg.candidateCount));
                const incoming = Math.max(0, Math.floor(msg.incoming));
                const results = incoming > 0
                    ? analysisBot.suggest_top_moves_sync_with_incoming(msg.thinkMs, count, incoming)
                    : analysisBot.suggest_top_moves_sync(msg.thinkMs, count);
                const moves: CCMove[] = Array.isArray(results) ? results.map(toMove) : [];

                if (moves.length === 0) {
                    postResponse({ type: 'noMove' });
                } else {
                    const placedIndex = findPlacedIndexByKey(moves, msg.placedCellKey);
                    const played = placedIndex < 0 ? undefined : moves[placedIndex];
                    postResponse({
                        type: 'analysisResult',
                        index: msg.index,
                        bestScore: moves[0].score ?? 0,
                        playedScore: played !== undefined ? played.score ?? 0 : null,
                        rank: placedIndex < 0 ? null : placedIndex + 1,
                        candidateCount: moves.length,
                    });
                }
            } finally {
                analysisBot.free();
            }
        }
    } catch (e) {
        postResponse({ type: 'error', message: String(e) });
    }
};

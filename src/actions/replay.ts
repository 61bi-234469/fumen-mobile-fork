import { NextState } from './commons';
import { action, actions, main } from '../actions';
import { AnimationState, Screens } from '../lib/enums';
import {
    initialReplayState,
    ReplaySpeed,
    ReplayState,
    ReplayStepBasis,
    State,
} from '../states';
import { IRQueue, irPointToPage } from '../lib/ttrm/ir_to_page';
import { ReplayWorkerWrapper } from '../lib/ttrm/ReplayWorkerWrapper';
import { MAX_TTRM_TEXT_LENGTH } from '../lib/ttrm/parser';
import { PlayerRoundIR, ReplayIR, RoundIR } from '../lib/ttrm/types';
import { i18n } from '../locales/keys';
import {
    clampPointIndex,
    frameAt,
    indexAtFrame,
    lastPointIndex,
    pointAt,
    ReplayPoint,
    ReplayStats,
    statsAt,
} from '../lib/ttrm/timeline';
import { loadPersistedReplaySelfPlayer, persistViewSettings } from './view_settings';

const worker = new ReplayWorkerWrapper();

// インポート試行ごとに単調増加する ID。state.replay.requestId が reset で戻っても
// 衝突しないよう、state とは独立したカウンタで発行する（P1: 複数ファイル連続選択対策）。
let nextReplayRequestId = 1;

// 自動再生のクロック（FR-23）。盤面は lock 粒度でしか変わらないので 20Hz で足りる。
// 針だけがこの間隔で動く。
export const REPLAY_CLOCK_INTERVAL_MS = 50;

// 進行量は interval の呼び出し回数ではなく実時間差から出す。20Hz で state を汚さないよう、
// nextReplayRequestId と同じ流儀でモジュールスコープに置く。
let replayClockLastTickAt = 0;

export const getSelectedRound = (state: State): RoundIR | undefined => {
    return state.replay.ir?.rounds[state.replay.selection.roundIndex];
};

export const getSelfPlayerRound = (state: State): PlayerRoundIR | undefined => {
    const round = getSelectedRound(state);
    const selfId = state.replay.selection.selfPlayerId;
    if (round === undefined || selfId === null) {
        return undefined;
    }
    // rounds[i] 内の並び順はラウンドごとに入れ替わり得るため、必ず id で対応付ける（FR-15）
    return round.players.find(player => player.id === selfId);
};

// FR-16 は対象外だが、players[] から探す実装にして 3 人以上でも構造上は破綻させない。
export const getOpponentPlayerRound = (state: State): PlayerRoundIR | undefined => {
    const round = getSelectedRound(state);
    const selfId = state.replay.selection.selfPlayerId;
    if (round === undefined || selfId === null) {
        return undefined;
    }
    return round.players.find(player => player.id !== selfId);
};

const decideInitialSelfPlayer = (ir: ReplayIR): string | null => {
    if (ir.meta.users.length === 0) {
        return null;
    }
    const persisted = loadPersistedReplaySelfPlayer();
    if (persisted !== null) {
        const matched = ir.meta.users.find(user => user.username === persisted);
        if (matched !== undefined) {
            return matched.id;
        }
    }
    // 記憶がない（または今回のリプレイに居ない）ときは左側のプレイヤーを既定にする。
    // 未選択のままだとラウンド一覧の勝敗が出ず、再生も開始できないため。
    return ir.meta.users[0].id;
};

export const getReplayEndFrame = (state: State): number => {
    const round = getSelectedRound(state);
    if (round === undefined) {
        return 0;
    }
    // endFrame は replay.frames の最大値。両者の terminal もここに収まる。
    return Math.max(round.endFrame, ...round.players.map(player => player.terminal.frame));
};

// P2 §3-2: frame を書いたら、両者の index を必ずここで整合させる。
const cursorAtFrame = (
    state: State, frame: number, keepIndex?: { self?: number, opponent?: number },
): ReplayState['cursor'] => {
    const self = getSelfPlayerRound(state);
    const opponent = getOpponentPlayerRound(state);
    const clamped = Math.min(getReplayEndFrame(state), Math.max(0, frame));
    return {
        ...state.replay.cursor,
        frame: clamped,
        selfIndex: keepIndex?.self !== undefined ? keepIndex.self
            : self !== undefined ? indexAtFrame(self, clamped) : 0,
        opponentIndex: keepIndex?.opponent !== undefined ? keepIndex.opponent
            : opponent !== undefined ? indexAtFrame(opponent, clamped) : 0,
    };
};

// 相手が居ないリプレイで基準が 'opponent' のまま操作不能にならないよう、自陣へ落とす。
const effectiveStepBasis = (state: State): ReplayStepBasis =>
    state.replay.cursor.stepBasis === 'opponent' && getOpponentPlayerRound(state) !== undefined
        ? 'opponent'
        : 'self';

const stepBasisPlayer = (state: State): PlayerRoundIR | undefined =>
    effectiveStepBasis(state) === 'opponent'
        ? getOpponentPlayerRound(state)
        : getSelfPlayerRound(state);

const basisIndex = (state: State): number =>
    effectiveStepBasis(state) === 'opponent'
        ? state.replay.cursor.opponentIndex
        : state.replay.cursor.selfIndex;

// 明示的に送った側の index は再計算しない。同一 frame に複数 lock が並ぶとき、
// 送った手番が飛ぶのを防ぐため（P2 §3-2 / §7-2 の懸念 6）。
const moveToPointIndex = (state: State, index: number): NextState => {
    const player = stepBasisPlayer(state);
    if (player === undefined) {
        return undefined;
    }
    const target = clampPointIndex(player, index);
    const keep = effectiveStepBasis(state) === 'opponent'
        ? { opponent: target }
        : { self: target };
    return {
        replay: {
            ...state.replay,
            cursor: cursorAtFrame(state, frameAt(player, target), keep),
        },
    };
};

const stopReplayClock = (state: State): NextState => {
    if (state.handlers.replayClock !== undefined) {
        clearInterval(state.handlers.replayClock);
    } else if (state.replay.playback.status === AnimationState.Pause) {
        return undefined;
    }
    return {
        handlers: { ...state.handlers, replayClock: undefined },
        replay: {
            ...state.replay,
            playback: { ...state.replay.playback, status: AnimationState.Pause },
        },
    };
};

export interface ReplayActions {
    openReplayScreen: () => action;
    importTtrmFile: (data: { file: File }) => action;
    importTtrmText: (data: { text: string }) => action;
    beginTtrmParse: (data: { requestId: number, text: string, fileName: string }) => action;
    setReplayIR: (data: { ir: ReplayIR, fileName: string, requestId: number }) => action;
    setReplayError: (data: { stage: string, message: string, requestId: number }) => action;
    selectReplayRound: (data: { roundIndex: number }) => action;
    selectReplaySelfPlayer: (data: { playerId: string }) => action;
    startReplayPlayback: () => action;
    backToReplaySelect: () => action;
    resetReplayImport: () => action;
    stepReplayLock: (data: { step: number }) => action;
    replayFirstLock: () => action;
    replayLastLock: () => action;
    seekReplayFrame: (data: { frame: number }) => action;
    swapReplaySides: () => action;
    setReplayStepBasis: (data: { basis: ReplayStepBasis }) => action;
    toggleReplayOpponent: () => action;
    setReplayShowOpponent: (data: { showOpponent: boolean, persist?: boolean }) => action;
    setReplaySpeed: (data: { speed: ReplaySpeed }) => action;
    toggleReplayPlayback: () => action;
    pauseReplayPlayback: () => action;
    tickReplayClock: () => action;
    closeReplayScreen: () => action;
    openReplayInEditor: () => action;
}

export const replayActions: Readonly<ReplayActions> = {
    openReplayScreen: () => (state): NextState => {
        return actions.changeScreen({ screen: Screens.Replay })(state);
    },
    // P1 レビュー対応: 複数ファイルを連続選択した場合や resetReplayImport 後に、
    // 先に選択したファイルの File.text() / Worker 応答が後から届いても
    // 状態を上書きしないよう、試行ごとの requestId で最新性を照合する。
    importTtrmFile: ({ file }) => (state): NextState => {
        const requestId = nextReplayRequestId;
        nextReplayRequestId += 1;

        if (file.size > MAX_TTRM_TEXT_LENGTH) {
            return {
                replay: {
                    ...initialReplayState,
                    requestId,
                    view: state.replay.view,
                    phase: 'failed',
                    fileName: file.name,
                    error: {
                        stage: 'size',
                        message: `${Math.ceil(file.size / (1024 * 1024))}MB > 8MB`,
                    },
                },
            };
        }

        (async () => {
            let text: string;
            try {
                text = await file.text();
            } catch (e) {
                main.setReplayError({
                    requestId,
                    stage: 'read',
                    message: e instanceof Error ? e.message : String(e),
                });
                return;
            }
            main.beginTtrmParse({ requestId, text, fileName: file.name });
        })();

        return {
            replay: {
                ...initialReplayState,
                requestId,
                view: state.replay.view,
                phase: 'parsing',
                fileName: file.name,
            },
        };
    },
    // FR-02: JSON テキストの貼り付け取り込み。ファイル経路と同じ requestId 照合と
    // Worker を通す。beginTtrmParse は state.replay.requestId と照合するため、
    // 同期で呼ぶと更新前の値と比べて必ず弾かれる。ファイル経路が await file.text() で
    // 自然に満たしている「state 更新後に呼ぶ」条件を、貼り付け経路では明示的に作る。
    importTtrmText: ({ text }) => (state): NextState => {
        const requestId = nextReplayRequestId;
        nextReplayRequestId += 1;

        const fileName = i18n.Replay.Import.PastedName();
        if (text.length > MAX_TTRM_TEXT_LENGTH) {
            return {
                replay: {
                    ...initialReplayState,
                    requestId,
                    fileName,
                    view: state.replay.view,
                    phase: 'failed',
                    error: {
                        stage: 'size',
                        message: `${Math.ceil(text.length / (1024 * 1024))}MB > 8MB`,
                    },
                },
            };
        }

        Promise.resolve().then(() => {
            main.beginTtrmParse({ requestId, text, fileName });
        });

        return {
            replay: {
                ...initialReplayState,
                requestId,
                fileName,
                view: state.replay.view,
                phase: 'parsing',
            },
        };
    },
    // file.text() 完了時点で、この試行がまだ最新（他のインポートやリセットに
    // 上書きされていない）ことを確認してから Worker を起動する。
    beginTtrmParse: ({ requestId, text, fileName }) => (state): NextState => {
        if (state.replay.requestId !== requestId) {
            return undefined;
        }
        worker.start(text, (msg) => {
            worker.terminate();
            if (msg.type === 'ir') {
                main.setReplayIR({ fileName, requestId, ir: msg.ir });
            } else {
                main.setReplayError({ requestId, stage: msg.stage, message: msg.message });
            }
        });
        return undefined;
    },
    setReplayIR: ({ ir, fileName, requestId }) => (state): NextState => {
        if (state.replay.requestId !== requestId) {
            return undefined;
        }
        return {
            replay: {
                ...initialReplayState,
                ir,
                fileName,
                requestId,
                view: state.replay.view,
                phase: 'select',
                selection: {
                    roundIndex: 0,
                    selfPlayerId: decideInitialSelfPlayer(ir),
                },
            },
        };
    },
    setReplayError: ({ stage, message, requestId }) => (state): NextState => {
        if (state.replay.requestId !== requestId) {
            return undefined;
        }
        return {
            replay: {
                ...initialReplayState,
                requestId,
                view: state.replay.view,
                phase: 'failed',
                fileName: state.replay.fileName,
                error: { stage, message },
            },
        };
    },
    selectReplayRound: ({ roundIndex }) => (state): NextState => {
        const rounds = state.replay.ir?.rounds ?? [];
        if (roundIndex < 0 || rounds.length <= roundIndex) {
            return undefined;
        }
        return {
            replay: {
                ...state.replay,
                selection: {
                    ...state.replay.selection,
                    roundIndex,
                },
            },
        };
    },
    selectReplaySelfPlayer: ({ playerId }) => (state): NextState => {
        const users = state.replay.ir?.meta.users ?? [];
        const user = users.find(u => u.id === playerId);
        if (user === undefined) {
            return undefined;
        }
        persistViewSettings(state, { replaySelfPlayer: user.username });
        return {
            replay: {
                ...state.replay,
                selection: {
                    ...state.replay.selection,
                    selfPlayerId: playerId,
                },
            },
        };
    },
    startReplayPlayback: () => (state): NextState => {
        const round = getSelectedRound(state);
        const player = getSelfPlayerRound(state);
        // 自陣未選択のままでは再生できない（FR-10）。失敗ラウンドも再生不可。
        if (round === undefined || round.status !== 'ok' || player === undefined) {
            return undefined;
        }
        // 開始位置は P1 と同じく「手番 1」。設置数 0（piecesplaced: 0 で自己突合済み）の
        // ラウンドは lock が無いので、clampPointIndex で terminal に落ちる。
        const selfIndex = clampPointIndex(player, 1);
        return {
            replay: {
                ...state.replay,
                phase: 'playing',
                cursor: cursorAtFrame(state, frameAt(player, selfIndex), { self: selfIndex }),
            },
        };
    },
    backToReplaySelect: () => (state): NextState => {
        if (state.replay.ir === undefined) {
            return undefined;
        }
        const stopped = stopReplayClock(state);
        return {
            ...stopped,
            replay: {
                ...(stopped?.replay ?? state.replay),
                phase: 'select',
                cursor: { ...initialReplayState.cursor, stepBasis: state.replay.cursor.stepBasis },
            },
        };
    },
    resetReplayImport: () => (state): NextState => {
        worker.terminate();
        const stopped = stopReplayClock(state);
        return {
            ...stopped,
            replay: { ...initialReplayState, view: state.replay.view },
        };
    },
    // 基準プレイヤー（FR-22）のポイント空間を 1 つ進む／戻る。
    stepReplayLock: ({ step }) => (state): NextState => {
        if (state.replay.phase !== 'playing' || step === 0) {
            return undefined;
        }
        const player = stepBasisPlayer(state);
        if (player === undefined) {
            return undefined;
        }
        const current = basisIndex(state);
        const target = current + (step > 0 ? 1 : -1);
        if (target < 0 || lastPointIndex(player) < target) {
            return undefined;
        }
        return moveToPointIndex(state, target);
    },
    // P2 §7-2 の意図的変更: 先頭は「手番 1」ではなく「開始（設置 0）」。
    replayFirstLock: () => (state): NextState => {
        if (state.replay.phase !== 'playing') {
            return undefined;
        }
        return moveToPointIndex(state, 0);
    },
    replayLastLock: () => (state): NextState => {
        const player = stepBasisPlayer(state);
        if (state.replay.phase !== 'playing' || player === undefined) {
            return undefined;
        }
        return moveToPointIndex(state, lastPointIndex(player));
    },
    // FR-25: 任意時刻へのジャンプ。再生中でも一時停止しない。
    seekReplayFrame: ({ frame }) => (state): NextState => {
        if (state.replay.phase !== 'playing' || !Number.isFinite(frame)) {
            return undefined;
        }
        return {
            replay: {
                ...state.replay,
                cursor: cursorAtFrame(state, Math.round(frame)),
            },
        };
    },
    // FR-11: 自陣と相手を入れ替える。frame は不変なので再生位置は保たれる（FR-12）。
    // 記憶の対象は選択フェーズでの明示的な選択のみなので localStorage は更新しない（§7-4）。
    swapReplaySides: () => (state): NextState => {
        const opponent = getOpponentPlayerRound(state);
        if (state.replay.phase !== 'playing' || opponent === undefined) {
            return undefined;
        }
        return {
            replay: {
                ...state.replay,
                selection: {
                    ...state.replay.selection,
                    selfPlayerId: opponent.id,
                },
                cursor: {
                    ...state.replay.cursor,
                    selfIndex: state.replay.cursor.opponentIndex,
                    opponentIndex: state.replay.cursor.selfIndex,
                },
            },
        };
    },
    setReplayStepBasis: ({ basis }) => (state): NextState => {
        if (state.replay.cursor.stepBasis === basis) {
            return undefined;
        }
        return {
            replay: {
                ...state.replay,
                cursor: { ...state.replay.cursor, stepBasis: basis },
            },
        };
    },
    toggleReplayOpponent: () => (state): NextState => {
        return replayActions.setReplayShowOpponent({
            showOpponent: !state.replay.view.showOpponent,
        })(state);
    },
    // persist: false は起動時の localStorage 復元から呼ぶ経路（書き戻しを避ける）。
    setReplayShowOpponent: ({ showOpponent, persist = true }) => (state): NextState => {
        if (persist) {
            persistViewSettings(state, { replayShowOpponent: showOpponent });
        }
        return {
            replay: {
                ...state.replay,
                view: { ...state.replay.view, showOpponent },
            },
        };
    },
    setReplaySpeed: ({ speed }) => (state): NextState => {
        return {
            replay: {
                ...state.replay,
                playback: { ...state.replay.playback, speed },
            },
        };
    },
    // FR-23: 再生／一時停止。終端で押したら先頭から再生し直す（§7-4）。
    toggleReplayPlayback: () => (state): NextState => {
        if (state.replay.phase !== 'playing') {
            return undefined;
        }
        if (state.replay.playback.status === AnimationState.Play) {
            return replayActions.pauseReplayPlayback()(state);
        }

        const endFrame = getReplayEndFrame(state);
        const restart = endFrame <= state.replay.cursor.frame;
        const nextCursor = restart ? cursorAtFrame(state, 0) : state.replay.cursor;

        // 既存のクロックが残っていれば必ず捨てる（多重起動防止）
        if (state.handlers.replayClock !== undefined) {
            clearInterval(state.handlers.replayClock);
        }
        replayClockLastTickAt = Date.now();
        return {
            handlers: {
                ...state.handlers,
                replayClock: setInterval(() => main.tickReplayClock(), REPLAY_CLOCK_INTERVAL_MS),
            },
            replay: {
                ...state.replay,
                cursor: nextCursor,
                playback: { ...state.replay.playback, status: AnimationState.Play },
            },
        };
    },
    pauseReplayPlayback: () => (state): NextState => {
        return stopReplayClock(state);
    },
    // 進行量は実時間差から算出する。画面遷移やリセットの取りこぼしがあっても止まるよう、
    // phase / status が想定外なら自分で interval を止める（§3-5 の二重防御）。
    tickReplayClock: () => (state): NextState => {
        if (state.replay.phase !== 'playing'
            || state.replay.playback.status !== AnimationState.Play) {
            return stopReplayClock(state);
        }

        const now = Date.now();
        const elapsedMs = Math.max(0, now - replayClockLastTickAt);
        replayClockLastTickAt = now;
        const advance = elapsedMs / 1000 * 60 * state.replay.playback.speed;
        const endFrame = getReplayEndFrame(state);
        const nextFrame = state.replay.cursor.frame + advance;

        // 終端に着いたら留めて自動的に一時停止する
        if (endFrame <= nextFrame) {
            const stopped = stopReplayClock(state);
            return {
                ...stopped,
                replay: {
                    ...(stopped?.replay ?? state.replay),
                    cursor: cursorAtFrame(state, endFrame),
                },
            };
        }
        return {
            replay: {
                ...state.replay,
                cursor: cursorAtFrame(state, nextFrame),
            },
        };
    },
    // ヘッダの閉じるボタン。クロックを止めてから画面を離れる（§3-5 の明示停止経路）。
    // 停止は入れ子のアクションとして投げる。changeToDrawerScreen が内側で
    // pauseAnimation を通して handlers を書き換えるため、ここで handlers の patch を
    // 返すと更新前の値で上書きしてしまう。
    closeReplayScreen: () => (): NextState => {
        main.pauseReplayPlayback();
        main.changeToDrawerScreen({});
        return undefined;
    },
    // FR-51: 既存ページを置き換えず、カレントの次に新規ページとして挿入する。
    // 上書きが起きないので破棄確認は不要で、挿入自体も undo できる。
    openReplayInEditor: () => (state): NextState => {
        const field = getCurrentReplayField(state);
        if (field === undefined) {
            return undefined;
        }
        // 画面を離れるのでクロックを止める（§3-5 の明示停止経路）。
        // closeReplayScreen と同じ理由で、入れ子のアクションとして投げる。
        main.pauseReplayPlayback();
        // colorize は fumen 全体の設定なので、挿入先の fumen に合わせる。
        // カレントは spawn 位置の操作対象ミノとして載せるので、回転法則の設定も渡す
        const page = irPointToPage(
            field,
            getCurrentReplayQueue(state),
            state.fumen.guideLineColor,
            state.mode.rotationSystem !== 'classic',
        );
        const pageIndex = state.fumen.currentIndex + 1;

        // appendPages は履歴登録と挿入ページへの移動まで行う（クリップボード貼り付けと同じ経路）
        main.appendPages({ pageIndex, pages: [page] });
        main.changeToDrawerScreen({});
        // 取り込んだ地点からそのまま操作できるよう INPUT レイアウトで開く
        main.selectPieceLayout({ layout: 'play' });
        return undefined;
    },
};

export const getReplaySelfPoint = (state: State): ReplayPoint | undefined => {
    const player = getSelfPlayerRound(state);
    if (player === undefined || state.replay.phase !== 'playing') {
        return undefined;
    }
    return pointAt(player, state.replay.cursor.selfIndex);
};

export const getReplayOpponentPoint = (state: State): ReplayPoint | undefined => {
    const player = getOpponentPlayerRound(state);
    if (player === undefined || state.replay.phase !== 'playing') {
        return undefined;
    }
    return pointAt(player, state.replay.cursor.opponentIndex);
};

export const getCurrentReplayField = (state: State) => getReplaySelfPoint(state)?.field;

// 現在地点の HOLD / カレント / NEXT。Editor へ引き渡す quiz コメントと
// 再生画面の表示の両方がここを参照する。
export const getCurrentReplayQueue = (state: State): IRQueue | undefined => {
    const point = getReplaySelfPoint(state);
    if (point === undefined) {
        return undefined;
    }
    return { hold: point.hold, current: point.current, next: point.next };
};

export const getCurrentReplayClippedRowCount = (state: State): number =>
    getReplaySelfPoint(state)?.clippedRowCount ?? 0;

// FR-26。受信量は含めない（R7）。
export const getReplayStats = (state: State): ReplayStats | undefined => {
    const player = getSelfPlayerRound(state);
    if (player === undefined || state.replay.phase !== 'playing') {
        return undefined;
    }
    return statsAt(player, state.replay.cursor.selfIndex);
};

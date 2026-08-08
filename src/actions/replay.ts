import { NextState } from './commons';
import { action, actions, main } from '../actions';
import { Screens } from '../lib/enums';
import { initialReplayState, State } from '../states';
import { IRQueue, irPointToPage } from '../lib/ttrm/ir_to_page';
import { ReplayWorkerWrapper } from '../lib/ttrm/ReplayWorkerWrapper';
import { MAX_TTRM_TEXT_LENGTH } from '../lib/ttrm/parser';
import { PlayerRoundIR, ReplayIR, RoundIR } from '../lib/ttrm/types';
import { loadPersistedReplaySelfPlayer, persistViewSettings } from './view_settings';

const worker = new ReplayWorkerWrapper();

// インポート試行ごとに単調増加する ID。state.replay.requestId が reset で戻っても
// 衝突しないよう、state とは独立したカウンタで発行する（P1: 複数ファイル連続選択対策）。
let nextReplayRequestId = 1;

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

export interface ReplayActions {
    openReplayScreen: () => action;
    importTtrmFile: (data: { file: File }) => action;
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
                phase: 'parsing',
                fileName: file.name,
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
        // P2 レビュー対応: 設置数 0（piecesplaced: 0 で自己突合済み）のラウンドは
        // locks が空で lockIndex:0 の盤面が存在しないため、最初から terminal を表示する。
        return {
            replay: {
                ...state.replay,
                phase: 'playing',
                cursor: {
                    lockIndex: 0,
                    atTerminal: player.locks.length === 0,
                },
            },
        };
    },
    backToReplaySelect: () => (state): NextState => {
        if (state.replay.ir === undefined) {
            return undefined;
        }
        return {
            replay: {
                ...state.replay,
                phase: 'select',
                cursor: { lockIndex: 0, atTerminal: false },
            },
        };
    },
    resetReplayImport: () => (state): NextState => {
        worker.terminate();
        return { replay: { ...initialReplayState } };
    },
    stepReplayLock: ({ step }) => (state): NextState => {
        const player = getSelfPlayerRound(state);
        if (player === undefined || state.replay.phase !== 'playing') {
            return undefined;
        }
        const { lockIndex, atTerminal } = state.replay.cursor;
        const lastIndex = player.locks.length - 1;

        let next = { lockIndex, atTerminal };
        if (step > 0) {
            if (atTerminal) {
                return undefined;
            }
            // 最終 lock の次は終端フレーム（FR-21/28）
            next = lockIndex < lastIndex
                ? { lockIndex: lockIndex + 1, atTerminal: false }
                : { lockIndex: lastIndex, atTerminal: true };
        } else if (step < 0) {
            if (atTerminal) {
                // locks が空（設置数 0）のときは terminal より前に戻る先がない
                if (lastIndex < 0) {
                    return undefined;
                }
                next = { lockIndex: lastIndex, atTerminal: false };
            } else if (0 < lockIndex) {
                next = { lockIndex: lockIndex - 1, atTerminal: false };
            } else {
                return undefined;
            }
        }
        return {
            replay: {
                ...state.replay,
                cursor: next,
            },
        };
    },
    replayFirstLock: () => (state): NextState => {
        const player = getSelfPlayerRound(state);
        // locks が空（設置数 0）のときは先頭に戻る先がない
        if (player === undefined || state.replay.phase !== 'playing' || player.locks.length === 0) {
            return undefined;
        }
        return {
            replay: {
                ...state.replay,
                cursor: { lockIndex: 0, atTerminal: false },
            },
        };
    },
    replayLastLock: () => (state): NextState => {
        const player = getSelfPlayerRound(state);
        if (player === undefined || state.replay.phase !== 'playing') {
            return undefined;
        }
        return {
            replay: {
                ...state.replay,
                cursor: { lockIndex: Math.max(0, player.locks.length - 1), atTerminal: true },
            },
        };
    },
    // FR-51: 既存ページを置き換えず、カレントの次に新規ページとして挿入する。
    // 上書きが起きないので破棄確認は不要で、挿入自体も undo できる。
    openReplayInEditor: () => (state): NextState => {
        const field = getCurrentReplayField(state);
        if (field === undefined) {
            return undefined;
        }
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

export const getCurrentReplayField = (state: State) => {
    const player = getSelfPlayerRound(state);
    if (player === undefined || state.replay.phase !== 'playing') {
        return undefined;
    }
    const { lockIndex, atTerminal } = state.replay.cursor;
    if (atTerminal) {
        return player.terminal.field;
    }
    return player.locks[lockIndex]?.fieldAfter;
};

// 現在地点の HOLD / カレント / NEXT。Editor へ引き渡す quiz コメントと
// 再生画面の表示の両方がここを参照する。
export const getCurrentReplayQueue = (state: State): IRQueue | undefined => {
    const player = getSelfPlayerRound(state);
    if (player === undefined || state.replay.phase !== 'playing') {
        return undefined;
    }
    const { lockIndex, atTerminal } = state.replay.cursor;
    const point = atTerminal ? player.terminal : player.locks[lockIndex];
    if (point === undefined) {
        return undefined;
    }
    return { hold: point.hold, current: point.current, next: point.next };
};

export const getCurrentReplayClippedRowCount = (state: State): number => {
    const player = getSelfPlayerRound(state);
    if (player === undefined) {
        return 0;
    }
    const { lockIndex, atTerminal } = state.replay.cursor;
    if (atTerminal) {
        return player.terminal.clippedRowCount;
    }
    return player.locks[lockIndex]?.clippedRowCount ?? 0;
};

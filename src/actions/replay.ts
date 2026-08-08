import { NextState } from './commons';
import { action, actions, main } from '../actions';
import { Screens } from '../lib/enums';
import { initialReplayState, State } from '../states';
import { encode } from '../lib/fumen/fumen';
import { irPointToPage } from '../lib/ttrm/ir_to_page';
import { ReplayWorkerWrapper } from '../lib/ttrm/ReplayWorkerWrapper';
import { MAX_TTRM_TEXT_LENGTH } from '../lib/ttrm/parser';
import { PlayerRoundIR, ReplayIR, RoundIR } from '../lib/ttrm/types';
import { loadPersistedReplaySelfPlayer, persistViewSettings } from './view_settings';

const worker = new ReplayWorkerWrapper();

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
    return null;
};

export interface ReplayActions {
    openReplayScreen: () => action;
    importTtrmFile: (data: { file: File }) => action;
    setReplayIR: (data: { ir: ReplayIR, fileName: string }) => action;
    setReplayError: (data: { stage: string, message: string }) => action;
    selectReplayRound: (data: { roundIndex: number }) => action;
    selectReplaySelfPlayer: (data: { playerId: string }) => action;
    startReplayPlayback: () => action;
    backToReplaySelect: () => action;
    resetReplayImport: () => action;
    stepReplayLock: (data: { step: number }) => action;
    replayFirstLock: () => action;
    replayLastLock: () => action;
    openReplayInEditor: () => action;
    confirmReplayOpenInEditor: () => action;
    openReplayDiscardConfirmModal: () => action;
    closeReplayDiscardConfirmModal: () => action;
}

export const replayActions: Readonly<ReplayActions> = {
    openReplayScreen: () => (state): NextState => {
        return actions.changeScreen({ screen: Screens.Replay })(state);
    },
    importTtrmFile: ({ file }) => (state): NextState => {
        if (file.size > MAX_TTRM_TEXT_LENGTH) {
            return {
                replay: {
                    ...initialReplayState,
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
                    stage: 'read',
                    message: e instanceof Error ? e.message : String(e),
                });
                return;
            }
            worker.start(text, (msg) => {
                worker.terminate();
                if (msg.type === 'ir') {
                    main.setReplayIR({ ir: msg.ir, fileName: file.name });
                } else {
                    main.setReplayError({ stage: msg.stage, message: msg.message });
                }
            });
        })();

        return {
            replay: {
                ...initialReplayState,
                phase: 'parsing',
                fileName: file.name,
            },
        };
    },
    setReplayIR: ({ ir, fileName }) => (state): NextState => {
        return {
            replay: {
                ...initialReplayState,
                ir,
                fileName,
                phase: 'select',
                selection: {
                    roundIndex: 0,
                    selfPlayerId: decideInitialSelfPlayer(ir),
                },
            },
        };
    },
    setReplayError: ({ stage, message }) => (state): NextState => {
        return {
            replay: {
                ...initialReplayState,
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
        // 自陣未選択のままでは再生できない（FR-10）。失敗ラウンドも再生不可。
        if (round === undefined || round.status !== 'ok' || getSelfPlayerRound(state) === undefined) {
            return undefined;
        }
        return {
            replay: {
                ...state.replay,
                phase: 'playing',
                cursor: {
                    lockIndex: 0,
                    atTerminal: false,
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
        if (getSelfPlayerRound(state) === undefined || state.replay.phase !== 'playing') {
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
                cursor: { lockIndex: player.locks.length - 1, atTerminal: true },
            },
        };
    },
    openReplayInEditor: () => (state): NextState => {
        if (getCurrentReplayField(state) === undefined) {
            return undefined;
        }
        // この session で編集していたら破棄確認を挟む（Q2）
        if (state.history.undoCount > 0) {
            return replayActions.openReplayDiscardConfirmModal()(state);
        }
        return replayActions.confirmReplayOpenInEditor()(state);
    },
    confirmReplayOpenInEditor: () => (state): NextState => {
        const field = getCurrentReplayField(state);
        if (field === undefined) {
            return undefined;
        }
        const page = irPointToPage(field);
        (async () => {
            try {
                const encoded = await encode([page]);
                // 既存の fumen 読み込み経路に載せる（FR-51）: 履歴登録も同じ扱いになる
                main.loadPages({ pages: [page], loadedFumen: `v115@${encoded}` });
                main.changeToDrawerScreen({ refresh: true });
            } catch (e) {
                console.error(e);
                main.setReplayError({
                    stage: 'export',
                    message: e instanceof Error ? e.message : String(e),
                });
            }
        })();
        return undefined;
    },
    openReplayDiscardConfirmModal: () => (state): NextState => {
        return {
            modal: {
                ...state.modal,
                replayDiscardConfirm: true,
            },
        };
    },
    closeReplayDiscardConfirmModal: () => (state): NextState => {
        return {
            modal: {
                ...state.modal,
                replayDiscardConfirm: false,
            },
        };
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

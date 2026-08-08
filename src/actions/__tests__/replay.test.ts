/**
 * @jest-environment jsdom
 */

jest.mock('../../actions', () => ({
    actions: {
        changeScreen: ({ screen }: { screen: string }) => (state: any) => ({
            mode: { ...state.mode, screen },
        }),
    },
    main: {},
}));
jest.mock('../view_settings', () => ({
    loadPersistedReplaySelfPlayer: jest.fn(() => null),
    persistViewSettings: jest.fn(),
}));
jest.mock('../../states', () => ({
    initialReplayState: {
        phase: 'empty',
        fileName: undefined,
        ir: undefined,
        selection: { roundIndex: 0, selfPlayerId: null },
        cursor: { lockIndex: 0, atTerminal: false },
        error: undefined,
    },
}));
jest.mock('../../lib/ttrm/ReplayWorkerWrapper', () => ({
    ReplayWorkerWrapper: class {
        start() { /* not exercised here */ }
        terminate() { /* noop */ }
    },
}));

import { replayActions } from '../replay';
import { initialReplayState, State } from '../../states';
import { FieldConstants, Piece } from '../../lib/enums';
import { IRField, LockPoint, ReplayIR } from '../../lib/ttrm/types';
import { persistViewSettings } from '../view_settings';

const emptyField = (): IRField =>
    Array.from({ length: FieldConstants.PlayBlocks }).map(() => Piece.Empty);

const lockAt = (pieceIndex: number): LockPoint => ({
    pieceIndex,
    frame: pieceIndex * 30,
    fieldBefore: emptyField(),
    fieldAfter: emptyField(),
    piece: Piece.T,
    rotation: 0,
    x: 4,
    y: 0,
    hold: null,
    next: [Piece.I],
    clear: { lines: 0, spin: 'none', b2b: 0, ren: 0, perfectClear: false },
    attack: 0,
    garbageGauge: 0,
    pendingHoles: 0,
    sourceHeight: 1,
    clippedRowCount: 0,
});

const buildIR = (lockCount: number, roundStatus: 'ok' | 'failed' = 'ok'): ReplayIR => {
    const players = ['player-a-id', 'player-b-id'].map(id => ({
        id,
        username: id.replace('-id', ''),
        resolvedOptions: {},
        optionWarnings: [],
        locks: Array.from({ length: lockCount }).map((ignore, i) => lockAt(i)),
        terminal: {
            frame: lockCount * 30 + 60,
            field: emptyField(),
            sourceHeight: 0,
            clippedRowCount: 0,
            garbageGauge: 0,
            reason: id === 'player-a-id' ? 'winner' : 'garbagesmash',
            alive: id === 'player-a-id',
        },
        garbageEvents: [],
        verification: {
            piecesplaced: { expected: lockCount, actual: lockCount },
            lines: { expected: 0, actual: 0 },
            sent: { expected: 0, actual: 0 },
            matched: true,
        },
    }));
    return {
        meta: {
            users: [
                { id: 'player-a-id', username: 'player-a' },
                { id: 'player-b-id', username: 'player-b' },
            ],
            gamemode: 'league',
            ts: '2026-03-27T00:00:00.000Z',
            version: 1,
        },
        rounds: [{
            players,
            index: 0,
            startFrame: 0,
            endFrame: lockCount * 30 + 60,
            result: { winnerId: 'player-a-id', reasons: {} },
            status: roundStatus,
        }],
    };
};

const createState = (overrides: Partial<State['replay']> = {}, undoCount: number = 0): State => ({
    replay: {
        ...initialReplayState,
        ...overrides,
    },
    history: { undoCount, redoCount: 0 },
    modal: { replayDiscardConfirm: false },
    mode: { screen: 'Editor' },
} as unknown as State);

const playingState = (lockCount: number, cursor?: State['replay']['cursor']): State =>
    createState({
        ir: buildIR(lockCount),
        phase: 'playing',
        selection: { roundIndex: 0, selfPlayerId: 'player-a-id' },
        cursor: cursor ?? { lockIndex: 0, atTerminal: false },
    });

describe('replayActions', () => {
    describe('phase transitions', () => {
        test('setReplayIR moves to select phase', () => {
            const result = replayActions.setReplayIR({ ir: buildIR(3), fileName: 'a.ttrm' })(createState())!;
            expect(result.replay!.phase).toEqual('select');
            expect(result.replay!.fileName).toEqual('a.ttrm');
            expect(result.replay!.selection.selfPlayerId).toBeNull();
        });

        test('setReplayError moves to failed phase and keeps the file name', () => {
            const state = createState({ phase: 'parsing', fileName: 'bad.ttrm' });
            const result = replayActions.setReplayError({ stage: 'json', message: 'broken' })(state)!;
            expect(result.replay!.phase).toEqual('failed');
            expect(result.replay!.fileName).toEqual('bad.ttrm');
            expect(result.replay!.error).toEqual({ stage: 'json', message: 'broken' });
        });

        test('startReplayPlayback requires a self player (FR-10)', () => {
            const state = createState({
                ir: buildIR(3),
                phase: 'select',
                selection: { roundIndex: 0, selfPlayerId: null },
            });
            expect(replayActions.startReplayPlayback()(state)).toBeUndefined();
        });

        test('startReplayPlayback refuses failed rounds', () => {
            const state = createState({
                ir: buildIR(3, 'failed'),
                phase: 'select',
                selection: { roundIndex: 0, selfPlayerId: 'player-a-id' },
            });
            expect(replayActions.startReplayPlayback()(state)).toBeUndefined();
        });

        test('startReplayPlayback enters playing with the cursor reset', () => {
            const state = createState({
                ir: buildIR(3),
                phase: 'select',
                selection: { roundIndex: 0, selfPlayerId: 'player-a-id' },
            });
            const result = replayActions.startReplayPlayback()(state)!;
            expect(result.replay!.phase).toEqual('playing');
            expect(result.replay!.cursor).toEqual({ lockIndex: 0, atTerminal: false });
        });

        test('backToReplaySelect returns to select phase', () => {
            const result = replayActions.backToReplaySelect()(playingState(3))!;
            expect(result.replay!.phase).toEqual('select');
        });
    });

    describe('selection', () => {
        test('selectReplayRound ignores out-of-range indices', () => {
            const state = createState({ ir: buildIR(3), phase: 'select' });
            expect(replayActions.selectReplayRound({ roundIndex: 5 })(state)).toBeUndefined();
            expect(replayActions.selectReplayRound({ roundIndex: -1 })(state)).toBeUndefined();
        });

        test('selectReplaySelfPlayer persists the username (FR-13)', () => {
            const state = createState({ ir: buildIR(3), phase: 'select' });
            const result = replayActions.selectReplaySelfPlayer({ playerId: 'player-b-id' })(state)!;
            expect(result.replay!.selection.selfPlayerId).toEqual('player-b-id');
            expect(persistViewSettings).toHaveBeenCalledWith(state, { replaySelfPlayer: 'player-b' });
        });

        test('selectReplaySelfPlayer ignores unknown ids', () => {
            const state = createState({ ir: buildIR(3), phase: 'select' });
            expect(replayActions.selectReplaySelfPlayer({ playerId: 'nobody' })(state)).toBeUndefined();
        });
    });

    describe('stepReplayLock boundaries (FR-21/28)', () => {
        test('does not step back from the first lock', () => {
            expect(replayActions.stepReplayLock({ step: -1 })(playingState(3))).toBeUndefined();
        });

        test('stepping forward from the last lock reaches the terminal', () => {
            const state = playingState(3, { lockIndex: 2, atTerminal: false });
            const result = replayActions.stepReplayLock({ step: 1 })(state)!;
            expect(result.replay!.cursor).toEqual({ lockIndex: 2, atTerminal: true });
        });

        test('does not step forward past the terminal', () => {
            const state = playingState(3, { lockIndex: 2, atTerminal: true });
            expect(replayActions.stepReplayLock({ step: 1 })(state)).toBeUndefined();
        });

        test('stepping back from the terminal returns to the last lock', () => {
            const state = playingState(3, { lockIndex: 2, atTerminal: true });
            const result = replayActions.stepReplayLock({ step: -1 })(state)!;
            expect(result.replay!.cursor).toEqual({ lockIndex: 2, atTerminal: false });
        });

        test('replayFirstLock and replayLastLock jump to the boundaries', () => {
            const state = playingState(5, { lockIndex: 3, atTerminal: false });
            expect(replayActions.replayFirstLock()(state)!.replay!.cursor)
                .toEqual({ lockIndex: 0, atTerminal: false });
            expect(replayActions.replayLastLock()(state)!.replay!.cursor)
                .toEqual({ lockIndex: 4, atTerminal: true });
        });
    });

    describe('open in editor discard confirmation (Q2)', () => {
        test('opens the confirm modal when undoCount > 0', () => {
            const state = playingState(3);
            const withEdits = { ...state, history: { undoCount: 2, redoCount: 0 } } as State;
            const result = replayActions.openReplayInEditor()(withEdits)!;
            expect(result.modal!.replayDiscardConfirm).toBeTruthy();
        });

        test('closeReplayDiscardConfirmModal keeps the replay state untouched', () => {
            const state = playingState(3);
            const result = replayActions.closeReplayDiscardConfirmModal()(state)!;
            expect(result.modal!.replayDiscardConfirm).toBeFalsy();
            expect(result.replay).toBeUndefined();
        });
    });
});

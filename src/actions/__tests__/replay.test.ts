/**
 * @jest-environment jsdom
 */

jest.mock('../../actions', () => ({
    actions: {
        changeScreen: ({ screen }: { screen: string }) => (state: any) => ({
            mode: { ...state.mode, screen },
        }),
    },
    main: {
        appendPages: jest.fn(),
        changeToDrawerScreen: jest.fn(),
        selectPieceLayout: jest.fn(),
    },
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

import { getCurrentReplayQueue, replayActions } from '../replay';
import { main } from '../../actions';
import { initialReplayState, State } from '../../states';
import { FieldConstants, Piece, Rotation } from '../../lib/enums';
import { IRField, LockPoint, ReplayIR } from '../../lib/ttrm/types';
import { loadPersistedReplaySelfPlayer, persistViewSettings } from '../view_settings';

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
    current: Piece.O,
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
            hold: null,
            current: Piece.S,
            next: [Piece.Z],
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
    modal: {},
    mode: { screen: 'Editor' },
    fumen: { currentIndex: 2, guideLineColor: true },
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
        test('setReplayIR moves to select phase with the left player selected', () => {
            const result = replayActions.setReplayIR({ ir: buildIR(3), fileName: 'a.ttrm' })(createState())!;
            expect(result.replay!.phase).toEqual('select');
            expect(result.replay!.fileName).toEqual('a.ttrm');
            expect(result.replay!.selection.selfPlayerId).toEqual('player-a-id');
        });

        test('setReplayIR prefers the remembered player over the left one (FR-13)', () => {
            (loadPersistedReplaySelfPlayer as jest.Mock).mockReturnValueOnce('player-b');
            const result = replayActions.setReplayIR({ ir: buildIR(3), fileName: 'a.ttrm' })(createState())!;
            expect(result.replay!.selection.selfPlayerId).toEqual('player-b-id');
        });

        test('setReplayIR falls back to the left player when the remembered name is absent', () => {
            (loadPersistedReplaySelfPlayer as jest.Mock).mockReturnValueOnce('someone-else');
            const result = replayActions.setReplayIR({ ir: buildIR(3), fileName: 'a.ttrm' })(createState())!;
            expect(result.replay!.selection.selfPlayerId).toEqual('player-a-id');
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

    describe('getCurrentReplayQueue', () => {
        test('reads the lock point queue while stepping', () => {
            expect(getCurrentReplayQueue(playingState(3))).toEqual({
                hold: null, current: Piece.O, next: [Piece.I],
            });
        });

        test('reads the terminal queue at the end', () => {
            const state = playingState(3, { lockIndex: 2, atTerminal: true });
            expect(getCurrentReplayQueue(state)).toEqual({
                hold: null, current: Piece.S, next: [Piece.Z],
            });
        });

        test('is undefined outside the playing phase', () => {
            const state = createState({
                ir: buildIR(3),
                phase: 'select',
                selection: { roundIndex: 0, selfPlayerId: 'player-a-id' },
            });
            expect(getCurrentReplayQueue(state)).toBeUndefined();
        });
    });

    describe('openReplayInEditor', () => {
        beforeEach(() => {
            (main.appendPages as jest.Mock).mockClear();
            (main.changeToDrawerScreen as jest.Mock).mockClear();
            (main.selectPieceLayout as jest.Mock).mockClear();
        });

        test('inserts the point as a new page after the current one', () => {
            // currentIndex は 2。既存ページを置き換えず 3 番目の次に挿入する
            replayActions.openReplayInEditor()(playingState(3));

            expect(main.appendPages).toHaveBeenCalledTimes(1);
            const call = (main.appendPages as jest.Mock).mock.calls[0][0];
            expect(call.pageIndex).toEqual(3);
            expect(call.pages).toHaveLength(1);
            expect(call.pages[0].comment.text).toEqual('#Q=[](O)I');
        });

        test('hands the current mino over as a spawned piece', () => {
            replayActions.openReplayInEditor()(playingState(3));

            const call = (main.appendPages as jest.Mock).mock.calls[0][0];
            expect(call.pages[0].piece).toEqual({
                type: Piece.O,
                rotation: Rotation.Spawn,
                coordinate: { x: 4, y: 20 },
            });
        });

        test('the spawn position follows the rotation system setting', () => {
            const state = playingState(3);
            replayActions.openReplayInEditor()({
                ...state,
                mode: { ...state.mode, rotationSystem: 'classic' },
            } as State);

            const call = (main.appendPages as jest.Mock).mock.calls[0][0];
            expect(call.pages[0].piece.coordinate).toEqual({ x: 5, y: 21 });
        });

        test('opens the editor in the INPUT layout', () => {
            replayActions.openReplayInEditor()(playingState(3));

            expect(main.changeToDrawerScreen).toHaveBeenCalledWith({});
            expect(main.selectPieceLayout).toHaveBeenCalledWith({ layout: 'play' });
        });

        test('does nothing outside the playing phase', () => {
            const state = createState({
                ir: buildIR(3),
                phase: 'select',
                selection: { roundIndex: 0, selfPlayerId: 'player-a-id' },
            });
            expect(replayActions.openReplayInEditor()(state)).toBeUndefined();
            expect(main.appendPages).not.toHaveBeenCalled();
        });

        test('never asks to discard: editing the session does not change the flow', () => {
            const withEdits = {
                ...playingState(3),
                history: { undoCount: 5, redoCount: 0 },
            } as State;
            replayActions.openReplayInEditor()(withEdits);

            expect(main.appendPages).toHaveBeenCalledTimes(1);
        });
    });
});

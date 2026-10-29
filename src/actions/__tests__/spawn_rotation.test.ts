import { actions } from '../../actions';
import { Piece, Rotation, toPositionIndex } from '../../lib/enums';
import { Field } from '../../lib/fumen/field';
import { createSpawnMove, getBlockPositions } from '../../lib/piece';
import { endAllDasHolds } from '../../lib/piece_das';
import { endPieceShortcut, startPieceShortcut } from '../../lib/piece_shortcut';
import { releaseAllRotations } from '../../lib/spawn_rotation';

jest.mock('../../actions', () => ({
    actions: {
        resetInferencePiece: jest.fn(() => () => undefined),
        registerHistoryTask: jest.fn(() => () => undefined),
        reopenCurrentPage: jest.fn(() => () => undefined),
        setCommentText: jest.fn(() => () => undefined),
        insertPage: jest.fn(() => () => undefined),
        openPage: jest.fn(() => () => undefined),
        spawnNextPieceFromColdClearQueue: jest.fn(() => () => undefined),
        spawnPiece: jest.fn(() => () => undefined),
        changePieceAction: jest.fn(() => () => undefined),
    },
}));

jest.mock('../../lib/cold_clear/ColdClearWrapper', () => ({
    ColdClearWrapper: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('../../lib/piece_das', () => ({
    ...jest.requireActual('../../lib/piece_das'),
    cutDasHolds: jest.fn(),
    activateDasCut: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { fieldEditorActions } = require('../field_editor');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const dasModule = require('../../lib/piece_das');

const holdOptions = { dasFrames: 10, arrFrames: 1, sdf: 5, softDropPriority: false };
const noActions = () => ({});

const createState = ({ spawnRotation = 'hold', rotationSystem = 'srsPlus', field = new Field({}) }: {
    spawnRotation?: string, rotationSystem?: string, field?: Field,
} = {}): any => ({
    fumen: {
        currentIndex: 0,
        pages: [{
            index: 0,
            field: { obj: field },
            comment: { text: '' },
            flags: { lock: true, mirror: false, colorize: true, rise: false, quiz: false },
        }],
    },
    events: { inferences: [] },
    mode: { rotationSystem, pieceSpawnRotation: spawnRotation, pieceShortcutDasCutFrames: 0 },
});

const spawn = (state: any, spawnRotationApplies?: boolean) => {
    fieldEditorActions.spawnPiece({
        spawnRotationApplies, piece: Piece.T, srs: true,
    })(state);
    return state.fumen.pages[0].piece;
};

describe('spawn rotation on spawn', () => {
    beforeEach(() => {
        (actions.registerHistoryTask as jest.Mock).mockClear();
        (dasModule.cutDasHolds as jest.Mock).mockClear();
    });

    afterEach(() => {
        releaseAllRotations();
        endAllDasHolds();
    });

    test('spawns unrotated when the setting is off, even with a rotate input held', () => {
        startPieceShortcut('keyboard:KeyX', 'RotateRight', holdOptions, noActions);

        expect(spawn(createState({ spawnRotation: 'off' }), true).rotation).toBe(Rotation.Spawn);
    });

    test('spawns unrotated when no rotate input is held', () => {
        expect(spawn(createState(), true).rotation).toBe(Rotation.Spawn);
    });

    test.each([
        ['RotateRight', Rotation.Right],
        ['RotateLeft', Rotation.Left],
        ['Rotate180', Rotation.Reverse],
    ] as const)('spawns already rotated while %s is held', (shortcut, rotation) => {
        startPieceShortcut('keyboard:KeyX', shortcut, holdOptions, noActions);

        expect(spawn(createState(), true).rotation).toBe(rotation);
    });

    test('spawns unrotated when the rotate input was released before the spawn', () => {
        startPieceShortcut('keyboard:KeyX', 'RotateRight', holdOptions, noActions);
        endPieceShortcut('keyboard:KeyX');

        expect(spawn(createState(), true).rotation).toBe(Rotation.Spawn);
    });

    test('uses the most recently pressed rotate input', () => {
        startPieceShortcut('keyboard:KeyX', 'RotateRight', holdOptions, noActions);
        startPieceShortcut('tray:tray-piece-rotate-left', 'RotateLeft', holdOptions, noActions);

        expect(spawn(createState(), true).rotation).toBe(Rotation.Left);
    });

    test('does not rotate explicit spawns (tray piece pick, RESET)', () => {
        startPieceShortcut('keyboard:KeyX', 'RotateRight', holdOptions, noActions);

        expect(spawn(createState()).rotation).toBe(Rotation.Spawn);
    });

    test('180 is ignored outside SRS+ and the piece spawns unrotated', () => {
        startPieceShortcut('keyboard:KeyX', 'Rotate180', holdOptions, noActions);

        expect(spawn(createState({ rotationSystem: 'srs' }), true).rotation).toBe(Rotation.Spawn);
    });

    test.each(['classic', 'srs'])('uses the %s rotation system', (rotationSystem) => {
        startPieceShortcut('keyboard:KeyX', 'RotateLeft', holdOptions, noActions);

        expect(spawn(createState({ rotationSystem }), true).rotation).toBe(Rotation.Left);
    });

    test('spawns unrotated when every kick is blocked', () => {
        const field = new Field({});
        const spawnMove = createSpawnMove(Piece.T, true);
        const spawnCells = getBlockPositions(
            spawnMove.type, spawnMove.rotation, spawnMove.coordinate.x, spawnMove.coordinate.y,
        ).map(toPositionIndex);
        for (let index = 0; index < 240; index += 1) {
            if (!spawnCells.includes(index)) {
                field.setToPlayField(index, Piece.Gray);
            }
        }
        startPieceShortcut('keyboard:KeyX', 'RotateRight', holdOptions, noActions);

        const piece = spawn(createState({ field }), true);

        expect(piece.rotation).toBe(Rotation.Spawn);
        expect(piece.coordinate).toEqual(spawnMove.coordinate);
    });

    test('adds no extra history entry and never cuts DAS', () => {
        startPieceShortcut('keyboard:KeyX', 'RotateRight', holdOptions, noActions);

        spawn(createState(), true);

        expect(actions.registerHistoryTask).toHaveBeenCalledTimes(1);
        expect(dasModule.cutDasHolds).not.toHaveBeenCalled();
    });

    test('leaves no rotation evidence for INPUT statistics', () => {
        startPieceShortcut('keyboard:KeyX', 'RotateRight', holdOptions, noActions);
        const state = createState();

        const next = fieldEditorActions.spawnPiece({
            piece: Piece.T, srs: true, spawnRotationApplies: true,
        })(state);

        expect(next.events).toBeUndefined();
        expect(state.events.lastPieceManipulation).toBeUndefined();
    });
});

describe('spawn rotation call sites', () => {
    test('the next piece after a lock asks for spawn rotation', () => {
        (actions.spawnPiece as jest.Mock).mockClear();
        const state: any = {
            ...createState(),
            fumen: {
                currentIndex: 0,
                pages: [{
                    index: 0,
                    field: { obj: new Field({}) },
                    comment: { text: '#Q=[](T)IO' },
                    flags: { lock: true, mirror: false, colorize: true, rise: false, quiz: true },
                }],
            },
            editorUi: { primaryTool: 'piece', pieceLayout: 'play', infinitePieceQueue: false },
            coldClear: { queuePreview: null },
            tree: { enabled: false },
        };

        fieldEditorActions.spawnNextPieceFromColdClearQueue()(state);

        expect((actions.spawnPiece as jest.Mock).mock.calls[0][0]).toEqual(expect.objectContaining({
            piece: Piece.T,
            spawnRotationApplies: true,
        }));
    });
});

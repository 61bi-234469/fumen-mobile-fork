import { actions } from '../../actions';
import { Piece, Rotation } from '../../lib/enums';
import { Field } from '../../lib/fumen/field';
import { createInputReplayContext } from '../../lib/input_replay';

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

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { fieldEditorActions, isSevenBagGrayInput } = require('../field_editor');

describe('spawnNextPieceFromColdClearQueue', () => {
    test('writes the INPUT B2B chain as a number so a reload and Sold Slear read the same level', () => {
        (actions.setCommentText as jest.Mock).mockClear();
        const state: any = {
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
            mode: { rotationSystem: 'srsPlus' },
            tree: { enabled: false },
        };

        fieldEditorActions.spawnNextPieceFromColdClearQueue({
            stats: { b2bChain: 3, renChain: 2, pieces: 4, lines: 8, perfectClears: 0 },
        })(state);

        expect((actions.setCommentText as jest.Mock).mock.calls[0][0].text).toBe('b2b=3 combo=2 | #Q=[](T)IO');
        (actions.setCommentText as jest.Mock).mockClear();
    });

    test('does not advance a quiz-ref queue again after an INPUT context lock', () => {
        (actions.setCommentText as jest.Mock).mockClear();
        (actions.spawnPiece as jest.Mock).mockClear();
        const flags = { lock: true, mirror: false, colorize: true, rise: false, quiz: true };
        const state: any = {
            fumen: {
                currentIndex: 1,
                pages: [{
                    flags,
                    index: 0,
                    field: { obj: new Field({}) },
                    comment: { text: '#Q=[](T)TIO' },
                    piece: { type: Piece.T, rotation: Rotation.Spawn, coordinate: { x: 4, y: 0 } },
                }, {
                    flags,
                    index: 1,
                    field: { obj: new Field({}) },
                    comment: { ref: 0 },
                }],
            },
            editorUi: { primaryTool: 'piece', pieceLayout: 'play', infinitePieceQueue: false },
            coldClear: { queuePreview: null },
            mode: { rotationSystem: 'srsPlus' },
            tree: { enabled: false },
        };

        // The ref already resolves to (T)IO; placing the first T must not consume the second.
        fieldEditorActions.spawnNextPieceFromColdClearQueue({
            stats: { b2bChain: 0, renChain: 0, pieces: 1, lines: 0, perfectClears: 0 },
            placedPiece: Piece.T,
        })(state);

        expect((actions.setCommentText as jest.Mock).mock.calls[0][0].text).toBe('#Q=[](T)IO');
        expect((actions.spawnPiece as jest.Mock).mock.calls[0][0].piece).toBe(Piece.T);
        (actions.setCommentText as jest.Mock).mockClear();
    });
});

describe('harddrop', () => {
    test('continues seven-bag gray INPUT on a detached workspace branch', () => {
        const state: any = {
            fumen: {
                currentIndex: 1,
                pages: [
                    { internal: undefined },
                    { internal: { sevenBagGrayWorkspace: true } },
                    { internal: undefined },
                ],
            },
            editorUi: { primaryTool: 'piece', pieceLayout: 'play', infinitePieceQueue: true },
            mode: { screen: 'Editor', sevenBagGrayEnabled: true },
        };

        expect(isSevenBagGrayInput(state)).toBe(true);
    });

    test('keeps rotation evidence while dropping a rotated INPUT mino to the floor', () => {
        const state: any = {
            fumen: {
                currentIndex: 0,
                pages: [{
                    index: 0,
                    field: { obj: new Field({}) },
                    comment: { text: '#Q=[](T)IOLJSZ' },
                    flags: { lock: true, mirror: false, colorize: true, rise: false, quiz: true },
                    piece: { type: Piece.T, rotation: Rotation.Right, coordinate: { x: 4, y: 5 } },
                }],
            },
            editorUi: { primaryTool: 'piece', pieceLayout: 'play', infinitePieceQueue: false },
            events: { inferences: [], lastPieceManipulation: { direction: 'cw', kickIndex: 0 } },
            coldClear: { queuePreview: null },
            mode: { sevenBagGrayEnabled: false },
            tree: { grayAfterLineClear: false },
        };

        fieldEditorActions.harddrop()(state);

        expect((actions.setCommentText as jest.Mock).mock.calls[0][0].text)
            .toContain('inputRotation=cw:0');
    });

    test('routes Replay INPUT locks through cancel or multi-row tank state', () => {
        (actions.insertPage as jest.Mock).mockClear();
        (actions.spawnNextPieceFromColdClearQueue as jest.Mock).mockClear();
        const context = createInputReplayContext({
            resolvedOptions: {}, locks: [], terminal: { frame: 0 },
        } as any, 0, 0);
        const state: any = {
            fumen: {
                currentIndex: 0,
                pages: [{
                    index: 0,
                    field: { obj: new Field({}) },
                    comment: { text: '#Q=[](T)IOLJSZ' },
                    flags: { lock: true, mirror: false, colorize: true, rise: true, quiz: true },
                    piece: { type: Piece.T, rotation: Rotation.Spawn, coordinate: { x: 4, y: 5 } },
                    internal: { inputReplayContext: context },
                }],
            },
            editorUi: { primaryTool: 'piece', pieceLayout: 'play', infinitePieceQueue: false },
            events: { inferences: [], lastPieceManipulation: undefined },
            coldClear: { queuePreview: null },
            mode: { sevenBagGrayEnabled: false },
            tree: { grayAfterLineClear: true },
        };

        fieldEditorActions.harddrop()(state);

        expect(actions.insertPage).toHaveBeenCalledWith({ index: 1, skipGrayAfterLineClear: true });
        expect(actions.spawnNextPieceFromColdClearQueue).toHaveBeenCalledWith(expect.objectContaining({
            placedPiece: Piece.T,
            stats: expect.objectContaining({ pieces: 1 }),
        }));
        expect(state.fumen.pages[0].flags.rise).toBeFalsy();
        expect(state.fumen.pages[0].internal.inputReplayContext.garbage.last).toMatchObject({
            attack: 0,
            cancelled: 0,
        });
    });
});

import { actions } from '../../actions';
import { Piece, Rotation } from '../../lib/enums';
import { Field } from '../../lib/fumen/field';

jest.mock('../../actions', () => ({
    actions: {
        resetInferencePiece: jest.fn(() => () => undefined),
        registerHistoryTask: jest.fn(() => () => undefined),
        reopenCurrentPage: jest.fn(() => () => undefined),
        setCommentText: jest.fn(() => () => undefined),
        insertPage: jest.fn(() => () => undefined),
        openPage: jest.fn(() => () => undefined),
        spawnNextPieceFromColdClearQueue: jest.fn(() => () => undefined),
    },
}));

jest.mock('../../lib/cold_clear/ColdClearWrapper', () => ({
    ColdClearWrapper: jest.fn().mockImplementation(() => ({})),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { fieldEditorActions, isSevenBagGrayInput } = require('../field_editor');

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
});

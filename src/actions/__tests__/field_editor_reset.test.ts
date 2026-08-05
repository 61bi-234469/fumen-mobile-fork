import { Field } from '../../lib/fumen/field';
import { Piece } from '../../lib/enums';

jest.mock('../../actions', () => ({
    actions: {
        commitCommentText: jest.fn(() => () => undefined),
        clearFieldAndPiece: jest.fn(() => () => undefined),
        setCommentText: jest.fn(({ pageIndex, text }) => (state: any) => {
            const pages = state.fumen.pages.slice();
            pages[pageIndex] = {
                ...pages[pageIndex],
                internal: { ...pages[pageIndex].internal, hiddenComment: text },
            };
            return { fumen: { ...state.fumen, pages } };
        }),
        spawnPiece: jest.fn(() => () => undefined),
        changePieceAction: jest.fn(() => () => undefined),
        registerHistoryTask: jest.fn(() => () => undefined),
    },
}));

jest.mock('../../lib/cold_clear/ColdClearWrapper', () => ({
    ColdClearWrapper: jest.fn().mockImplementation(() => ({})),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { fieldEditorActions } = require('../field_editor');

describe('resetFieldAndPiece', () => {
    test('restarts the seven-bag gray cycle when resetting a partially completed page', () => {
        const state: any = {
            fumen: {
                currentIndex: 0,
                pages: [{
                    index: 0,
                    field: { obj: new Field({}) },
                    comment: {},
                    flags: { lock: false, mirror: false, colorize: true, rise: false, quiz: false },
                    internal: {
                        hiddenComment: '#Q=[](T)IOLJSZ',
                        sevenBagGrayProgress: { bag: 3, pieces: 10, lines: 2, perfectClears: 0 },
                        sevenBagGrayDisplay: { pieces: [Piece.T], rowMap: [0] },
                    },
                }],
            },
            editorUi: { infinitePieceQueue: true, lastMino: Piece.T },
            mode: { rotationSystem: 'srs' },
        };

        const next = fieldEditorActions.resetFieldAndPiece()(state);
        const internal = next.fumen.pages[0].internal;

        expect(internal.hiddenComment).toMatch(/^#Q=/);
        expect(internal.sevenBagGrayProgress).toBeUndefined();
        expect(internal.sevenBagGrayDisplay).toBeUndefined();
    });
});

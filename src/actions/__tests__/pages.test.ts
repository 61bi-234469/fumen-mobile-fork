import { Field } from '../../lib/fumen/field';
import { Piece } from '../../lib/enums';

const noopAction = () => () => undefined;

jest.mock('../../actions', () => ({
    actions: {
        removeUnsettledItems: noopAction,
        commitCommentText: noopAction,
        registerHistoryTask: noopAction,
        reopenCurrentPage: noopAction,
    },
}));

jest.mock('../memento', () => ({
    mementoActions: {
        registerHistoryTask: noopAction,
    },
}));

// tslint:disable-next-line:no-var-requires
const { pageActions } = require('../pages');

const flags = {
    lock: false,
    mirror: false,
    colorize: true,
    rise: false,
    quiz: false,
};

describe('pageActions.insertNewPage', () => {
    test('creates a blank page even when gray-after-line-clear is enabled', () => {
        const previousField = new Field({});
        previousField.add(0, 0, Piece.T);
        const state = {
            fumen: {
                currentIndex: 0,
                maxPage: 1,
                pages: [{
                    index: 0,
                    field: { obj: previousField },
                    comment: { text: '' },
                    flags: { ...flags },
                }],
            },
            tree: {
                rootId: null,
                nodes: [],
                grayAfterLineClear: true,
            },
            history: { undoCount: 0, redoCount: 0 },
        } as any;

        const next = pageActions.insertNewPage({ index: 1 })(state) as any;
        const insertedField = next.fumen.pages[1].field.obj as Field;

        expect(insertedField.toPlayFieldPieces().every(piece => piece === Piece.Empty)).toBe(true);
        expect((next.fumen.pages[0].field.obj as Field).get(0, 0)).toBe(Piece.T);
    });
});

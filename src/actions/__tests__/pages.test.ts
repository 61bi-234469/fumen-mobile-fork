import { Field } from '../../lib/fumen/field';
import { AnimationState, Piece, TouchTypes } from '../../lib/enums';

const noopAction = () => () => undefined;

jest.mock('../../actions', () => ({
    actions: {
        removeUnsettledItems: noopAction,
        commitCommentText: noopAction,
        registerHistoryTask: noopAction,
        reopenCurrentPage: noopAction,
        startAnimation: noopAction,
        fixInferencePiece: noopAction,
        clearInferencePiece: noopAction,
        clearRectSelection: noopAction,
        setComment: noopAction,
        setField: noopAction,
        setFieldColor: noopAction,
        setSentLine: noopAction,
        setHold: noopAction,
        setNext: noopAction,
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

describe('pageActions.openPage', () => {
    const makePage = (index: number) => ({
        index,
        field: { obj: new Field({}) },
        comment: { text: '' },
        flags: { ...flags },
    });

    const makeState = (tree: any) => ({
        tree,
        play: { status: AnimationState.Pause },
        events: { inferences: [] },
        mode: { ghostVisible: false, touch: TouchTypes.Drawing },
        cache: {},
        fumen: {
            currentIndex: 0,
            maxPage: 2,
            pages: [makePage(0), makePage(1)],
        },
        history: { undoCount: 0, redoCount: 0 },
    } as any);

    test('syncs activeNodeId while tree mode is disabled but tree data exists', () => {
        const state = makeState({
            enabled: false,
            rootId: 'root',
            nodes: [
                { id: 'root', parentId: null, pageIndex: -1, childrenIds: ['n0'] },
                { id: 'n0', parentId: 'root', pageIndex: 0, childrenIds: ['n1'] },
                { id: 'n1', parentId: 'n0', pageIndex: 1, childrenIds: [] },
            ],
            activeNodeId: 'n0',
        });

        const next = pageActions.openPage({ index: 1 })(state) as any;

        expect(next.fumen.currentIndex).toBe(1);
        expect(next.tree.activeNodeId).toBe('n1');
    });

    test('leaves tree state untouched when no tree data exists', () => {
        const state = makeState({
            enabled: false,
            rootId: null,
            nodes: [],
            activeNodeId: null,
        });

        const next = pageActions.openPage({ index: 1 })(state) as any;

        expect(next.fumen.currentIndex).toBe(1);
        expect(next.tree).toBeUndefined();
    });
});

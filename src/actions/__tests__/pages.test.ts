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
            mode: { pageRotationLimit: 0 },
            history: { undoCount: 0, redoCount: 0 },
        } as any;

        const next = pageActions.insertNewPage({ index: 1 })(state) as any;
        const insertedField = next.fumen.pages[1].field.obj as Field;

        expect(insertedField.toPlayFieldPieces().every(piece => piece === Piece.Empty)).toBe(true);
        expect((next.fumen.pages[0].field.obj as Field).get(0, 0)).toBe(Piece.T);
    });
});

describe('pageActions.applyPageRotation', () => {
    const makeState = (
        { limit, pageCount, currentIndex }:
            { limit: number, pageCount: number, currentIndex: number },
    ) => {
        const pages = Array.from({ length: pageCount }).map((_, index) => ({
            index,
            field: index === 0 ? { obj: new Field({}) } : { ref: 0 },
            comment: index === 0 ? { text: `page-${index}` } : { ref: 0 },
            flags: { ...flags },
        }));
        return {
            play: { status: AnimationState.Pause },
            events: { inferences: [] },
            mode: {
                ghostVisible: false,
                touch: TouchTypes.Drawing,
                pageRotationLimit: limit,
            },
            cache: {},
            tree: { enabled: false, rootId: null, nodes: [], activeNodeId: null },
            fumen: { currentIndex, pages, maxPage: pageCount },
            history: { undoCount: 0, redoCount: 0 },
        } as any;
    };

    test('treats 0 as no limit', () => {
        const state = makeState({ limit: 0, pageCount: 10, currentIndex: 9 });

        expect(pageActions.applyPageRotation()(state)).toBeUndefined();
    });

    test('does nothing while the page count is within the limit', () => {
        const state = makeState({ limit: 5, pageCount: 5, currentIndex: 4 });

        expect(pageActions.applyPageRotation()(state)).toBeUndefined();
    });

    test('drops the oldest pages and keeps the current page selected', () => {
        const state = makeState({ limit: 3, pageCount: 6, currentIndex: 5 });

        const next = pageActions.applyPageRotation()(state) as any;

        expect(next.fumen.pages).toHaveLength(3);
        expect(next.fumen.maxPage).toBe(3);
        expect(next.fumen.currentIndex).toBe(2);
        // 残った先頭ページは参照ではなくキーページになり、コメントも確定している
        expect(next.fumen.pages[0].field.obj).toBeDefined();
        expect(next.fumen.pages[0].comment.text).toBe('page-0');
        expect(next.fumen.pages.every((page: any) => (page.field.ref ?? 0) >= 0)).toBe(true);
    });

    test('never drops pages at or after the current page', () => {
        const state = makeState({ limit: 2, pageCount: 6, currentIndex: 1 });

        const next = pageActions.applyPageRotation()(state) as any;

        expect(next.fumen.pages).toHaveLength(5);
        expect(next.fumen.currentIndex).toBe(0);
    });

    // INPUTのハードドロップだけでなく、通常のページ追加でも上限が効く
    test('trims from the front when an ordinary page insert exceeds the limit', () => {
        const state = makeState({ limit: 3, pageCount: 3, currentIndex: 2 });

        const next = pageActions.insertNewPage({ index: 3 })(state) as any;

        // 追加で4ページになった分を先頭から1枚落とし、追加したページに留まる
        expect(next.fumen.pages).toHaveLength(3);
        expect(next.fumen.maxPage).toBe(3);
        expect(next.fumen.currentIndex).toBe(2);
    });

    test('leaves an ordinary page insert untouched while the limit is 0', () => {
        const state = makeState({ limit: 0, pageCount: 3, currentIndex: 2 });

        const next = pageActions.insertNewPage({ index: 3 })(state) as any;

        expect(next.fumen.pages).toHaveLength(4);
        expect(next.fumen.currentIndex).toBe(3);
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

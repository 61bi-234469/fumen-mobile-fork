/**
 * @jest-environment jsdom
 */
import { ModeTypes, Piece, TouchTypes } from '../../lib/enums';
import { Field } from '../../lib/fumen/field';
import { Page } from '../../lib/fumen/types';
import { HighlightType } from '../../state_types';

jest.mock('../../actions', () => ({
    actions: {
        openPage: () => () => undefined,
        reopenCurrentPage: () => () => undefined,
        fixInferencePiece: () => () => undefined,
        ontouchMoveField: () => () => undefined,
        ontouchMoveSentLine: () => () => undefined,
        registerHistoryTask: () => () => undefined,
    },
    main: {},
}));

jest.mock('../../memento', () => ({
    memento: {
        lastKey: jest.fn(),
    },
    localStorageWrapper: {
        saveViewSettings: jest.fn(),
    },
}));

jest.mock('../../states', () => ({
    resources: {
        konva: {
            stage: {
                isReady: false,
            },
        },
        modals: {},
    },
}));

jest.mock('../../env', () => ({
    PageEnv: {
        Version: 'test',
        Debug: false,
    },
}));

jest.mock('../cold_clear', () => ({
    coldClearActions: {},
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { fieldEditorActions } = require('../field_editor');

const defaultFlags = {
    lock: false,
    mirror: false,
    colorize: true,
    rise: false,
    quiz: false,
};

const createPage = (): Page => ({
    index: 0,
    field: { obj: new Field({}) },
    comment: { text: '' },
    flags: { ...defaultFlags },
});

const emptyBlocks = (count: number) => Array.from({ length: count }, () => ({
    piece: Piece.Empty,
    highlight: HighlightType.Normal,
}));

interface StateOptions {
    touch?: TouchTypes;
    modePiece?: Piece;
    eventsPiece?: Piece;
    lastTouchedIndex?: number;
    lastTouchedSentIndex?: number;
    page?: Page;
    fieldBlocks?: ReturnType<typeof emptyBlocks>;
}

const createState = (options: StateOptions = {}) => {
    const page = options.page ?? createPage();
    return {
        mode: {
            touch: options.touch ?? TouchTypes.Drawing,
            type: ModeTypes.DrawingTool,
            piece: options.modePiece,
            ghostVisible: true,
        },
        events: {
            piece: options.eventsPiece,
            drawing: false,
            inferences: [],
            prevPage: undefined,
            updated: false,
            lastTouchedIndex: options.lastTouchedIndex,
            lastTouchedSentIndex: options.lastTouchedSentIndex,
        },
        fumen: {
            pages: [page],
            currentIndex: 0,
            maxPage: 1,
            guideLineColor: true,
        },
        cache: {
            currentInitField: new Field({}),
        },
        field: options.fieldBlocks ?? emptyBlocks(240),
        sentLine: emptyBlocks(10),
    } as any;
};

describe('stroke interpolation on the field', () => {
    test('fills the Bresenham gap between the previous and current cell', () => {
        const page = createPage();
        const state = createState({
            page,
            touch: TouchTypes.Drawing,
            modePiece: Piece.Gray,
            eventsPiece: Piece.Gray,
            lastTouchedIndex: 0,
        });

        const next = fieldEditorActions.ontouchMoveField({ index: 4 })(state) as any;

        const pre = page.commands!.pre;
        expect(pre['block-1']).toMatchObject({ piece: Piece.Gray });
        expect(pre['block-2']).toMatchObject({ piece: Piece.Gray });
        expect(pre['block-3']).toMatchObject({ piece: Piece.Gray });
        expect(pre['block-4']).toMatchObject({ piece: Piece.Gray });
        expect(next.events.lastTouchedIndex).toBe(4);
    });

    test('fills a diagonal gap', () => {
        const page = createPage();
        const state = createState({
            page,
            touch: TouchTypes.Drawing,
            modePiece: Piece.Gray,
            eventsPiece: Piece.Gray,
            lastTouchedIndex: 0,
        });

        fieldEditorActions.ontouchMoveField({ index: 22 })(state);

        const pre = page.commands!.pre;
        expect(pre['block-11']).toMatchObject({ piece: Piece.Gray });
        expect(pre['block-22']).toMatchObject({ piece: Piece.Gray });
    });

    test('does not interpolate on the first move of a stroke', () => {
        const page = createPage();
        const state = createState({
            page,
            touch: TouchTypes.Drawing,
            modePiece: Piece.Gray,
            eventsPiece: Piece.Gray,
            lastTouchedIndex: undefined,
        });

        const next = fieldEditorActions.ontouchMoveField({ index: 4 })(state) as any;

        const pre = page.commands!.pre;
        expect(pre['block-4']).toMatchObject({ piece: Piece.Gray });
        expect(pre['block-1']).toBeUndefined();
        expect(pre['block-2']).toBeUndefined();
        expect(pre['block-3']).toBeUndefined();
        expect(next.events.lastTouchedIndex).toBe(4);
    });

    test('interpolates row fills vertically in FillRow mode', () => {
        const page = createPage();
        const state = createState({
            page,
            touch: TouchTypes.FillRow,
            modePiece: Piece.Gray,
            eventsPiece: Piece.Gray,
            lastTouchedIndex: 5,
        });

        fieldEditorActions.ontouchMoveField({ index: 25 })(state);

        const pre = page.commands!.pre;
        // Row 1 (cell 15) sits between cells 5 and 25 and must be filled too.
        expect(pre['block-11']).toMatchObject({ piece: Piece.Gray });
        expect(pre['block-21']).toMatchObject({ piece: Piece.Gray });
    });

    test('interpolates right-drag erase over existing blocks', () => {
        const page = createPage();
        page.commands = {
            pre: {
                'block-1': { x: 1, y: 0, piece: Piece.I, type: 'block' },
                'block-2': { x: 2, y: 0, piece: Piece.I, type: 'block' },
                'block-3': { x: 3, y: 0, piece: Piece.I, type: 'block' },
                'block-4': { x: 4, y: 0, piece: Piece.I, type: 'block' },
            },
        };
        const fieldBlocks = emptyBlocks(240);
        for (const index of [1, 2, 3, 4]) {
            fieldBlocks[index] = { piece: Piece.I, highlight: HighlightType.Normal };
        }
        const state = createState({
            page,
            fieldBlocks,
            touch: TouchTypes.Drawing,
            modePiece: Piece.Gray,
            eventsPiece: Piece.Empty,
            lastTouchedIndex: 0,
        });

        fieldEditorActions.onrightMoveField({ index: 4 })(state);

        const pre = page.commands!.pre;
        expect(pre['block-1']).toBeUndefined();
        expect(pre['block-2']).toBeUndefined();
        expect(pre['block-3']).toBeUndefined();
        expect(pre['block-4']).toBeUndefined();
    });
});

describe('interpolation exclusions', () => {
    test('does not interpolate inference drawing (Drawing without a selected piece)', () => {
        const page = createPage();
        const state = createState({
            page,
            touch: TouchTypes.Drawing,
            modePiece: undefined,
            eventsPiece: Piece.Gray,
            lastTouchedIndex: 0,
        });

        const next = fieldEditorActions.ontouchMoveField({ index: 4 })(state) as any;

        expect(next.events.inferences).toEqual([4]);
        expect(next.events.lastTouchedIndex).toBe(0);
    });

    test('does not interpolate in Piece mode', () => {
        const page = createPage();
        const state = createState({
            page,
            touch: TouchTypes.Piece,
            modePiece: undefined,
            eventsPiece: Piece.Gray,
            lastTouchedIndex: 0,
        });

        const next = fieldEditorActions.ontouchMoveField({ index: 4 })(state) as any;

        expect(next.events.inferences).toEqual([4]);
        expect(next.events.lastTouchedIndex).toBe(0);
    });
});

describe('touch trail lifecycle', () => {
    test('ontouchEnd clears the trail', () => {
        const page = createPage();
        const state = createState({
            page,
            touch: TouchTypes.Drawing,
            modePiece: Piece.Gray,
            eventsPiece: Piece.Gray,
            lastTouchedIndex: 5,
        });

        const next = fieldEditorActions.ontouchEnd()(state) as any;

        expect(next.events.lastTouchedIndex).toBeUndefined();
        expect(next.events.piece).toBeUndefined();
    });

    test('resetFieldTouchTrail clears the trail and is a no-op when already clear', () => {
        const withTrail = createState({ lastTouchedIndex: 5 });
        const cleared = fieldEditorActions.resetFieldTouchTrail()(withTrail) as any;
        expect(cleared.events.lastTouchedIndex).toBeUndefined();

        const withoutTrail = createState({});
        expect(fieldEditorActions.resetFieldTouchTrail()(withoutTrail)).toBeUndefined();
    });

    test('does not interpolate after the trail was reset', () => {
        const page = createPage();
        const state = createState({
            page,
            touch: TouchTypes.Drawing,
            modePiece: Piece.Gray,
            eventsPiece: Piece.Gray,
            lastTouchedIndex: 5,
        });

        const afterReset = {
            ...state,
            events: {
                ...state.events,
                ...(fieldEditorActions.resetFieldTouchTrail()(state) as any).events,
            },
        };
        fieldEditorActions.ontouchMoveField({ index: 9 })(afterReset);

        const pre = page.commands!.pre;
        expect(pre['block-9']).toMatchObject({ piece: Piece.Gray });
        expect(pre['block-6']).toBeUndefined();
        expect(pre['block-7']).toBeUndefined();
        expect(pre['block-8']).toBeUndefined();
    });

    test('a stale trail does not bridge into a new stroke', () => {
        const page = createPage();
        const state = createState({
            page,
            touch: TouchTypes.Drawing,
            modePiece: Piece.Gray,
            eventsPiece: undefined,
            lastTouchedIndex: 0,
        });

        const next = fieldEditorActions.ontouchStartField({ index: 9 })(state) as any;

        expect(next.events.lastTouchedIndex).toBeUndefined();
    });
});

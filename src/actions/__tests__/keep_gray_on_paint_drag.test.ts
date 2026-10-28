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
const { drawBlockActions } = require('../draw_block');

const GRAY_INDEX = 1;
const T_INDEX = 3;

const createPage = (): Page => ({
    index: 0,
    field: { obj: new Field({}) },
    comment: { text: '' },
    flags: { lock: false, mirror: false, colorize: true, rise: false, quiz: false },
});

const createState = (modePiece: Piece, keepGrayOnPaintDrag: boolean) => {
    const page = createPage();
    const initField = new Field({});
    initField.add(GRAY_INDEX, 0, Piece.Gray);
    initField.add(T_INDEX, 0, Piece.T);
    const field = Array.from({ length: 240 }, () => ({ piece: Piece.Empty, highlight: HighlightType.Normal }));
    field[GRAY_INDEX] = { piece: Piece.Gray, highlight: HighlightType.Normal };
    field[T_INDEX] = { piece: Piece.T, highlight: HighlightType.Normal };
    const state = {
        field,
        mode: {
            keepGrayOnPaintDrag,
            touch: TouchTypes.Drawing,
            type: ModeTypes.DrawingTool,
            piece: modePiece,
        },
        events: {
            piece: undefined,
            drawing: false,
            inferences: [],
            prevPage: undefined,
            updated: false,
        },
        fumen: { pages: [page], currentIndex: 0, maxPage: 1, guideLineColor: true },
        cache: { currentInitField: initField },
        sentLine: Array.from({ length: 10 }, () => ({ piece: Piece.Empty, highlight: HighlightType.Normal })),
    } as any;
    return { page, state };
};

const drag = (state: any, start: number, path: number[]) => {
    let current = { ...state, ...drawBlockActions.ontouchStartField({ index: start })(state) };
    for (const index of [start, ...path]) {
        const next = drawBlockActions.ontouchMoveField({ index })(current);
        current = next === undefined ? current : { ...current, ...next };
    }
    return current;
};

describe('keepGrayOnPaintDrag', () => {
    test('a drag started on an empty cell skips gray blocks', () => {
        const { page, state } = createState(Piece.I, true);

        const end = drag(state, 0, [GRAY_INDEX, 2]);

        expect(end.events.preserveGray).toBe(true);
        const pre = page.commands!.pre;
        expect(pre['block-0']).toMatchObject({ piece: Piece.I });
        expect(pre[`block-${GRAY_INDEX}`]).toBeUndefined();
        expect(pre['block-2']).toMatchObject({ piece: Piece.I });
    });

    test('an eraser drag started on a colored block keeps gray blocks', () => {
        const { page, state } = createState(Piece.Empty, true);

        drag(state, T_INDEX, [2, GRAY_INDEX]);

        const pre = page.commands!.pre;
        expect(pre[`block-${T_INDEX}`]).toMatchObject({ piece: Piece.Empty });
        expect(pre[`block-${GRAY_INDEX}`]).toBeUndefined();
    });

    test('a drag started on gray recolors gray blocks as usual', () => {
        const { page, state } = createState(Piece.I, true);

        const end = drag(state, GRAY_INDEX, [2]);

        expect(end.events.preserveGray).toBe(false);
        const pre = page.commands!.pre;
        expect(pre[`block-${GRAY_INDEX}`]).toMatchObject({ piece: Piece.I });
        expect(pre['block-2']).toMatchObject({ piece: Piece.I });
    });

    test('gray blocks are overwritten when the setting is off', () => {
        const { page, state } = createState(Piece.I, false);

        drag(state, 0, [GRAY_INDEX]);

        expect(page.commands!.pre[`block-${GRAY_INDEX}`]).toMatchObject({ piece: Piece.I });
    });

    test('the stroke end clears the marker', () => {
        const { state } = createState(Piece.I, true);
        const end = drag(state, 0, []);

        const next = drawBlockActions.ontouchEnd()(end);

        expect({ ...end, ...next }.events.preserveGray).toBeUndefined();
    });
});

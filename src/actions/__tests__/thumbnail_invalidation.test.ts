/**
 * @jest-environment jsdom
 */
import { AnimationState, TouchTypes } from '../../lib/enums';
import { Field } from '../../lib/fumen/field';
import { Page } from '../../lib/fumen/types';

const noopAction = () => () => undefined;

jest.mock('../../actions', () => ({
    actions: {
        startAnimation: noopAction,
        fixInferencePiece: noopAction,
        clearInferencePiece: noopAction,
        commitCommentText: noopAction,
        setComment: noopAction,
        setField: noopAction,
        setFieldColor: noopAction,
        setSentLine: noopAction,
        setHold: noopAction,
        setNext: noopAction,
        setPages: noopAction,
        openPage: noopAction,
        setHistoryCount: noopAction,
        reopenCurrentPage: noopAction,
    },
    main: {},
}));

jest.mock('../../memento', () => ({
    memento: {
        register: jest.fn(() => 1),
        save: jest.fn(),
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

const clearThumbnailCacheMock = jest.fn();
jest.mock('../../lib/thumbnail', () => ({
    clearThumbnailCache: (...args: any[]) => clearThumbnailCacheMock(...args),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { mementoActions } = require('../memento');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { pageActions } = require('../pages');

const defaultFlags = {
    lock: false,
    mirror: false,
    colorize: true,
    rise: false,
    quiz: false,
};

const createPages = (): Page[] => [
    {
        index: 0,
        field: { obj: new Field({}) },
        comment: { text: '' },
        flags: { ...defaultFlags },
    },
    {
        index: 1,
        field: { ref: 0 },
        comment: { ref: 0 },
        flags: { ...defaultFlags },
    },
];

const createState = () => ({
    fumen: {
        pages: createPages(),
        currentIndex: 0,
        maxPage: 2,
        guideLineColor: true,
    },
    play: {
        status: AnimationState.Pause,
    },
    events: {
        inferences: [],
    },
    mode: {
        ghostVisible: true,
        touch: TouchTypes.Drawing,
    },
    cache: {},
    tree: {
        enabled: false,
        nodes: [],
        rootId: null,
        activeNodeId: null,
        viewMode: 0,
        grayAfterLineClear: false,
        operationScope: 'node',
        scale: 1.0,
    },
    history: {
        undoCount: 0,
        redoCount: 0,
    },
}) as any;

beforeEach(() => {
    clearThumbnailCacheMock.mockClear();
});

describe('openPage', () => {
    test('does not invalidate the thumbnail cache when reopening the current page', () => {
        const state = createState();

        pageActions.openPage({ index: 0 })(state);

        expect(clearThumbnailCacheMock).not.toHaveBeenCalled();
    });

    test('does not invalidate the thumbnail cache when opening another page', () => {
        const state = createState();

        pageActions.openPage({ index: 1 })(state);

        expect(clearThumbnailCacheMock).not.toHaveBeenCalled();
    });
});

describe('registerHistoryTask', () => {
    test('invalidates the thumbnail cache exactly once per committed operation', () => {
        const state = createState();

        mementoActions.registerHistoryTask({ task: {} as any })(state);

        expect(clearThumbnailCacheMock).toHaveBeenCalledTimes(1);
        expect(clearThumbnailCacheMock).toHaveBeenCalledWith(state.fumen.pages);
    });
});

describe('loadPagesViaHistory', () => {
    test('invalidates the outgoing and restored page arrays', () => {
        const state = createState();
        const restoredPages = createPages();

        mementoActions.loadPagesViaHistory({
            pages: restoredPages,
            index: 0,
            undoCount: 1,
            redoCount: 0,
        })(state);

        expect(clearThumbnailCacheMock).toHaveBeenCalledWith(state.fumen.pages);
        expect(clearThumbnailCacheMock.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
});

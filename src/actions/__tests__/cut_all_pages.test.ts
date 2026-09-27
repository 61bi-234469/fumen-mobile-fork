export {};

const loadNewFumen = jest.fn();
const toast = jest.fn();

jest.mock('../../actions', () => ({
    actions: {},
    main: { loadNewFumen: (...args: unknown[]) => loadNewFumen(...args) },
}));

jest.mock('../memento', () => ({
    mementoActions: {},
}));

// tslint:disable-next-line:no-var-requires
const { pageActions } = require('../pages');

const createState = (pages: unknown[], undoCount: number) => ({
    fumen: { pages, currentIndex: 0 },
    history: { undoCount, redoCount: 0 },
}) as any;

describe('pageActions.finishCutAllPages', () => {
    beforeEach(() => {
        loadNewFumen.mockReset();
        toast.mockReset();
        (global as any).M = { toast };
    });

    afterAll(() => {
        delete (global as any).M;
    });

    test('clears the fumen when nothing changed while the copy was pending', () => {
        const pages = [{ index: 0 }];
        pageActions.finishCutAllPages({ pages, undoCount: 3, pageCount: 1 })(createState(pages, 3));

        expect(loadNewFumen).toHaveBeenCalledTimes(1);
    });

    test('keeps edits made while the copy was pending', () => {
        const pages = [{ index: 0 }];
        const editedPages = [{ index: 0 }];
        pageActions.finishCutAllPages({ pages, undoCount: 3, pageCount: 1 })(createState(editedPages, 4));

        expect(loadNewFumen).not.toHaveBeenCalled();
    });

    test('keeps a different fumen loaded while the copy was pending', () => {
        const pages = [{ index: 0 }];
        pageActions.finishCutAllPages({ pages, undoCount: 3, pageCount: 1 })(createState([{ index: 0 }], 0));

        expect(loadNewFumen).not.toHaveBeenCalled();
    });
});

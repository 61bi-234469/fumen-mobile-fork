/**
 * @jest-environment jsdom
 */
// Temporary investigation test - DO NOT COMMIT (delete after investigation)

jest.mock('../../actions', () => ({
    actions: {
        reopenCurrentPage: () => () => undefined,
        closeListViewMenuModal: () => () => undefined,
        registerHistoryTask: () => () => undefined,
    },
    main: {
        loadPages: jest.fn(),
        addPagesFromClipboard: jest.fn(),
    },
}));

jest.mock('../../memento', () => ({
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

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { listViewActions } = require('../list_view');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { main } = require('../../actions');

const flushPromises = () => new Promise(resolve => setTimeout(resolve, 20));

const rawUrl = 'https://tetristemplate.info/tetgram/?d=v115%40ngwhIewhIewhHeQ4whAeh0EeR4Aeg0RpBtywQ4glg0%3FRpAeBtwwilJeQg0DAU9zBAefi0Gehlg0HeglIegldeRpHeQ%3FpglIeQ4BeAtCeilQ4whBtBeQ4glg0QaQ4whgWgHBeR4g0yh%3FglwwglxhglwhQpwhQaglywBtQpi0JeAAPMARYcRAyv78AQ%2B%3FT7BefiHGehWgHHegWIegWceAtwhwSHeyhFeglA8Aewhg0gl%3FBeQpwhAeg0BeglAPBeAPwhBPBeglA8xwgWwhglBeQ4BehlQ%3FpwhglBeQ4AeRaQeAAPSARYcRAyv78Aw87tCFbEwCz2AAASg%3FwhHeAPwSGeRpwSgWQaEeQpwhwDgHQaBeAtAexSg0AegHwhA%3FeBtAexSgWg0AeQ4AeAPCeAAheAAPSARYcRAyv78Aw87tCFb%3FEwCTNBAAJgwhGeQpglwhFeQ4QpglwhFeBtQ4QaAeh0AtBew%3FSAtQ4AeglAegWCeA8Beg0CeAPBeB8BegHglAtQpRLGewhwD%3FySDexhQpAewSNeAAPMARYcRAyv78AQ%2B7tCGgRpAeQaFeQpA%3FewSQ4whh0AtBewDxwQ4whg0BtBexhAeQ4whAegWAPBeA8wh%3FAeg0QaglBtxwwSCeg0glAtA8R4Deg0BeQaQ4wwA8GeglxSQ%3FpFegHAeQpNeAAPyARYcRAyvL2AhyT7BFbssCTd88AQ%2BT7BF%3FbMLEyI8vBT9rSASY9tCEoo2AMNKSAwxAAAGgxSHexSAeAAQ%3FahHAPCeCAQagHBPBeDAQagHAPCeDAQaCARLQpAeFAxDBeAA%3FDewhwDQLAAGehWg0FeAAgWAAOeAAPVAT9rSASY9tCEY3JB3%3FccRA1AmLBSAAAARgg0Ieg0Heh0glBewhDeilRpwhAeAtBeA%3FAAeA8RpwhBtwwAeBAA8BewDAPwSwwHeQaQ4A8FeQaQ4wwA8%3FOeAAPSARYcRAyv78Aw87tCFbEwCTNBAARggWwhGeAtgWwhG%3FegWglQaBewhhlBegWg0QaBewhg0glBeA8DeQ4glAPQLAeB8%3FCeQ4glQpAexwFexhwSRaDexhQpRaNeAAPSARYcRAyv78Aw8%3F7tCFbEwCz2AAAHgg0IeglQaGehlwhBewhDegWgHwhBeQagW%3FglDeQ4xSQahWGewDgWFeRLAeglKeQaglxhEeRagWwhNeAAA%3FHggHIegWwhGehWQaBeQaDeglg0QaBewhglgWDewDBewhhlE%3FexSQ4glIegWFeRLdeAAARgAPQaGeBPQaGeAPAAQaBeiWDeQ%3F4BegWhHGeAAgHFexSAeglAeSLBexSCexDCeBABexDQLOeAA%3FPAA';

const baseState = () => ({
    fumen: {
        pages: [{
            index: 0,
            field: { obj: new (require('../../lib/fumen/field').Field)({}) },
            comment: { text: '' },
            flags: { lock: false, mirror: false, colorize: true, rise: false, quiz: false },
        }],
        currentIndex: 0,
        maxPage: 1,
        guideLineColor: true,
    },
    listView: {
        exportScope: 'all',
        trimTopBlank: false,
        shortenUrls: false,
        scale: 1.0,
        dragState: { draggingIndex: null, dropTargetIndex: null },
    },
    tree: {
        enabled: false,
        rootId: null,
        activeNodeId: null,
        nodes: [],
        viewMode: 0,
    },
    editorPanel: { enabled: false, tab: 'list' },
    mode: { gifFrameDelayMs: 100 },
});

describe('tmp freeze flow investigation', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        Object.assign(navigator, {
            clipboard: {
                readText: jest.fn().mockResolvedValue(rawUrl),
            },
        });
        (window as any).M = { toast: jest.fn(), Toast: { dismissAll: jest.fn() } };
        (global as any).M = (window as any).M;
    });

    it('runs importPagesFromClipboard (mode=import)', async () => {
        const state = baseState();
        const start = Date.now();
        listViewActions.importPagesFromClipboard({ mode: 'import' })(state);
        await flushPromises();
        // tslint:disable-next-line:no-console
        console.log('import elapsed(ms):', Date.now() - start,
                    'loadPages called:', main.loadPages.mock.calls.length);
        if (main.loadPages.mock.calls.length > 0) {
            // tslint:disable-next-line:no-console
            console.log('loadPages pages:', main.loadPages.mock.calls[0][0].pages.length);
        }
    }, 20000);

    it('runs importPagesFromClipboard (mode=add) then real addPagesFromClipboard', async () => {
        const state = baseState();
        listViewActions.importPagesFromClipboard({ mode: 'add' })(state);
        await flushPromises();
        // tslint:disable-next-line:no-console
        console.log('addPagesFromClipboard called:', main.addPagesFromClipboard.mock.calls.length);
        expect(main.addPagesFromClipboard.mock.calls.length).toBe(1);

        const args = main.addPagesFromClipboard.mock.calls[0][0];
        const start = Date.now();
        const result = listViewActions.addPagesFromClipboard(args)(baseState());
        // tslint:disable-next-line:no-console
        console.log('real addPagesFromClipboard elapsed(ms):', Date.now() - start, 'result type:', typeof result);
    }, 20000);
});

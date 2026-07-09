/**
 * @jest-environment jsdom
 */
import { Piece, Rotation } from '../../lib/enums';
import { Field } from '../../lib/fumen/field';
import { Page } from '../../lib/fumen/types';

jest.mock('../../actions', () => ({
    actions: {},
    main: {},
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

const encodeMock = jest.fn();
jest.mock('../../lib/fumen/fumen', () => ({
    encode: (...args: any[]) => encodeMock(...args),
    decode: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { listViewActions } = require('../list_view');

const flushPromises = () => new Promise(resolve => setTimeout(resolve, 0));

const defaultFlags = {
    lock: false,
    mirror: false,
    colorize: true,
    rise: false,
    quiz: false,
};

const segmentPages = (): Page[] => [
    {
        index: 0,
        field: { obj: new Field({}) },
        comment: { text: '' },
        flags: { ...defaultFlags },
    },
    {
        index: 1,
        field: { ref: 0 },
        comment: { text: 'intermediate' },
        piece: {
            type: Piece.I,
            rotation: Rotation.Spawn,
            coordinate: { x: 3, y: 0 },
        },
        flags: { ...defaultFlags, lock: true },
    },
    {
        index: 2,
        field: { ref: 0 },
        comment: { text: 'active' },
        flags: { ...defaultFlags },
    },
];

const treeState = (enabled: boolean) => ({
    enabled,
    rootId: enabled ? 'vr' : null,
    activeNodeId: enabled ? 'n2' : null,
    nodes: enabled ? [
        { id: 'vr', parentId: null, pageIndex: -1, childrenIds: ['n0'] },
        { id: 'n0', parentId: 'vr', pageIndex: 0, childrenIds: ['n1', 'n2'] },
        { id: 'n1', parentId: 'n0', pageIndex: 1, childrenIds: [] },
        { id: 'n2', parentId: 'n0', pageIndex: 2, childrenIds: [] },
    ] : [],
    viewMode: 0,
});

const createState = (overrides: any = {}) => ({
    fumen: {
        pages: overrides.pages || segmentPages(),
        currentIndex: 2,
        guideLineColor: true,
    },
    listView: {
        exportScope: overrides.exportScope || 'all',
        trimTopBlank: false,
        shortenUrls: overrides.shortenUrls ?? false,
        scale: 1.0,
        dragState: { draggingIndex: null, dropTargetIndex: null },
    },
    tree: treeState(overrides.treeEnabled ?? false),
    mode: { gifFrameDelayMs: 100 },
    coldClear: {
        topBranchCount: 3,
        holdAllowed: true,
        speculate: false,
        nextLimit: null,
        weightsPreset: 0,
        thinkMs: 0,
    },
}) as any;

beforeEach(() => {
    encodeMock.mockReset();
    encodeMock.mockResolvedValue('ENC');
    (global as any).M = { toast: jest.fn() };
});

describe('setExportScope', () => {
    test('updates listView.exportScope', () => {
        const state = createState({ exportScope: 'all' });
        const next = listViewActions.setExportScope({ scope: 'left' })(state) as any;
        expect(next.listView.exportScope).toBe('left');
    });
});

describe('reorderPage', () => {
    test('does not reorder pages while tree mode is enabled', () => {
        const state = createState({ treeEnabled: true });
        const next = listViewActions.reorderPage({ fromIndex: 0, toSlotIndex: 2 })(state) as any;

        expect(next.fumen).toBeUndefined();
        expect(next.listView.dragState).toEqual({ draggingIndex: null, dropTargetIndex: null });
    });
});

describe('setListViewShortenUrls', () => {
    test('updates the saved short URL setting', () => {
        const state = createState({ shortenUrls: false });
        const next = listViewActions.setListViewShortenUrls({ enabled: true })(state) as any;

        expect(next.listView.shortenUrls).toBe(true);
    });
});

describe('openListViewInExternalSite', () => {
    test('opens fumen.zui.jp with D115@ payload for the whole fumen (scope all)', async () => {
        const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);
        const state = createState({ treeEnabled: false, exportScope: 'all' });

        listViewActions.openListViewInExternalSite()(state);
        await flushPromises();

        expect(openSpy).toHaveBeenCalledWith('https://fumen.zui.jp/?D115@ENC', '_blank');
        openSpy.mockRestore();
    });

    test('encodes the active-node segment when tree is enabled and scope is left', async () => {
        const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);
        const state = createState({ treeEnabled: true, exportScope: 'left' });

        listViewActions.openListViewInExternalSite()(state);
        await flushPromises();

        // Root..active segment of the 3-page tree (active n2) has 2 pages.
        expect(encodeMock).toHaveBeenCalledTimes(1);
        expect(encodeMock.mock.calls[0][0]).toHaveLength(2);
        expect(openSpy).toHaveBeenCalledWith('https://fumen.zui.jp/?D115@ENC', '_blank');
        openSpy.mockRestore();
    });

    test('opens TinyURL creation when short URLs are enabled', async () => {
        const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);
        const state = createState({ treeEnabled: false, shortenUrls: true });

        listViewActions.openListViewInExternalSite()(state);
        await flushPromises();

        expect(openSpy).toHaveBeenCalledWith(
            'https://tinyurl.com/create.php?url=https%3A%2F%2Ffumen.zui.jp%2F%3FD115%40ENC',
            '_blank',
        );
        openSpy.mockRestore();
    });
});

describe('openListViewInFumenZui', () => {
    test('opens fumen.zui.jp with a v115 payload', async () => {
        const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);
        const state = createState({ treeEnabled: false, exportScope: 'all' });

        listViewActions.openListViewInFumenZui()(state);
        await flushPromises();

        expect(openSpy).toHaveBeenCalledWith('https://fumen.zui.jp/?v115@ENC', '_blank');
        openSpy.mockRestore();
    });
});

describe('openListViewInFumenForMobile', () => {
    test('opens Fumen for mobile with a v115 payload', async () => {
        const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);
        const state = createState({ treeEnabled: false, exportScope: 'all' });

        listViewActions.openListViewInFumenForMobile()(state);
        await flushPromises();

        expect(openSpy).toHaveBeenCalledWith(
            'https://knewjade.github.io/fumen-for-mobile/#?d=v115@ENC',
            '_blank',
        );
        openSpy.mockRestore();
    });
});

describe('copyListViewUrlToClipboard', () => {
    test('copies the shared URL for the current export scope', async () => {
        const selectAllChildren = jest.fn();
        const selectionSpy = jest.spyOn(document, 'getSelection').mockReturnValue({ selectAllChildren } as any);
        document.execCommand = jest.fn(() => true);
        const state = createState({ treeEnabled: false, exportScope: 'all' });

        listViewActions.copyListViewUrlToClipboard()(state);
        await flushPromises();

        expect(document.execCommand).toHaveBeenCalledWith('copy');
        expect(selectAllChildren.mock.calls[0][0].textContent).toContain('d=v115%40ENC');
        selectionSpy.mockRestore();
    });
});

describe('copyLeftSegmentToClipboard', () => {
    test('copies the active-node segment as v115@ without tree embedding', async () => {
        document.execCommand = jest.fn(() => true);
        const state = createState({ treeEnabled: true, exportScope: 'left' });

        listViewActions.copyLeftSegmentToClipboard()(state);
        await flushPromises();

        expect(encodeMock).toHaveBeenCalledTimes(1);
        expect(encodeMock.mock.calls[0][0]).toHaveLength(2);
        expect(document.execCommand).toHaveBeenCalledWith('copy');
    });
});

describe('exportListViewAsUrl', () => {
    test('encodes a share URL without tree data when tree mode is disabled', async () => {
        const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);
        const state = createState({ treeEnabled: false, shortenUrls: false });

        listViewActions.exportListViewAsUrl()(state);
        await flushPromises();
        await flushPromises();

        expect(openSpy).toHaveBeenCalledTimes(1);
        const url = (openSpy.mock.calls[0][0] as string);
        expect(url).toMatch(/#\?d=v115%40ENC&screen=list&tree=0&treeView=list$/);
        openSpy.mockRestore();
    });

    test('includes tree=1 in the share URL when tree mode is enabled', async () => {
        const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);
        const state = createState({ treeEnabled: true, shortenUrls: false });

        listViewActions.exportListViewAsUrl()(state);
        await flushPromises();
        await flushPromises();

        expect(openSpy).toHaveBeenCalledTimes(1);
        const url = (openSpy.mock.calls[0][0] as string);
        expect(url).toContain('tree=1');
        openSpy.mockRestore();
    });

    test('opens a TinyURL creation link when shortenUrls is enabled', async () => {
        const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);
        const state = createState({ treeEnabled: false, shortenUrls: true });

        listViewActions.exportListViewAsUrl()(state);
        await flushPromises();
        await flushPromises();

        expect(openSpy).toHaveBeenCalledTimes(1);
        const url = (openSpy.mock.calls[0][0] as string);
        expect(url.startsWith('https://tinyurl.com/create.php?url=')).toBe(true);
        openSpy.mockRestore();
    });
});

describe('copyListViewUrlToClipboard toast', () => {
    test('shows the "Copied share URL" toast when tree mode is disabled', async () => {
        const selectAllChildren = jest.fn();
        const selectionSpy = jest.spyOn(document, 'getSelection').mockReturnValue({ selectAllChildren } as any);
        document.execCommand = jest.fn(() => true);
        const state = createState({ treeEnabled: false, exportScope: 'all' });

        listViewActions.copyListViewUrlToClipboard()(state);
        await flushPromises();
        await flushPromises();

        expect(document.execCommand).toHaveBeenCalledWith('copy');
        expect((global as any).M.toast).toHaveBeenCalledWith(
            expect.objectContaining({ html: 'Copied share URL' }),
        );
        selectionSpy.mockRestore();
    });
});

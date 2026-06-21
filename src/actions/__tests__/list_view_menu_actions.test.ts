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
    localStorageWrapper: {},
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
    srs: true,
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
        scale: 1.0,
        dragState: { draggingIndex: null, dropTargetIndex: null },
    },
    tree: treeState(overrides.treeEnabled ?? false),
    mode: { gifFrameDelayMs: 100 },
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

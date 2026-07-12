/**
 * @jest-environment jsdom
 */

export {};

const mockActions: { [name: string]: jest.Mock } = {};

jest.mock('../../actions', () => ({
    actions: mockActions,
    main: {},
}));

const saveViewSettingsMock = jest.fn();
jest.mock('../../memento', () => ({
    localStorageWrapper: {
        saveViewSettings: (...args: any[]) => saveViewSettingsMock(...args),
    },
}));

jest.mock('../../states', () => ({}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { editorPanelActions } = require('../editor_panel');

const createState = (override: any = {}) => ({
    mode: {
        screen: 'Editor',
    },
    listView: {
        trimTopBlank: false,
        shortenUrls: false,
    },
    tree: {
        operationScope: 'node',
        grayAfterLineClear: false,
    },
    coldClear: {
        topBranchCount: 5,
        holdAllowed: true,
        speculate: true,
        nextLimit: null,
        weightsPreset: 0,
        thinkMs: 1000,
    },
    editorPanel: {
        enabled: false,
        tab: 'list',
        width: null,
    },
    ...override,
});

describe('editorPanelActions', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('setEditorSidePanelEnabled', () => {
        test('enables the panel and persists all view settings fields', () => {
            const state = createState();
            const next = editorPanelActions.setEditorSidePanelEnabled({ enabled: true })(state);

            expect(next.editorPanel.enabled).toBe(true);
            expect(next.editorPanel.tab).toBe('list');
            expect(saveViewSettingsMock).toHaveBeenCalledWith({
                trimTopBlank: false,
                shortenUrls: false,
                treeOperationScope: 'node',
                grayAfterLineClear: false,
                editorSidePanel: true,
                editorSidePanelTab: 'list',
                editorSidePanelWidth: null,
                coldClearTopBranchCount: 5,
                coldClearHoldAllowed: true,
                coldClearSpeculate: true,
                coldClearNextLimit: null,
                coldClearWeightsPreset: 0,
                coldClearThinkMs: 1000,
                blackTransparentPaste: false,
                rectFloatingMenuPosition: null,
                rectFloatingMenuScale: 1,
            });
        });

        test('does nothing when the value is unchanged', () => {
            const state = createState();
            const next = editorPanelActions.setEditorSidePanelEnabled({ enabled: false })(state);

            expect(next).toBeUndefined();
            expect(saveViewSettingsMock).not.toHaveBeenCalled();
        });
    });

    describe('setEditorSidePanelTab', () => {
        test('switches the tab and persists it', () => {
            const state = createState();
            const next = editorPanelActions.setEditorSidePanelTab({ tab: 'tree' })(state);

            expect(next.editorPanel.tab).toBe('tree');
            expect(next.editorPanel.enabled).toBe(false);
            expect(saveViewSettingsMock).toHaveBeenCalledWith(expect.objectContaining({
                editorSidePanel: false,
                editorSidePanelTab: 'tree',
            }));
        });

        test('does nothing when the tab is unchanged', () => {
            const state = createState();
            const next = editorPanelActions.setEditorSidePanelTab({ tab: 'list' })(state);

            expect(next).toBeUndefined();
            expect(saveViewSettingsMock).not.toHaveBeenCalled();
        });
    });

    describe('toggleEditorSidePanel', () => {
        beforeEach(() => {
            mockActions.setEditorSidePanelEnabled = jest.fn(({ enabled }) => (state: any) => ({
                editorPanel: {
                    ...state.editorPanel,
                    enabled,
                },
            }));
            mockActions.changeToDrawerScreen = jest.fn(() => () => ({
                mode: {
                    screen: 'Editor',
                },
            }));
        });

        test('enables the panel and enters the editor from the reader', () => {
            const state = createState({
                mode: { screen: 'Reader' },
                editorPanel: { enabled: false, tab: 'list', width: null },
            });
            const next = editorPanelActions.toggleEditorSidePanel()(state);

            expect(mockActions.setEditorSidePanelEnabled).toHaveBeenCalledWith({ enabled: true });
            expect(mockActions.changeToDrawerScreen).toHaveBeenCalledWith({});
            expect(next.editorPanel.enabled).toBe(true);
            expect(next.mode.screen).toBe('Editor');
        });

        test('toggles the panel in the editor without changing screens', () => {
            const state = createState();
            const next = editorPanelActions.toggleEditorSidePanel()(state);

            expect(mockActions.setEditorSidePanelEnabled).toHaveBeenCalledWith({ enabled: true });
            expect(mockActions.changeToDrawerScreen).not.toHaveBeenCalled();
            expect(next.editorPanel.enabled).toBe(true);
        });
    });

    describe('setEditorSidePanelWidth', () => {
        test('updates transiently without persisting while dragging', () => {
            const state = createState();
            const next = editorPanelActions.setEditorSidePanelWidth({ width: 480, persist: false })(state);

            expect(next.editorPanel.width).toBe(480);
            expect(saveViewSettingsMock).not.toHaveBeenCalled();
        });

        test('persists the final width even if the transient value is unchanged', () => {
            const state = createState({
                editorPanel: { enabled: true, tab: 'tree', width: 480 },
            });
            const next = editorPanelActions.setEditorSidePanelWidth({ width: 480 })(state);

            expect(next).toBeUndefined();
            expect(saveViewSettingsMock).toHaveBeenCalledWith(expect.objectContaining({
                editorSidePanelWidth: 480,
            }));
        });

        test('resets to automatic width with null', () => {
            const state = createState({
                editorPanel: { enabled: true, tab: 'tree', width: 480 },
            });
            const next = editorPanelActions.setEditorSidePanelWidth({ width: null })(state);

            expect(next.editorPanel.width).toBeNull();
            expect(saveViewSettingsMock).toHaveBeenCalledWith(expect.objectContaining({
                editorSidePanelWidth: null,
            }));
        });
    });
});

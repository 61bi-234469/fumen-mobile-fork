/**
 * @jest-environment jsdom
 */

export {};

jest.mock('../../actions', () => ({
    actions: {},
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
    listView: {
        trimTopBlank: false,
        shortenUrls: false,
    },
    tree: {
        buttonDropMovesSubtree: false,
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
                buttonDropMovesSubtree: false,
                grayAfterLineClear: false,
                editorSidePanel: true,
                editorSidePanelTab: 'list',
                coldClearTopBranchCount: 5,
                coldClearHoldAllowed: true,
                coldClearSpeculate: true,
                coldClearNextLimit: null,
                coldClearWeightsPreset: 0,
                coldClearThinkMs: 1000,
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
});

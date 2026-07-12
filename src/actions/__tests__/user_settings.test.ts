/**
 * @jest-environment jsdom
 */

const mockActions: { [name: string]: jest.Mock } = {};

jest.mock('../../actions', () => ({
    actions: mockActions,
    main: {},
}));

const saveUserSettingsMock = jest.fn();
jest.mock('../../memento', () => ({
    localStorageWrapper: {
        saveUserSettings: (...args: any[]) => saveUserSettingsMock(...args),
        saveViewSettings: jest.fn(),
    },
}));

jest.mock('../../states', () => ({}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { userSettingsActions } = require('../user_settings');

const baseUserSettings = {
    ghostVisible: true,
    loop: false,
    shortcutLabelVisible: false,
    gradient: '0000000',
    paletteShortcuts: {},
    editShortcuts: {},
    pieceShortcuts: {},
    pieceShortcutDasMs: 167,
    gifFrameDelayMs: 500,
    rotationSystem: 'srs',
    grayAfterLineClear: false,
    trimTopBlank: false,
    editorSidePanel: false,
};

const createState = (override: any = {}) => ({
    mode: {
        ghostVisible: true,
        loop: false,
        shortcutLabelVisible: false,
        gradient: {},
        paletteShortcuts: {},
        editShortcuts: {},
        pieceShortcuts: {},
        pieceShortcutDasMs: 167,
        gifFrameDelayMs: 500,
        rotationSystem: 'srs',
    },
    tree: {
        grayAfterLineClear: true,
        operationScope: 'subtree',
    },
    listView: {
        trimTopBlank: true,
    },
    editorPanel: {
        enabled: true,
        tab: 'list',
    },
    modal: {
        userSettings: true,
    },
    temporary: {
        userSettings: { ...baseUserSettings },
        userSettingsTab: 'field',
    },
    ...override,
});

describe('userSettingsActions', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('copyUserSettingsToTemporary', () => {
        test('copies view settings (gray/trim) into temporary', () => {
            const state = createState();
            const next = userSettingsActions.copyUserSettingsToTemporary()(state);

            expect(next.temporary.userSettings.grayAfterLineClear).toBe(true);
            expect(next.temporary.userSettings.trimTopBlank).toBe(true);
            expect(next.temporary.userSettings.editorSidePanel).toBe(true);
        });
    });

    describe('keepGrayAfterLineClear', () => {
        test('updates temporary while the modal is open', () => {
            const state = createState();
            const next = userSettingsActions.keepGrayAfterLineClear({ enable: true })(state);

            expect(next.temporary.userSettings.grayAfterLineClear).toBe(true);
        });

        test('does nothing when the modal is closed', () => {
            const state = createState({ modal: { userSettings: false } });
            const next = userSettingsActions.keepGrayAfterLineClear({ enable: true })(state);

            expect(next).toBeUndefined();
        });
    });

    describe('keepTrimTopBlank', () => {
        test('updates temporary while the modal is open', () => {
            const state = createState();

            const trimNext = userSettingsActions.keepTrimTopBlank({ enable: true })(state);
            expect(trimNext.temporary.userSettings.trimTopBlank).toBe(true);

        });

        test('does nothing when the modal is closed', () => {
            const state = createState({ modal: { userSettings: false } });

            expect(userSettingsActions.keepTrimTopBlank({ enable: true })(state)).toBeUndefined();
        });
    });

    describe('keepEditorSidePanel', () => {
        test('updates temporary while the modal is open', () => {
            const state = createState();
            const next = userSettingsActions.keepEditorSidePanel({ enable: true })(state);

            expect(next.temporary.userSettings.editorSidePanel).toBe(true);
        });

        test('does nothing when the modal is closed', () => {
            const state = createState({ modal: { userSettings: false } });

            expect(userSettingsActions.keepEditorSidePanel({ enable: true })(state)).toBeUndefined();
        });
    });

    describe('setUserSettingsTab', () => {
        test('switches the active tab', () => {
            const state = createState();
            const next = userSettingsActions.setUserSettingsTab({ tab: 'view' })(state);

            expect(next.temporary.userSettingsTab).toBe('view');
        });

        test('does nothing when the tab is unchanged', () => {
            const state = createState();
            const next = userSettingsActions.setUserSettingsTab({ tab: 'field' })(state);

            expect(next).toBeUndefined();
        });
    });

    describe('commitUserSettings', () => {
        beforeEach(() => {
            const actionNames = [
                'changeGhostVisible', 'changeLoop', 'changeShortcutLabelVisible', 'changeGradient',
                'changePaletteShortcuts', 'changeEditShortcuts', 'changePieceShortcuts',
                'changePieceShortcutDas', 'changeGifFrameDelay', 'changeRotationSystem',
                'setTreeState', 'setListViewTrimTopBlank', 'setEditorSidePanelEnabled', 'reopenCurrentPage',
            ];
            for (const name of actionNames) {
                mockActions[name] = jest.fn(() => () => undefined);
            }
        });

        test('applies temporary view settings through existing actions', () => {
            const state = createState();
            state.temporary.userSettings = {
                ...baseUserSettings,
                grayAfterLineClear: true,
                trimTopBlank: true,
                editorSidePanel: true,
            };

            userSettingsActions.commitUserSettings()(state);

            expect(mockActions.setTreeState).toHaveBeenCalledWith({
                grayAfterLineClear: true,
            });
            expect(mockActions.setListViewTrimTopBlank).toHaveBeenCalledWith({ enabled: true });
            expect(mockActions.setEditorSidePanelEnabled).toHaveBeenCalledWith({ enabled: true });
            expect(saveUserSettingsMock).toHaveBeenCalled();
        });
    });
});

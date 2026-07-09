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
    buttonDropMovesSubtree: false,
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
        buttonDropMovesSubtree: true,
    },
    listView: {
        trimTopBlank: true,
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
        test('copies view settings (gray/trim/subtree) into temporary', () => {
            const state = createState();
            const next = userSettingsActions.copyUserSettingsToTemporary()(state);

            expect(next.temporary.userSettings.grayAfterLineClear).toBe(true);
            expect(next.temporary.userSettings.trimTopBlank).toBe(true);
            expect(next.temporary.userSettings.buttonDropMovesSubtree).toBe(true);
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

    describe('keepTrimTopBlank / keepButtonDropMovesSubtree', () => {
        test('updates temporary while the modal is open', () => {
            const state = createState();

            const trimNext = userSettingsActions.keepTrimTopBlank({ enable: true })(state);
            expect(trimNext.temporary.userSettings.trimTopBlank).toBe(true);

            const subtreeNext = userSettingsActions.keepButtonDropMovesSubtree({ enable: true })(state);
            expect(subtreeNext.temporary.userSettings.buttonDropMovesSubtree).toBe(true);
        });

        test('does nothing when the modal is closed', () => {
            const state = createState({ modal: { userSettings: false } });

            expect(userSettingsActions.keepTrimTopBlank({ enable: true })(state)).toBeUndefined();
            expect(userSettingsActions.keepButtonDropMovesSubtree({ enable: true })(state)).toBeUndefined();
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
                'setTreeState', 'setListViewTrimTopBlank', 'reopenCurrentPage',
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
                buttonDropMovesSubtree: false,
            };

            userSettingsActions.commitUserSettings()(state);

            expect(mockActions.setTreeState).toHaveBeenCalledWith({
                grayAfterLineClear: true,
                buttonDropMovesSubtree: false,
            });
            expect(mockActions.setListViewTrimTopBlank).toHaveBeenCalledWith({ enabled: true });
            expect(saveUserSettingsMock).toHaveBeenCalled();
        });
    });
});

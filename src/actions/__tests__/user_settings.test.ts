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
    deleteSpawnMinoOnPaintDrag: true,
    skipReaderMode: false,
    loop: false,
    shortcutLabelVisible: false,
    gradient: '0000000',
    paletteShortcuts: {},
    editShortcuts: {},
    pieceShortcuts: {},
    pieceShortcutDasFrames: 10,
    pieceShortcutArrFrames: 1,
    pieceShortcutDasCutFrames: 0,
    gifFrameDelayMs: 500,
    rotationSystem: 'srs',
    noGrayAfterHardDrop: false,
    grayAfterLineClear: false,
    trimTopBlank: false,
    editorSidePanel: false,
};

const createState = (override: any = {}) => ({
    mode: {
        ghostVisible: true,
        deleteSpawnMinoOnPaintDrag: true,
        skipReaderMode: false,
        loop: false,
        shortcutLabelVisible: false,
        gradient: {},
        paletteShortcuts: {},
        editShortcuts: {},
        pieceShortcuts: {},
        pieceShortcutDasFrames: 10,
        pieceShortcutArrFrames: 1,
        pieceShortcutDasCutFrames: 0,
        gifFrameDelayMs: 500,
        rotationSystem: 'srs',
        noGrayAfterHardDrop: false,
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

        test('preserves fractional DAS and ARR frame values', () => {
            const state = createState();
            state.mode.pieceShortcutDasFrames = 5.5;
            state.mode.pieceShortcutArrFrames = 1.5;

            const next = userSettingsActions.copyUserSettingsToTemporary()(state);

            expect(next.temporary.userSettings.pieceShortcutDasFrames).toBe(5.5);
            expect(next.temporary.userSettings.pieceShortcutArrFrames).toBe(1.5);
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

    describe('keepNoGrayAfterHardDrop', () => {
        test('updates temporary when line-clear graying is enabled', () => {
            const state = createState();
            state.temporary.userSettings.grayAfterLineClear = true;
            const next = userSettingsActions.keepNoGrayAfterHardDrop({ enable: true })(state);

            expect(next.temporary.userSettings.noGrayAfterHardDrop).toBe(true);
        });

        test('does nothing when line-clear graying is disabled', () => {
            const state = createState({ tree: { grayAfterLineClear: false } });

            expect(userSettingsActions.keepNoGrayAfterHardDrop({ enable: true })(state)).toBeUndefined();
        });
    });

    describe('keepDeleteSpawnMinoOnPaintDrag', () => {
        test('updates temporary while the modal is open', () => {
            const state = createState();
            const next = userSettingsActions.keepDeleteSpawnMinoOnPaintDrag({ enable: false })(state);

            expect(next.temporary.userSettings.deleteSpawnMinoOnPaintDrag).toBe(false);
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

    describe('keepPieceShortcutArr', () => {
        test('updates temporary while the modal is open', () => {
            const state = createState();
            const next = userSettingsActions.keepPieceShortcutArr({ arrFrames: 2 })(state);

            expect(next.temporary.userSettings.pieceShortcutArrFrames).toBe(2);
        });

        test('does nothing when the modal is closed', () => {
            const state = createState({ modal: { userSettings: false } });

            expect(userSettingsActions.keepPieceShortcutArr({ arrFrames: 2 })(state)).toBeUndefined();
        });
    });

    describe('shared Space shortcut', () => {
        test('keeps page insertion when assigning Space to hard drop', () => {
            const state = createState();
            state.temporary.userSettings.editShortcuts = { InsertPage: 'Space' };
            state.temporary.userSettings.pieceShortcuts = { HardDrop: '' };

            const next = userSettingsActions.keepPieceShortcut({ shortcut: 'HardDrop', code: 'Space' })(state);

            expect(next.temporary.userSettings.editShortcuts.InsertPage).toBe('Space');
            expect(next.temporary.userSettings.pieceShortcuts.HardDrop).toBe('Space');
        });

        test('keeps hard drop when assigning Space to page insertion', () => {
            const state = createState();
            state.temporary.userSettings.editShortcuts = { InsertPage: '' };
            state.temporary.userSettings.pieceShortcuts = { HardDrop: 'Space' };

            const next = userSettingsActions.keepEditShortcut({ shortcut: 'InsertPage', code: 'Space' })(state);

            expect(next.temporary.userSettings.editShortcuts.InsertPage).toBe('Space');
            expect(next.temporary.userSettings.pieceShortcuts.HardDrop).toBe('Space');
        });
    });

    test('keeps palette and edit assignments when assigning a piece shortcut', () => {
        const state = createState();
        state.temporary.userSettings.paletteShortcuts = { Comp: 'KeyC' };
        state.temporary.userSettings.editShortcuts = { Add: 'KeyN' };
        state.temporary.userSettings.pieceShortcuts = { Hold: '' };

        const next = userSettingsActions.keepPieceShortcut({ shortcut: 'Hold', code: 'KeyC' })(state);

        expect(next.temporary.userSettings.paletteShortcuts).toEqual({ Comp: 'KeyC' });
        expect(next.temporary.userSettings.editShortcuts).toEqual({ Add: 'KeyN' });
        expect(next.temporary.userSettings.pieceShortcuts.Hold).toBe('KeyC');
    });

    describe('setUserSettingsTab', () => {
        test('switches the active tab', () => {
            const state = createState();
            const next = userSettingsActions.setUserSettingsTab({ tab: 'view' })(state);

            expect(next.temporary.userSettingsTab).toBe('view');
        });

        test('switches to the piece tab', () => {
            const state = createState();
            const next = userSettingsActions.setUserSettingsTab({ tab: 'piece' })(state);

            expect(next.temporary.userSettingsTab).toBe('piece');
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
                'changeDeleteSpawnMinoOnPaintDrag',
                'changeSkipReaderMode',
                'changePaletteShortcuts', 'changeEditShortcuts', 'changePieceShortcuts',
                'changePieceShortcutDas', 'changePieceShortcutArr', 'changePieceShortcutDasCut',
                'changePieceShortcutSdf',
                'changeGifFrameDelay', 'changeRotationSystem',
                'changeNoGrayAfterHardDrop',
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
                pieceShortcutDasFrames: 5.5,
                pieceShortcutArrFrames: 1.5,
                pieceShortcutDasCutFrames: 2.5,
                grayAfterLineClear: true,
                trimTopBlank: true,
                editorSidePanel: true,
            };

            userSettingsActions.commitUserSettings()(state);

            expect(mockActions.changePieceShortcutDas).toHaveBeenCalledWith({ dasFrames: 5.5 });
            expect(mockActions.changePieceShortcutArr).toHaveBeenCalledWith({ arrFrames: 1.5 });
            expect(mockActions.changePieceShortcutDasCut).toHaveBeenCalledWith({ dasCutFrames: 2.5 });
            expect(mockActions.setTreeState).toHaveBeenCalledWith({
                grayAfterLineClear: true,
            });
            expect(mockActions.setListViewTrimTopBlank).toHaveBeenCalledWith({ enabled: true });
            expect(mockActions.setEditorSidePanelEnabled).toHaveBeenCalledWith({ enabled: true });
            expect(saveUserSettingsMock).toHaveBeenCalled();
        });
    });
});

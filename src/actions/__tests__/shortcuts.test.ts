/** @jest-environment jsdom */

import type { Actions } from '../../actions';
import { Screens } from '../../lib/enums';
import type { State } from '../../states';
import { allowedEditShortcuts, initShortcutHandlers } from '../shortcuts';

describe('allowedEditShortcuts', () => {
    test('allows undo and redo on list view for list and tree modes', () => {
        expect(allowedEditShortcuts[Screens.ListView]).toContain('Undo');
        expect(allowedEditShortcuts[Screens.ListView]).toContain('Redo');
    });
});

describe('clipboard insert shortcut', () => {
    let state: State;
    let actions: Actions;
    let importPagesFromClipboard: jest.Mock;
    let insertPageFromClipboard: jest.Mock;
    let replaceAllFromClipboard: jest.Mock;
    let duplicatePageOnly: jest.Mock;
    let harddrop: jest.Mock;
    let hold: jest.Mock;
    let moveToRight: jest.Mock;
    let selectEditorPalette: jest.Mock;

    beforeAll(() => {
        initShortcutHandlers(() => state, () => actions);
    });

    beforeEach(() => {
        jest.useFakeTimers();
        importPagesFromClipboard = jest.fn();
        insertPageFromClipboard = jest.fn();
        replaceAllFromClipboard = jest.fn();
        duplicatePageOnly = jest.fn();
        harddrop = jest.fn();
        hold = jest.fn();
        moveToRight = jest.fn();
        selectEditorPalette = jest.fn();
        state = {
            modal: {
                append: false,
                clipboard: false,
                coldClearMenu: false,
                fumen: false,
                listViewMenu: false,
                listViewReplace: false,
                menu: false,
                treeDisableConfirm: false,
                userSettings: false,
            },
            mode: {
                editShortcuts: {
                    Add: 'KeyN',
                    Copy: 'Mod+KeyC',
                    Cut: 'Mod+KeyX',
                    EditHome: 'KeyH',
                    Insert: 'Mod+KeyV',
                    InsertPage: 'Space',
                    ListView: 'Tab',
                    Menu: 'KeyM',
                    NextPage: 'Digit2',
                    PrevPage: 'Digit1',
                    Redo: 'Mod+KeyY',
                    TreeView: 'KeyT',
                    Undo: 'Mod+KeyZ',
                },
                loop: false,
                pieceShortcutDasFrames: 10,
                pieceShortcutArrFrames: 1,
                paletteShortcuts: {
                    Comp: 'KeyC',
                },
                pieceShortcuts: {
                    HardDrop: 'Space',
                    Hold: 'KeyC',
                    MoveRight: 'KeyN',
                },
                screen: Screens.Editor,
            },
            editorUi: {
                inspector: 'none',
                primaryTool: 'paint',
            },
            fumen: {
                currentIndex: 0,
                pages: [{ piece: {} }],
            },
        } as State;
        actions = {
            duplicatePageOnly,
            harddrop,
            hold,
            importPagesFromClipboard,
            insertPageFromClipboard,
            moveToRight,
            replaceAllFromClipboard,
            selectEditorPalette,
        } as unknown as Actions;
    });

    afterEach(() => {
        window.dispatchEvent(new Event('blur'));
        jest.useRealTimers();
    });

    const dispatchPasteShortcut = (type: 'keydown' | 'keyup') => {
        window.dispatchEvent(new KeyboardEvent(type, {
            bubbles: true,
            code: 'KeyV',
            ctrlKey: true,
            key: 'v',
        }));
    };

    const dispatchSpaceShortcut = (type: 'keydown' | 'keyup') => {
        window.dispatchEvent(new KeyboardEvent(type, {
            bubbles: true,
            code: 'Space',
            key: ' ',
        }));
    };

    test('short press uses the same add import as the modal', () => {
        dispatchPasteShortcut('keydown');
        dispatchPasteShortcut('keyup');

        expect(importPagesFromClipboard).toHaveBeenCalledWith({ mode: 'add' });
        expect(insertPageFromClipboard).not.toHaveBeenCalled();
        expect(replaceAllFromClipboard).not.toHaveBeenCalled();
    });

    test('long press uses the same replace import as the modal', () => {
        dispatchPasteShortcut('keydown');
        jest.advanceTimersByTime(500);
        dispatchPasteShortcut('keyup');

        expect(importPagesFromClipboard).toHaveBeenCalledWith({ mode: 'import' });
        expect(insertPageFromClipboard).not.toHaveBeenCalled();
        expect(replaceAllFromClipboard).not.toHaveBeenCalled();
    });

    test('Space hard-drops while PIECE mode is active', () => {
        state.editorUi.primaryTool = 'piece';

        dispatchSpaceShortcut('keydown');
        dispatchSpaceShortcut('keyup');

        expect(harddrop).toHaveBeenCalledTimes(1);
        expect(duplicatePageOnly).not.toHaveBeenCalled();
    });

    test('Space inserts a page while PIECE mode is inactive', () => {
        dispatchSpaceShortcut('keydown');
        dispatchSpaceShortcut('keyup');

        expect(harddrop).not.toHaveBeenCalled();
        expect(duplicatePageOnly).toHaveBeenCalledWith({ index: 1 });
    });

    test('Space remains reserved when PIECE mode has no active piece', () => {
        state.editorUi.primaryTool = 'piece';
        state.fumen.pages = [{ ...state.fumen.pages[0], piece: undefined }];

        dispatchSpaceShortcut('keydown');
        dispatchSpaceShortcut('keyup');

        expect(harddrop).not.toHaveBeenCalled();
        expect(duplicatePageOnly).not.toHaveBeenCalled();
    });

    test('piece shortcut wins over an edit shortcut in PIECE mode', () => {
        state.editorUi.primaryTool = 'piece';

        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyN', key: 'n' }));
        window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyN', key: 'n' }));

        expect(moveToRight).toHaveBeenCalledTimes(1);
        expect(duplicatePageOnly).not.toHaveBeenCalled();
    });

    test('piece shortcut is inactive outside PIECE mode', () => {
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyC', key: 'c' }));
        window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyC', key: 'c' }));

        expect(hold).not.toHaveBeenCalled();
        expect(selectEditorPalette).toHaveBeenCalledWith({ selection: 'comp' });
    });

    test('Hold uses the default C shortcut in PIECE mode', () => {
        state.editorUi.primaryTool = 'piece';

        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyC', key: 'c' }));
        window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyC', key: 'c' }));

        expect(hold).toHaveBeenCalledTimes(1);
        expect(selectEditorPalette).not.toHaveBeenCalled();
    });
});

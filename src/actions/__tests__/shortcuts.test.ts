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
    let softdrop: jest.Mock;
    let softdropStep: jest.Mock;
    let moveToLeft: jest.Mock;
    let moveToRight: jest.Mock;
    let rotateToRight: jest.Mock;
    let selectEditorPalette: jest.Mock;
    let backPage: jest.Mock;
    let nextPage: jest.Mock;
    let undo: jest.Mock;

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
        softdrop = jest.fn();
        softdropStep = jest.fn();
        moveToLeft = jest.fn();
        moveToRight = jest.fn();
        rotateToRight = jest.fn();
        selectEditorPalette = jest.fn();
        backPage = jest.fn();
        nextPage = jest.fn();
        undo = jest.fn();
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
                pieceShortcutDasCutFrames: 0,
                pieceShortcutSdf: 5,
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
            backPage,
            duplicatePageOnly,
            harddrop,
            hold,
            softdrop,
            softdropStep,
            moveToLeft,
            importPagesFromClipboard,
            insertPageFromClipboard,
            moveToRight,
            rotateToRight,
            nextPage,
            replaceAllFromClipboard,
            selectEditorPalette,
            undo,
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

    const dispatchPageShortcut = (code: 'Digit1' | 'Digit2') => {
        window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
        window.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true }));
    };

    test('editor page shortcuts pass loop false when disabled', () => {
        dispatchPageShortcut('Digit1');
        dispatchPageShortcut('Digit2');

        expect(backPage).toHaveBeenCalledWith({ loop: false });
        expect(nextPage).toHaveBeenCalledWith({ loop: false });
    });

    test('editor page shortcuts pass loop true when enabled', () => {
        state.mode.loop = true;

        dispatchPageShortcut('Digit1');
        dispatchPageShortcut('Digit2');

        expect(backPage).toHaveBeenCalledWith({ loop: true });
        expect(nextPage).toHaveBeenCalledWith({ loop: true });
    });

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

    test('piece movement and rotation shortcuts can be pressed simultaneously', () => {
        state.editorUi.primaryTool = 'piece';
        state.mode.pieceShortcuts = {
            MoveLeft: 'ArrowLeft',
            MoveRight: 'ArrowRight',
            RotateRight: 'KeyX',
        } as State['mode']['pieceShortcuts'];

        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowLeft', bubbles: true }));
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyX', bubbles: true }));

        expect(moveToLeft).toHaveBeenCalledTimes(1);
        expect(rotateToRight).toHaveBeenCalledTimes(1);

        window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyX', bubbles: true }));
        window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowLeft', bubbles: true }));
    });

    test('piece soft drop follows SDF while the key is held', () => {
        state.editorUi.primaryTool = 'piece';
        state.mode.pieceShortcutSdf = 5;
        state.mode.pieceShortcuts = {
            SoftDrop: 'ArrowDown',
        } as State['mode']['pieceShortcuts'];

        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowDown', bubbles: true }));

        expect(softdropStep).toHaveBeenCalledTimes(1);
        expect(softdrop).not.toHaveBeenCalled();

        jest.advanceTimersByTime(100);
        expect(softdropStep.mock.calls.length).toBeGreaterThan(1);

        window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowDown', bubbles: true }));
        const callsAfterRelease = softdropStep.mock.calls.length;
        jest.advanceTimersByTime(1000);
        expect(softdropStep).toHaveBeenCalledTimes(callsAfterRelease);
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

    test('PIECE shortcuts stay disabled while the piece queue modal is open', () => {
        state.editorUi.primaryTool = 'piece';
        (state.modal as State['modal']).pieceQueue = true;

        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ' }));
        window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', key: ' ' }));

        expect(harddrop).not.toHaveBeenCalled();
    });

    test('edit shortcuts stay disabled while the tree-disable confirm modal is open', () => {
        (state.modal as State['modal']).treeDisableConfirm = true;

        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyZ', ctrlKey: true, bubbles: true }));
        window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyZ', ctrlKey: true, bubbles: true }));

        expect(undo).not.toHaveBeenCalled();
    });
});

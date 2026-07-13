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

    beforeAll(() => {
        initShortcutHandlers(() => state, () => actions);
    });

    beforeEach(() => {
        jest.useFakeTimers();
        importPagesFromClipboard = jest.fn();
        insertPageFromClipboard = jest.fn();
        replaceAllFromClipboard = jest.fn();
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
                screen: Screens.Editor,
            },
        } as State;
        actions = {
            importPagesFromClipboard,
            insertPageFromClipboard,
            replaceAllFromClipboard,
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
});

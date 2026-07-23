/**
 * @jest-environment jsdom
 */

jest.mock('../../actions', () => ({ actions: {}, main: {} }));
jest.mock('../cold_clear', () => ({
    coldClearActions: {
        // openColdClearMenuModal / openPieceQueueModal call this first in their sequence. No-op it.
        seedQueuePreviewFromSpawnedPiece: () => () => undefined,
    },
}));
jest.mock('../view_settings', () => ({
    persistViewSettings: jest.fn(),
}));

import { modalActions } from '../modal';
import { State } from '../../states';

const baseModal = {
    fumen: false, menu: false, append: false, clipboard: false, userSettings: false,
    listViewReplace: false, listViewMenu: false, treeDisableConfirm: false,
    coldClearMenu: false, pieceQueue: false,
};

const createState = (overrides: {
    modal?: Partial<typeof baseModal>;
    coldClearRunning?: boolean;
    listViewMenuTab?: 'export' | 'import';
} = {}): State => ({
    modal: { ...baseModal, ...(overrides.modal ?? {}) },
    temporary: { userSettingsTab: 'field', pieceQueueFocus: 'next' },
    listView: { menuTab: overrides.listViewMenuTab ?? 'export' },
    coldClear: { isRunning: overrides.coldClearRunning ?? false },
} as unknown as State);

describe('modalActions characterization tests', () => {
    describe('simple open actions', () => {
        const cases: [string, keyof State['modal']][] = [
            ['openFumenModal', 'fumen'],
            ['openMenuModal', 'menu'],
            ['openAppendModal', 'append'],
            ['openClipboardModal', 'clipboard'],
            ['openListViewReplaceModal', 'listViewReplace'],
            ['openListViewMenuModal', 'listViewMenu'],
            ['openTreeDisableConfirmModal', 'treeDisableConfirm'],
        ];

        test.each(cases)('%s sets only its own modal flag to true', (actionName, flag) => {
            const state = createState();
            const action = (modalActions as any)[actionName]();
            const result = action(state);

            expect(result.modal).toEqual({ ...baseModal, [flag]: true });
        });
    });

    describe('openUserSettingsModal', () => {
        test('no argument defaults userSettingsTab to field', () => {
            const state = createState();
            const result = (modalActions.openUserSettingsModal as any)()(state);

            expect(result.modal).toEqual({ ...baseModal, userSettings: true });
            expect(result.temporary.userSettingsTab).toBe('field');
        });

        test('initialTab argument sets userSettingsTab', () => {
            const state = createState();
            const result = (modalActions.openUserSettingsModal as any)({ initialTab: 'piece' })(state);

            expect(result.modal).toEqual({ ...baseModal, userSettings: true });
            expect(result.temporary.userSettingsTab).toBe('piece');
        });
    });

    describe('openListViewMenuModal', () => {
        test('initialTab selects the requested tab before opening', () => {
            const state = createState({ listViewMenuTab: 'export' });
            const result = modalActions.openListViewMenuModal({ initialTab: 'import' })(state) as any;

            expect(result.modal).toEqual({ ...baseModal, listViewMenu: true });
            expect(result.listView.menuTab).toBe('import');
        });

        test('without initialTab preserves the current tab', () => {
            const state = createState({ listViewMenuTab: 'import' });
            const result = modalActions.openListViewMenuModal()(state) as any;

            expect(result.modal).toEqual({ ...baseModal, listViewMenu: true });
            expect(result.listView).toBeUndefined();
        });
    });

    describe('openPieceQueueModal', () => {
        test('no argument defaults pieceQueueFocus to next', () => {
            const state = createState();
            const result = (modalActions.openPieceQueueModal as any)()(state);

            expect(result.modal.pieceQueue).toBe(true);
            expect(result.temporary.pieceQueueFocus).toBe('next');
        });

        test('focus argument sets pieceQueueFocus', () => {
            const state = createState();
            const result = (modalActions.openPieceQueueModal as any)({ focus: 'hold' })(state);

            expect(result.modal.pieceQueue).toBe(true);
            expect(result.temporary.pieceQueueFocus).toBe('hold');
        });
    });

    test('openColdClearMenuModal sets coldClearMenu true', () => {
        const state = createState();
        const result = (modalActions.openColdClearMenuModal as any)()(state);

        expect(result.modal.coldClearMenu).toBe(true);
    });

    describe('simple close actions', () => {
        const cases: [string, keyof State['modal']][] = [
            ['closeFumenModal', 'fumen'],
            ['closeMenuModal', 'menu'],
            ['closeAppendModal', 'append'],
            ['closeClipboardModal', 'clipboard'],
            ['closeUserSettingsModal', 'userSettings'],
            ['closeListViewReplaceModal', 'listViewReplace'],
            ['closeListViewMenuModal', 'listViewMenu'],
            ['closeTreeDisableConfirmModal', 'treeDisableConfirm'],
            ['closePieceQueueModal', 'pieceQueue'],
        ];

        test.each(cases)('%s sets only its own modal flag to false', (actionName, flag) => {
            const state = createState({ modal: { [flag]: true } });
            const action = (modalActions as any)[actionName]();
            const result = action(state);

            expect(result.modal).toEqual({ ...baseModal, [flag]: false });
        });
    });

    describe('closeColdClearMenuModal', () => {
        test('closes coldClearMenu when Cold Clear is not running', () => {
            const state = createState({ modal: { coldClearMenu: true }, coldClearRunning: false });
            const result = (modalActions.closeColdClearMenuModal as any)()(state);

            expect(result.modal.coldClearMenu).toBe(false);
        });

        test('returns undefined (no-op) when Cold Clear is running', () => {
            const state = createState({ modal: { coldClearMenu: true }, coldClearRunning: true });
            const result = (modalActions.closeColdClearMenuModal as any)()(state);

            expect(result).toBeUndefined();
        });
    });

    describe('closeAllModals', () => {
        test('sets all flags false when Cold Clear is not running', () => {
            const state = createState({
                modal: {
                    fumen: true, menu: true, append: true, clipboard: true, userSettings: true,
                    listViewReplace: true, listViewMenu: true, treeDisableConfirm: true,
                    coldClearMenu: true, pieceQueue: true,
                },
                coldClearRunning: false,
            });
            const result = (modalActions.closeAllModals as any)()(state);

            expect(result.modal).toEqual(baseModal);
        });

        test('keeps coldClearMenu true when Cold Clear is running', () => {
            const state = createState({
                modal: {
                    fumen: true, menu: true, append: true, clipboard: true, userSettings: true,
                    listViewReplace: true, listViewMenu: true, treeDisableConfirm: true,
                    coldClearMenu: true, pieceQueue: true,
                },
                coldClearRunning: true,
            });
            const result = (modalActions.closeAllModals as any)()(state);

            expect(result.modal).toEqual({ ...baseModal, coldClearMenu: true });
        });
    });
});

/**
 * @jest-environment jsdom
 */

const mockActions: { [name: string]: any } = {};
jest.mock('../../actions', () => ({ actions: mockActions, main: {} }));
jest.mock('../cold_clear', () => ({
    coldClearActions: {
        seedQueuePreviewFromSpawnedPiece: () => () => undefined,
    },
}));
jest.mock('../view_settings', () => ({
    persistViewSettings: jest.fn(),
}));
jest.mock('../../states', () => ({ resources: {} }));

import { pageActions } from '../pages';
import { modalActions } from '../modal';
import { modeActions } from '../screen';
import { Screens } from '../../lib/enums';
import { State } from '../../states';

const baseModal = {
    fumen: false, menu: false, append: false, clipboard: false, userSettings: false,
    listViewReplace: false, listViewMenu: false, treeDisableConfirm: false,
    coldClearMenu: false, inputWindow: false,
};

const createState = ({ open = false, maxPage = 3, screen = Screens.Editor } = {}): State => ({
    pageStrip: { open },
    fumen: { maxPage, currentIndex: 0 },
    modal: { ...baseModal },
    mode: { screen },
    temporary: { userSettingsTab: 'edit' },
    listView: { menuTab: 'export' },
    coldClear: { isRunning: false },
} as unknown as State);

const apply = (state: State, next: Partial<State> | undefined): State => ({ ...state, ...(next ?? {}) } as State);

describe('page strip actions', () => {
    beforeEach(() => {
        mockActions.closePageStrip = pageActions.closePageStrip;
        mockActions.cancelSpawnMinoPick = () => () => undefined;
    });

    test('togglePageStrip opens and closes when there are two or more pages', () => {
        const opened = apply(createState(), pageActions.togglePageStrip()(createState()));
        expect(opened.pageStrip.open).toBe(true);

        const closed = apply(opened, pageActions.togglePageStrip()(opened));
        expect(closed.pageStrip.open).toBe(false);
    });

    test('togglePageStrip does not open a single-page fumen', () => {
        expect(pageActions.togglePageStrip()(createState({ maxPage: 1 }))).toBeUndefined();
    });

    test('togglePageStrip still closes a strip left open on a single page', () => {
        const state = createState({ open: true, maxPage: 1 });
        expect(apply(state, pageActions.togglePageStrip()(state)).pageStrip.open).toBe(false);
    });

    test('closePageStrip is a no-op when the strip is already closed', () => {
        expect(pageActions.closePageStrip()(createState())).toBeUndefined();
    });

    test.each([
        ['openMenuModal', () => modalActions.openMenuModal()],
        ['openFumenModal', () => modalActions.openFumenModal()],
        ['openUserSettingsModal', () => modalActions.openUserSettingsModal({ initialTab: 'general' })],
        ['openListViewMenuModal', () => modalActions.openListViewMenuModal({ initialTab: 'import' })],
    ])('%s closes the strip', (_, open) => {
        const state = createState({ open: true });
        const next = apply(state, open()(state));
        expect(next.pageStrip.open).toBe(false);
    });

    test('closeAllModals closes the strip so it does not reappear afterwards', () => {
        const state = createState({ open: true });
        expect(apply(state, modalActions.closeAllModals()(state)).pageStrip.open).toBe(false);
    });

    test('closing a modal leaves the strip state alone', () => {
        const state = createState();
        expect(modalActions.closeMenuModal()(state)).not.toHaveProperty('pageStrip');
    });

    test('changing the screen closes the strip', () => {
        const state = createState({ open: true });
        const next = apply(state, modeActions.changeScreen({ screen: Screens.Reader })(state));
        expect(next.pageStrip.open).toBe(false);
        expect(next.mode.screen).toBe(Screens.Reader);
    });
});

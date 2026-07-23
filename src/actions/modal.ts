import { NextState, sequence } from './commons';
import { action } from '../actions';
import { PieceQueueFocus, State, UserSettingsTab } from '../states';
import { coldClearActions } from './cold_clear';
import { persistViewSettings } from './view_settings';

export interface ModalActions {
    showOpenErrorMessage: (data: { message: string }) => action;
    openFumenModal: () => action;
    openMenuModal: () => action;
    openAppendModal: () => action;
    openClipboardModal: () => action;
    openUserSettingsModal: (data?: { initialTab?: UserSettingsTab }) => action;
    openListViewReplaceModal: () => action;
    openListViewMenuModal: (data?: { initialTab?: 'export' | 'import' }) => action;
    openTreeDisableConfirmModal: () => action;
    openColdClearMenuModal: () => action;
    openPieceQueueModal: (data?: { focus?: PieceQueueFocus }) => action;
    closeFumenModal: () => action;
    closeMenuModal: () => action;
    closeAppendModal: () => action;
    closeClipboardModal: () => action;
    closeUserSettingsModal: () => action;
    closeListViewReplaceModal: () => action;
    closeListViewMenuModal: () => action;
    closeTreeDisableConfirmModal: () => action;
    closeColdClearMenuModal: () => action;
    closePieceQueueModal: () => action;
    closeAllModals: () => action;
}

type ModalName = keyof State['modal'];

const setModal = (name: ModalName, open: boolean) =>
    (state: Readonly<State>): NextState => ({
        modal: {
            ...state.modal,
            [name]: open,
        },
    });

export const modalActions: Readonly<ModalActions> = {
    showOpenErrorMessage: ({ message }) => (state): NextState => {
        return sequence(state, [
            () => ({
                fumen: {
                    ...state.fumen,
                    errorMessage: message,
                },
            }),
        ]);
    },
    openFumenModal: () => setModal('fumen', true),
    openMenuModal: () => setModal('menu', true),
    openAppendModal: () => setModal('append', true),
    openClipboardModal: () => setModal('clipboard', true),
    openUserSettingsModal: (data = {}) => (state): NextState => {
        return {
            modal: {
                ...state.modal,
                userSettings: true,
            },
            temporary: {
                ...state.temporary,
                userSettingsTab: data.initialTab ?? 'field',
            },
        };
    },
    closeFumenModal: () => setModal('fumen', false),
    closeMenuModal: () => setModal('menu', false),
    closeAppendModal: () => setModal('append', false),
    closeClipboardModal: () => setModal('clipboard', false),
    closeUserSettingsModal: () => setModal('userSettings', false),
    openListViewReplaceModal: () => setModal('listViewReplace', true),
    closeListViewReplaceModal: () => setModal('listViewReplace', false),
    openListViewMenuModal: (data = {}) => (state): NextState => {
        if (data.initialTab === undefined || state.listView.menuTab === data.initialTab) {
            return setModal('listViewMenu', true)(state);
        }

        persistViewSettings(state, { listViewMenuTab: data.initialTab });
        return {
            modal: {
                ...state.modal,
                listViewMenu: true,
            },
            listView: {
                ...state.listView,
                menuTab: data.initialTab,
            },
        };
    },
    openTreeDisableConfirmModal: () => setModal('treeDisableConfirm', true),
    openColdClearMenuModal: () => (state): NextState => {
        return sequence(state, [
            // スポーンミノがあればカレント枠に反映してから開く
            coldClearActions.seedQueuePreviewFromSpawnedPiece(),
            nextState => ({
                modal: {
                    ...nextState.modal,
                    coldClearMenu: true,
                },
            }),
        ]);
    },
    openPieceQueueModal: (data = {}) => (state): NextState => {
        return sequence(state, [
            // スポーンミノがあればカレント枠に反映してから開く
            coldClearActions.seedQueuePreviewFromSpawnedPiece(),
            nextState => ({
                modal: {
                    ...nextState.modal,
                    pieceQueue: true,
                },
                temporary: {
                    ...nextState.temporary,
                    pieceQueueFocus: data.focus ?? 'next',
                },
            }),
        ]);
    },
    closeListViewMenuModal: () => setModal('listViewMenu', false),
    closeTreeDisableConfirmModal: () => setModal('treeDisableConfirm', false),
    closeColdClearMenuModal: () => (state): NextState => {
        if (state.coldClear.isRunning) {
            return undefined;
        }
        return {
            modal: {
                ...state.modal,
                coldClearMenu: false,
            },
        };
    },
    closePieceQueueModal: () => setModal('pieceQueue', false),
    closeAllModals: () => (state): NextState => {
        return {
            modal: {
                append: false,
                fumen: false,
                menu: false,
                clipboard: false,
                userSettings: false,
                listViewReplace: false,
                listViewMenu: false,
                treeDisableConfirm: false,
                coldClearMenu: state.coldClear.isRunning ? true : false,
                pieceQueue: false,
            },
        };
    },
};

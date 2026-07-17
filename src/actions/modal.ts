import { NextState, sequence } from './commons';
import { action } from '../actions';
import { PieceQueueFocus, UserSettingsTab } from '../states';
import { coldClearActions } from './cold_clear';

export interface ModalActions {
    showOpenErrorMessage: (data: { message: string }) => action;
    openFumenModal: () => action;
    openMenuModal: () => action;
    openAppendModal: () => action;
    openClipboardModal: () => action;
    openUserSettingsModal: (data?: { initialTab?: UserSettingsTab }) => action;
    openListViewReplaceModal: () => action;
    openListViewMenuModal: () => action;
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
    openFumenModal: () => (state): NextState => {
        return {
            modal: {
                ...state.modal,
                fumen: true,
            },
        };
    },
    openMenuModal: () => (state): NextState => {
        return {
            modal: {
                ...state.modal,
                menu: true,
            },
        };
    },
    openAppendModal: () => (state): NextState => {
        return {
            modal: {
                ...state.modal,
                append: true,
            },
        };
    },
    openClipboardModal: () => (state): NextState => {
        return {
            modal: {
                ...state.modal,
                clipboard: true,
            },
        };
    },
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
    closeFumenModal: () => (state): NextState => {
        return {
            modal: {
                ...state.modal,
                fumen: false,
            },
        };
    },
    closeMenuModal: () => (state): NextState => {
        return {
            modal: {
                ...state.modal,
                menu: false,
            },
        };
    },
    closeAppendModal: () => (state): NextState => {
        return {
            modal: {
                ...state.modal,
                append: false,
            },
        };
    },
    closeClipboardModal: () => (state): NextState => {
        return {
            modal: {
                ...state.modal,
                clipboard: false,
            },
        };
    },
    closeUserSettingsModal: () => (state): NextState => {
        return {
            modal: {
                ...state.modal,
                userSettings: false,
            },
        };
    },
    openListViewReplaceModal: () => (state): NextState => {
        return {
            modal: {
                ...state.modal,
                listViewReplace: true,
            },
        };
    },
    closeListViewReplaceModal: () => (state): NextState => {
        return {
            modal: {
                ...state.modal,
                listViewReplace: false,
            },
        };
    },
    openListViewMenuModal: () => (state): NextState => {
        return {
            modal: {
                ...state.modal,
                listViewMenu: true,
            },
        };
    },
    openTreeDisableConfirmModal: () => (state): NextState => {
        return {
            modal: {
                ...state.modal,
                treeDisableConfirm: true,
            },
        };
    },
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
    closeListViewMenuModal: () => (state): NextState => {
        return {
            modal: {
                ...state.modal,
                listViewMenu: false,
            },
        };
    },
    closeTreeDisableConfirmModal: () => (state): NextState => {
        return {
            modal: {
                ...state.modal,
                treeDisableConfirm: false,
            },
        };
    },
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
    closePieceQueueModal: () => (state): NextState => {
        return {
            modal: {
                ...state.modal,
                pieceQueue: false,
            },
        };
    },
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

import { Component } from '../../lib/types';
import { h } from 'hyperapp';
import { resources } from '../../states';
import { i18n } from '../../locales/keys';

declare const M: any;

interface ReplayDiscardConfirmModalProps {
    actions: {
        closeReplayDiscardConfirmModal: () => void;
        confirmReplayOpenInEditor: () => void;
    };
}

export const ReplayDiscardConfirmModal: Component<ReplayDiscardConfirmModalProps> = ({ actions }) => {
    const close = () => {
        const modal = resources.modals.replayDiscardConfirm;
        if (modal !== undefined) {
            modal.close();
        }
    };

    const destroy = () => {
        resources.modals.replayDiscardConfirm = undefined;
    };

    const cancel = () => {
        actions.closeReplayDiscardConfirmModal();
        close();
        destroy();
    };

    const confirm = () => {
        actions.closeReplayDiscardConfirmModal();
        actions.confirmReplayOpenInEditor();
        close();
        destroy();
    };

    const oncreate = (element: HTMLDivElement) => {
        const instance = M.Modal.init(element, {
            onCloseStart: () => {
                actions.closeReplayDiscardConfirmModal();
                destroy();
            },
        });

        instance.open();
        resources.modals.replayDiscardConfirm = instance;
    };

    return (
        <div key="replay-discard-confirm-modal-top">
            <div key="mdl-replay-discard-confirm" datatest="replay-discard-confirm"
                 className="modal" oncreate={oncreate}>
                <div key="modal-content" className="modal-content">
                    <h4>{i18n.Replay.DiscardConfirm.Title()}</h4>
                    <p>{i18n.Replay.DiscardConfirm.Message()}</p>
                </div>

                <div key="modal-footer" className="modal-footer">
                    <a href="#" key="btn-cancel" datatest="btn-replay-discard-cancel"
                       className="waves-effect waves-teal btn-flat" onclick={cancel}>
                        {i18n.Replay.DiscardConfirm.Cancel()}
                    </a>
                    <a href="#" key="btn-confirm" datatest="btn-replay-discard-ok"
                       className="waves-effect waves-light btn red" onclick={confirm}>
                        {i18n.Replay.DiscardConfirm.Confirm()}
                    </a>
                </div>
            </div>
        </div>
    );
};

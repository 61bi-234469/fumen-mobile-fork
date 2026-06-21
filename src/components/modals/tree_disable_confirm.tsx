import { Component } from '../../lib/types';
import { h } from 'hyperapp';
import { resources } from '../../states';
import { i18n } from '../../locales/keys';

declare const M: any;

interface TreeDisableConfirmModalProps {
    actions: {
        closeTreeDisableConfirmModal: () => void;
        toggleTreeMode: () => void;
    };
}

export const TreeDisableConfirmModal: Component<TreeDisableConfirmModalProps> = ({ actions }) => {
    const close = () => {
        const modal = resources.modals.treeDisableConfirm;
        if (modal !== undefined) {
            modal.close();
        }
    };

    const destroy = () => {
        resources.modals.treeDisableConfirm = undefined;
    };

    const cancel = () => {
        actions.closeTreeDisableConfirmModal();
        close();
        destroy();
    };

    const confirm = () => {
        actions.closeTreeDisableConfirmModal();
        actions.toggleTreeMode();
        close();
        destroy();
    };

    const oncreate = (element: HTMLDivElement) => {
        const instance = M.Modal.init(element, {
            onCloseStart: () => {
                actions.closeTreeDisableConfirmModal();
                destroy();
            },
        });

        instance.open();
        resources.modals.treeDisableConfirm = instance;
    };

    return (
        <div key="tree-disable-confirm-modal-top">
            <div key="mdl-tree-disable-confirm" datatest="mdl-tree-disable-confirm"
                 className="modal" oncreate={oncreate}>
                <div key="modal-content" className="modal-content">
                    <h4>{i18n.TreeView.DisableConfirm.Title()}</h4>
                    <p>{i18n.TreeView.DisableConfirm.Message()}</p>
                </div>

                <div key="modal-footer" className="modal-footer">
                    <a href="#" key="btn-cancel" datatest="btn-tree-disable-cancel"
                       className="waves-effect waves-teal btn-flat" onclick={cancel}>
                        {i18n.TreeView.DisableConfirm.Cancel()}
                    </a>
                    <a href="#" key="btn-confirm" datatest="btn-tree-disable-confirm"
                       className="waves-effect waves-light btn red" onclick={confirm}>
                        {i18n.TreeView.DisableConfirm.Confirm()}
                    </a>
                </div>
            </div>
        </div>
    );
};

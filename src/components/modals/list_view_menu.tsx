import { Component, px, style } from '../../lib/types';
import { h } from 'hyperapp';
import { resources } from '../../states';
import { i18n } from '../../locales/keys';

declare const M: any;

interface ListViewMenuModalProps {
    treeEnabled: boolean;
    exportScope: 'all' | 'left';
    actions: {
        closeListViewMenuModal: () => void;
        importPagesFromClipboard: (data: { mode: 'import' | 'add' }) => void;
        exportListViewAsImage: () => void;
        exportLeftSegmentAsImage: () => void;
        exportListViewAsGif: () => void;
        exportLeftSegmentAsGif: () => void;
        copyAllPagesToClipboard: () => void;
        copyLeftSegmentToClipboard: () => void;
        exportListViewAsUrl: () => void;
        exportLeftSegmentAsUrl: () => void;
        setExportScope: (data: { scope: 'all' | 'left' }) => void;
        openListViewInExternalSite: () => void;
    };
}

export const ListViewMenuModal: Component<ListViewMenuModalProps> = ({ treeEnabled, exportScope, actions }) => {
    const close = () => {
        const modal = resources.modals.listViewMenu;
        if (modal !== undefined) {
            modal.close();
        }
    };

    const destroy = () => {
        resources.modals.listViewMenu = undefined;
    };

    const cancel = () => {
        actions.closeListViewMenuModal();
        close();
        destroy();
    };

    const oncreate = (element: HTMLDivElement) => {
        const instance = M.Modal.init(element, {
            onCloseStart: () => {
                actions.closeListViewMenuModal();
                destroy();
            },
        });

        instance.open();
        resources.modals.listViewMenu = instance;
    };

    // 出力アクションを実行してからモーダルを閉じて破棄する
    const runAndClose = (run: () => void) => () => {
        run();
        close();
        destroy();
    };

    const useLeft = treeEnabled && exportScope === 'left';

    const contentStyle = style({
        textAlign: 'center',
        padding: px(10),
    });

    const buttonsStyle = style({
        margin: '0px auto',
        padding: '0px',
        display: 'flex',
        justifyContent: 'flex-end',
        flexDirection: 'column',
        alignItems: 'center',
    });

    const btnStyle = style({
        width: '100%',
        maxWidth: px(280),
        margin: px(5),
    });

    const sectionHeadingStyle = style({
        width: '100%',
        maxWidth: px(280),
        margin: '12px auto 2px auto',
        fontSize: px(12),
        color: '#999',
        textAlign: 'left',
    });

    const hintStyle = style({
        display: 'block',
        fontSize: px(11),
        opacity: 0.85,
    });

    const scopeButtonBase = {
        flex: '1 1 0',
        padding: '6px 8px',
        fontSize: px(12),
        border: 'none',
        borderRadius: px(3),
        cursor: 'pointer',
        outline: 'none',
    };

    const scopeActiveStyle = style({
        ...scopeButtonBase,
        backgroundColor: '#2196F3',
        color: '#fff',
    });

    const scopeInactiveStyle = style({
        ...scopeButtonBase,
        backgroundColor: '#e0e0e0',
        color: '#666',
    });

    return (
        <div key="list-view-menu-modal-top">
            <div key="mdl-list-view-menu" datatest="mdl-list-view-menu"
                 className="modal" oncreate={oncreate}>
                <div key="modal-content" className="modal-content" style={contentStyle}>
                    <h4 key="menu-label" style={style({ marginTop: '0px', marginBottom: px(10), fontSize: px(22) })}>
                        {i18n.ListViewMenu.Title()}
                    </h4>

                    <div style={buttonsStyle}>
                        <div key="section-read" style={sectionHeadingStyle}>{i18n.ListViewMenu.Sections.Read()}</div>

                        <a href="#" key="btn-add" datatest="btn-add"
                           style={btnStyle}
                           className="waves-effect waves-light btn red"
                           onclick={runAndClose(() => actions.importPagesFromClipboard({ mode: 'add' }))}>
                            {i18n.ListViewMenu.Buttons.Insert()}
                            <span style={hintStyle}>{i18n.ListViewMenu.Buttons.InsertHint()}</span>
                        </a>

                        <a href="#" key="btn-import" datatest="btn-import"
                           style={btnStyle}
                           className="waves-effect waves-light btn red"
                           onclick={runAndClose(() => actions.importPagesFromClipboard({ mode: 'import' }))}>
                            {i18n.ListViewMenu.Buttons.Import()}
                            <span style={hintStyle}>{i18n.ListViewMenu.Buttons.ImportHint()}</span>
                        </a>

                        {treeEnabled ? (
                            <div key="scope-toggle"
                                 style={style({
                                     width: '100%',
                                     maxWidth: px(280),
                                     margin: '12px auto 2px auto',
                                 })}>
                                <div style={style({
                                    fontSize: px(12),
                                    color: '#999',
                                    textAlign: 'left',
                                    marginBottom: px(4),
                                })}>
                                    {i18n.ListViewMenu.Scope.Label()}
                                </div>
                                <div style={style({ display: 'flex', gap: px(4) })}>
                                    <button key="btn-scope-all" datatest="btn-scope-all"
                                            style={exportScope === 'all' ? scopeActiveStyle : scopeInactiveStyle}
                                            onclick={() => actions.setExportScope({ scope: 'all' })}>
                                        {i18n.ListViewMenu.Scope.All()}
                                    </button>
                                    <button key="btn-scope-left" datatest="btn-scope-left"
                                            style={exportScope === 'left' ? scopeActiveStyle : scopeInactiveStyle}
                                            onclick={() => actions.setExportScope({ scope: 'left' })}>
                                        {i18n.ListViewMenu.Scope.LeftToActive()}
                                    </button>
                                </div>
                            </div>
                        ) : undefined}

                        <div key="section-image" style={sectionHeadingStyle}>{i18n.ListViewMenu.Sections.Image()}</div>

                        <a href="#" key="btn-export-image" datatest="btn-export-image"
                           style={btnStyle}
                           className="waves-effect waves-light btn red"
                           onclick={runAndClose(() => (
                               useLeft ? actions.exportLeftSegmentAsImage() : actions.exportListViewAsImage()
                           ))}>
                            {i18n.ListViewMenu.Buttons.Png()}
                        </a>

                        <a href="#" key="btn-export-gif" datatest="btn-export-gif"
                           style={btnStyle}
                           className="waves-effect waves-light btn red"
                           onclick={runAndClose(() => (
                               useLeft ? actions.exportLeftSegmentAsGif() : actions.exportListViewAsGif()
                           ))}>
                            {i18n.ListViewMenu.Buttons.Gif()}
                        </a>

                        <div key="section-export" style={sectionHeadingStyle}>
                            {i18n.ListViewMenu.Sections.Export()}
                        </div>

                        <a href="#" key="btn-export-fumen" datatest="btn-export-fumen"
                           style={btnStyle}
                           className="waves-effect waves-light btn red"
                           onclick={runAndClose(() => (
                               useLeft ? actions.copyLeftSegmentToClipboard() : actions.copyAllPagesToClipboard()
                           ))}>
                            {i18n.ListViewMenu.Buttons.Fumen()}
                        </a>

                        <a href="#" key="btn-export-url" datatest="btn-export-url"
                           style={btnStyle}
                           className="waves-effect waves-light btn red"
                           onclick={runAndClose(() => (
                               useLeft ? actions.exportLeftSegmentAsUrl() : actions.exportListViewAsUrl()
                           ))}>
                            {i18n.ListViewMenu.Buttons.Url()}
                        </a>

                        <div key="section-external" style={sectionHeadingStyle}>
                            {i18n.ListViewMenu.Sections.External()}
                        </div>

                        <a href="#" key="btn-export-external-site" datatest="btn-export-external-site"
                           style={btnStyle}
                           className="waves-effect waves-light btn red"
                           onclick={runAndClose(() => actions.openListViewInExternalSite())}>
                            {i18n.ListViewMenu.Buttons.ExternalSite()}
                        </a>
                    </div>
                </div>

                <div key="modal-footer" className="modal-footer">
                    <a href="#" key="btn-cancel" datatest="btn-cancel"
                       className="waves-effect waves-teal btn-flat" onclick={cancel}>
                        {i18n.ListViewMenu.Buttons.Cancel()}
                    </a>
                </div>
            </div>
        </div>
    );
};

import { Component, px, style } from '../../lib/types';
import { h } from 'hyperapp';
import { resources } from '../../states';
import { i18n } from '../../locales/keys';
import { Icon } from '../atomics/icons';

declare const M: any;

interface ListViewMenuModalProps {
    treeEnabled: boolean;
    exportScope: 'all' | 'left';
    gifFrameDelayMs: number;
    shortenUrls: boolean;
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
        copyListViewUrlToClipboard: () => void;
        copyTetgramRawToClipboard: () => void;
        setExportScope: (data: { scope: 'all' | 'left' }) => void;
        setListViewShortenUrls: (data: { enabled: boolean }) => void;
        changeGifFrameDelay: (data: { delayMs: number }) => void;
        openListViewInFumenZui: () => void;
        openListViewInFumenForMobile: () => void;
        openListViewInExternalSite: () => void;
        openListViewInTetgram: () => void;
    };
}

export const ListViewMenuModal: Component<ListViewMenuModalProps> = (
    { treeEnabled, exportScope, gifFrameDelayMs, shortenUrls, actions },
) => {
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

    const modalStyle = style({
        maxHeight: '85%',
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
        margin: '20px auto 6px auto',
        fontSize: px(15),
        fontWeight: 'bold',
        color: '#424242',
        textAlign: 'left',
    });

    const hintStyle = style({
        display: 'block',
        fontSize: px(11),
        opacity: 0.85,
    });

    const externalLinkStyle = style({
        display: 'block',
        width: '100%',
        maxWidth: px(280),
        margin: '4px auto 6px auto',
        color: '#1e88e5',
        fontSize: px(13),
        textAlign: 'left',
        textDecoration: 'underline',
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

    const settingStyle = style({
        width: '100%',
        maxWidth: px(280),
        margin: '8px auto 4px auto',
        textAlign: 'left',
    });

    const settingNameStyle = style({
        fontSize: px(13),
        fontWeight: 'bold',
        color: '#424242',
        marginBottom: px(2),
    });

    const settingDescriptionStyle = style({
        color: '#666',
        fontSize: px(11),
        marginBottom: px(4),
    });

    const onchangeGifFrameDelay = (event: Event) => {
        const target = event.target as HTMLInputElement;
        const value = parseInt(target.value, 10);
        if (!isNaN(value) && value >= 100 && value <= 10000) {
            actions.changeGifFrameDelay({ delayMs: value });
        }
    };

    const onchangeShortenUrls = (event: Event) => {
        const target = event.target as HTMLInputElement;
        actions.setListViewShortenUrls({ enabled: target.checked });
    };

    return (
        <div key="list-view-menu-modal-top">
            <div key="mdl-list-view-menu" datatest="mdl-list-view-menu"
                 className="modal" style={modalStyle} oncreate={oncreate}>
                <div key="modal-content" className="modal-content" style={contentStyle}>
                    <h4 key="menu-label" style={style({ marginTop: '0px', marginBottom: px(10), fontSize: px(22) })}>
                        {i18n.ListViewMenu.Title()}
                    </h4>

                    <div style={buttonsStyle}>
                        <div key="section-read" style={sectionHeadingStyle}>{i18n.ListViewMenu.Sections.Read()}</div>

                        <a href="#" key="btn-import" datatest="btn-import"
                           style={btnStyle}
                           className="waves-effect waves-light btn red"
                           onclick={runAndClose(() => actions.importPagesFromClipboard({ mode: 'import' }))}>
                            <Icon key="btn-import-icon" classNames={['left']} iconSize={18}>move_to_inbox</Icon>
                            {i18n.ListViewMenu.Buttons.Import()}
                            <span style={hintStyle}>{i18n.ListViewMenu.Buttons.ImportHint()}</span>
                        </a>

                        <a href="#" key="btn-add" datatest="btn-add"
                           style={btnStyle}
                           className="waves-effect waves-light btn red"
                           onclick={runAndClose(() => actions.importPagesFromClipboard({ mode: 'add' }))}>
                            <Icon key="btn-add-icon" classNames={['left']} iconSize={18}>add</Icon>
                            {i18n.ListViewMenu.Buttons.Insert()}
                            <span style={hintStyle}>{i18n.ListViewMenu.Buttons.InsertHint()}</span>
                        </a>

                        <div key="section-image" style={sectionHeadingStyle}>{i18n.ListViewMenu.Sections.Image()}</div>

                        <a href="#" key="btn-export-image" datatest="btn-export-image"
                           style={btnStyle}
                           className="waves-effect waves-light btn red"
                           onclick={runAndClose(() => (
                               useLeft ? actions.exportLeftSegmentAsImage() : actions.exportListViewAsImage()
                           ))}>
                            <Icon key="btn-export-image-icon" classNames={['left']} iconSize={18}>image</Icon>
                            {i18n.ListViewMenu.Buttons.Png()}
                        </a>

                        <a href="#" key="btn-export-gif" datatest="btn-export-gif"
                           style={btnStyle}
                           className="waves-effect waves-light btn red"
                           onclick={runAndClose(() => (
                               useLeft ? actions.exportLeftSegmentAsGif() : actions.exportListViewAsGif()
                           ))}>
                            <Icon key="btn-export-gif-icon" classNames={['left']} iconSize={18}>gif</Icon>
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
                            <Icon key="btn-export-fumen-icon" classNames={['left']} iconSize={18}>content_copy</Icon>
                            {i18n.ListViewMenu.Buttons.Fumen()}
                        </a>

                        <a href="#" key="btn-copy-url" datatest="btn-copy-url"
                           style={btnStyle}
                           className="waves-effect waves-light btn red"
                           onclick={runAndClose(() => actions.copyListViewUrlToClipboard())}>
                            <Icon key="btn-copy-url-icon" classNames={['left']} iconSize={18}>content_copy</Icon>
                            {i18n.ListViewMenu.Buttons.UrlCopy()}
                        </a>

                        <a href="#" key="btn-export-tetgram" datatest="btn-export-tetgram"
                           style={btnStyle}
                           className="waves-effect waves-light btn red"
                           onclick={runAndClose(() => actions.copyTetgramRawToClipboard())}>
                            <Icon key="btn-export-tetgram-icon" classNames={['left']} iconSize={18}>content_copy</Icon>
                            {i18n.ListViewMenu.Buttons.TetgramRaw()}
                            <span style={hintStyle}>{i18n.ListViewMenu.Buttons.TetgramRawHint()}</span>
                        </a>

                        <a href="#" key="btn-export-url" datatest="btn-export-url"
                           style={externalLinkStyle}
                           className="waves-effect waves-teal"
                           onclick={runAndClose(() => (
                               useLeft ? actions.exportLeftSegmentAsUrl() : actions.exportListViewAsUrl()
                           ))}>
                            <Icon key="btn-export-url-icon" classNames={['left']} iconSize={18}>link</Icon>
                            {i18n.ListViewMenu.Buttons.Url()}
                        </a>

                        <div key="section-external" style={sectionHeadingStyle}>
                            {i18n.ListViewMenu.Sections.External()}
                        </div>

                        <a href="#" key="btn-export-fumen-zui" datatest="btn-export-fumen-zui"
                           style={externalLinkStyle}
                           className="waves-effect waves-teal"
                           onclick={runAndClose(() => actions.openListViewInFumenZui())}>
                            <Icon key="btn-export-fumen-zui-icon" classNames={['left']} iconSize={18}>open_in_new</Icon>
                            {i18n.ListViewMenu.Buttons.FumenZui()}
                        </a>

                        <a href="#" key="btn-export-tetgram-url" datatest="btn-export-tetgram-url"
                           style={externalLinkStyle}
                           className="waves-effect waves-teal"
                           onclick={runAndClose(() => actions.openListViewInTetgram())}>
                            <Icon key="btn-export-tetgram-url-icon" classNames={['left']} iconSize={18}>
                                open_in_new
                            </Icon>
                            {i18n.ListViewMenu.Buttons.TetgramUrl()}
                            <span datatest="hint-tetgram-url" style={hintStyle}>
                                {i18n.ListViewMenu.Buttons.TetgramUrlHint()}
                            </span>
                        </a>

                        <a href="#" key="btn-export-external-site" datatest="btn-export-external-site"
                           style={externalLinkStyle}
                           className="waves-effect waves-teal"
                           onclick={runAndClose(() => actions.openListViewInExternalSite())}>
                            <Icon key="btn-export-external-site-icon" classNames={['left']} iconSize={18}>
                                open_in_new
                            </Icon>
                            {i18n.ListViewMenu.Buttons.ExternalSite()}
                        </a>

                        <a href="#" key="btn-export-fumen-for-mobile" datatest="btn-export-fumen-for-mobile"
                           style={externalLinkStyle}
                           className="waves-effect waves-teal"
                           onclick={runAndClose(() => actions.openListViewInFumenForMobile())}>
                            <Icon key="btn-export-fumen-for-mobile-icon" classNames={['left']} iconSize={18}>
                                open_in_new
                            </Icon>
                            {i18n.ListViewMenu.Buttons.FumenForMobile()}
                        </a>

                        <div key="section-settings" style={sectionHeadingStyle}>
                            {i18n.ListViewMenu.Sections.Settings()}
                        </div>

                        {treeEnabled ? (
                            <div key="scope-toggle" style={settingStyle}>
                                <div style={settingNameStyle}>
                                    {i18n.ListViewMenu.Scope.Label()}
                                </div>
                                <div style={settingDescriptionStyle}>
                                    {i18n.ListViewMenu.Scope.Description()}
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

                        <div key="gif-frame-delay" style={settingStyle}>
                            <div style={settingNameStyle}>
                                {i18n.UserSettings.GifFrameDelayMs.Title()}
                            </div>
                            <div style={settingDescriptionStyle}>
                                {i18n.UserSettings.GifFrameDelayMs.Description()}
                            </div>
                            <div style={style({ display: 'flex', alignItems: 'center', gap: px(4) })}>
                                <input key="input-gif-frame-delay" datatest="input-gif-frame-delay"
                                       type="number" value={gifFrameDelayMs} min={100} max={10000} step={100}
                                       onchange={onchangeGifFrameDelay}
                                       style={style({ width: px(100), textAlign: 'center' })}/>
                                <span>ms</span>
                            </div>
                        </div>

                        <div key="shorten-urls" style={settingStyle}>
                            <div style={settingNameStyle}>{i18n.ListViewMenu.ShortUrl.Title()}</div>
                            <label>
                                <input key="switch-shorten-urls" datatest="switch-shorten-urls" type="checkbox"
                                       checked={shortenUrls} onchange={onchangeShortenUrls}/>
                                <span>{i18n.ListViewMenu.ShortUrl.Description()}</span>
                            </label>
                        </div>
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

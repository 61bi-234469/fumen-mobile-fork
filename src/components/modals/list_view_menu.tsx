import { Component, px, style } from '../../lib/types';
import { h } from 'hyperapp';
import { resources } from '../../states';
import { i18n } from '../../locales/keys';
import { Icon } from '../atomics/icons';
import { CSSProperties } from 'typestyle/lib/types';

declare const M: any;

interface ListViewMenuModalProps {
    treeEnabled: boolean;
    exportScope: 'all' | 'left';
    menuTab: 'export' | 'import';
    pageCount: number;
    selectedPathPageCount: number;
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
        setListViewMenuTab: (data: { tab: 'export' | 'import' }) => void;
        changeGifFrameDelay: (data: { delayMs: number }) => void;
        openListViewInFumenZui: () => void;
        openListViewInFumenForMobile: () => void;
        openListViewInExternalSite: () => void;
        openListViewInTetgram: () => void;
    };
}

export const ListViewMenuModal: Component<ListViewMenuModalProps> = (
    { treeEnabled, exportScope, menuTab, pageCount, selectedPathPageCount, gifFrameDelayMs, shortenUrls, actions },
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

    const tabsStyle = style({
        width: '100%',
        maxWidth: px(304),
        margin: '0px auto 12px auto',
        display: 'flex',
        gap: px(4),
        padding: px(4),
        backgroundColor: '#eceff1',
        borderRadius: px(6),
    });

    const tabButtonBase = {
        flex: '1 1 0',
        padding: '9px 8px',
        border: 'none',
        borderRadius: px(4),
        fontSize: px(14),
        fontWeight: 'bold',
        cursor: 'pointer',
    };

    const activeTabStyle = style({
        ...tabButtonBase,
        backgroundColor: '#fff',
        color: '#1565c0',
        boxShadow: '0 1px 4px rgba(0, 0, 0, 0.18)',
    });

    const inactiveTabStyle = style({
        ...tabButtonBase,
        backgroundColor: 'transparent',
        color: '#546e7a',
        boxShadow: 'none',
    });

    const btnStyle = style({
        width: '100%',
        margin: '5px 0px',
        height: 'auto',
        minHeight: px(36),
        lineHeight: px(18),
        padding: '6px 12px',
    });

    const sectionHeadingStyle = style({
        width: '100%',
        margin: '0px 0px 8px 0px',
        fontSize: px(15),
        fontWeight: 'bold',
        color: '#424242',
        textAlign: 'left',
    });

    const sectionBaseStyle: CSSProperties = {
        width: '100%',
        maxWidth: px(304),
        margin: '12px auto 0px auto',
        padding: px(12),
        backgroundColor: '#fafafa',
        border: '1px solid #e0e0e0',
        borderRadius: px(6),
        textAlign: 'left',
    };

    const sectionStyle = style(sectionBaseStyle);

    const firstSectionStyle = style({
        ...sectionBaseStyle,
        marginTop: '0px',
    });

    const scopeCardStyle = style({
        ...sectionBaseStyle,
        marginTop: '0px',
        backgroundColor: '#e3f2fd',
        border: '1px solid #90caf9',
    });

    const imageButtonsStyle = style({
        display: 'flex',
        gap: px(8),
    });

    const imageButtonStyle = style({
        flex: '1 1 0',
        width: 'auto',
        margin: '0px',
    });

    const hintStyle = style({
        display: 'block',
        fontSize: px(11),
        lineHeight: px(14),
        marginTop: px(2),
        opacity: 0.85,
    });

    const externalLinkStyle = style({
        display: 'block',
        width: '100%',
        margin: '6px 0px',
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

    const settingBaseStyle: CSSProperties = {
        width: '100%',
        margin: '10px 0px 0px 0px',
        textAlign: 'left',
    };

    const settingStyle = style(settingBaseStyle);

    const topSettingStyle = style({
        ...settingBaseStyle,
        marginTop: '0px',
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

    const readonlyScopeStyle = style({
        padding: '8px 10px',
        backgroundColor: '#fff',
        borderRadius: px(3),
        fontSize: px(13),
        fontWeight: 'bold',
        color: '#1565c0',
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

                    <div key="list-view-menu-tabs" role="tablist" style={tabsStyle}>
                        <button key="tab-list-view-menu-export" datatest="tab-list-view-menu-export"
                                type="button" role="tab" aria-selected={menuTab === 'export'}
                                style={menuTab === 'export' ? activeTabStyle : inactiveTabStyle}
                                onclick={() => actions.setListViewMenuTab({ tab: 'export' })}>
                            {i18n.ListViewMenu.Tabs.Export()}
                        </button>
                        <button key="tab-list-view-menu-import" datatest="tab-list-view-menu-import"
                                type="button" role="tab" aria-selected={menuTab === 'import'}
                                style={menuTab === 'import' ? activeTabStyle : inactiveTabStyle}
                                onclick={() => actions.setListViewMenuTab({ tab: 'import' })}>
                            {i18n.ListViewMenu.Tabs.Import()}
                        </button>
                    </div>

                    {menuTab === 'import' ? (
                        <div key="panel-list-view-menu-import" datatest="panel-list-view-menu-import"
                             role="tabpanel" style={buttonsStyle}>
                            <div key="section-read" datatest="section-read" style={firstSectionStyle}>
                                <div style={sectionHeadingStyle}>{i18n.ListViewMenu.Sections.Read()}</div>
                                <a href="#" key="btn-import" datatest="btn-import" style={btnStyle}
                                   className="waves-effect waves-light btn red"
                                   onclick={runAndClose(() => actions.importPagesFromClipboard({ mode: 'import' }))}>
                                    <Icon key="btn-import-icon" classNames={['left']} iconSize={18}>
                                        move_to_inbox
                                    </Icon>
                                    {i18n.ListViewMenu.Buttons.Import()}
                                    <span style={hintStyle}>{i18n.ListViewMenu.Buttons.ImportHint()}</span>
                                </a>
                                <a href="#" key="btn-add" datatest="btn-add" style={btnStyle}
                                   className="waves-effect waves-light btn red"
                                   onclick={runAndClose(() => actions.importPagesFromClipboard({ mode: 'add' }))}>
                                    <Icon key="btn-add-icon" classNames={['left']} iconSize={18}>add</Icon>
                                    {i18n.ListViewMenu.Buttons.Insert()}
                                    <span style={hintStyle}>{i18n.ListViewMenu.Buttons.InsertHint()}</span>
                                </a>
                            </div>
                        </div>
                    ) : (
                        <div key="panel-list-view-menu-export" datatest="panel-list-view-menu-export"
                             role="tabpanel" style={buttonsStyle}>
                            <div key="export-scope-card" datatest="export-scope-card" style={scopeCardStyle}>
                                <div style={sectionHeadingStyle}>{i18n.ListViewMenu.Scope.Label()}</div>
                                <div style={settingDescriptionStyle}>{i18n.ListViewMenu.Scope.Description()}</div>
                                {treeEnabled ? (
                                    <div style={style({ display: 'flex', gap: px(4) })}>
                                        <button key="btn-scope-all" datatest="btn-scope-all"
                                                style={exportScope === 'all' ? scopeActiveStyle : scopeInactiveStyle}
                                                onclick={() => actions.setExportScope({ scope: 'all' })}>
                                            {i18n.ListViewMenu.Scope.AllWithCount(pageCount)}
                                        </button>
                                        <button key="btn-scope-left" datatest="btn-scope-left"
                                                style={exportScope === 'left' ? scopeActiveStyle : scopeInactiveStyle}
                                                onclick={() => actions.setExportScope({ scope: 'left' })}>
                                            {i18n.ListViewMenu.Scope.LeftToActiveWithCount(selectedPathPageCount)}
                                        </button>
                                    </div>
                                ) : (
                                    <div datatest="scope-summary-all" style={readonlyScopeStyle}>
                                        {i18n.ListViewMenu.Scope.AllWithCount(pageCount)}
                                    </div>
                                )}
                            </div>

                            <div key="section-image" datatest="section-image" style={sectionStyle}>
                                <div style={sectionHeadingStyle}>{i18n.ListViewMenu.Sections.Image()}</div>
                                <div style={imageButtonsStyle}>
                                    <a href="#" key="btn-export-image" datatest="btn-export-image"
                                       style={imageButtonStyle} className="waves-effect waves-light btn red"
                                       onclick={runAndClose(() => (
                                           useLeft
                                               ? actions.exportLeftSegmentAsImage()
                                               : actions.exportListViewAsImage()
                                       ))}>
                                        <Icon key="btn-export-image-icon" classNames={['left']} iconSize={18}>
                                            image
                                        </Icon>
                                        {i18n.ListViewMenu.Buttons.Png()}
                                    </a>
                                    <a href="#" key="btn-export-gif" datatest="btn-export-gif"
                                       style={imageButtonStyle} className="waves-effect waves-light btn red"
                                       onclick={runAndClose(() => (
                                           useLeft ? actions.exportLeftSegmentAsGif() : actions.exportListViewAsGif()
                                       ))}>
                                        <Icon key="btn-export-gif-icon" classNames={['left']} iconSize={18}>gif</Icon>
                                        {i18n.ListViewMenu.Buttons.Gif()}
                                    </a>
                                </div>
                                <div key="gif-frame-delay" style={settingStyle}>
                                    <div style={settingNameStyle}>{i18n.UserSettings.GifFrameDelayMs.Title()}</div>
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
                            </div>

                            <div key="section-export" datatest="section-export" style={sectionStyle}>
                                <div style={sectionHeadingStyle}>{i18n.ListViewMenu.Sections.Copy()}</div>
                                <a href="#" key="btn-export-fumen" datatest="btn-export-fumen" style={btnStyle}
                                   className="waves-effect waves-light btn red"
                                   onclick={runAndClose(() => (
                                       useLeft
                                           ? actions.copyLeftSegmentToClipboard()
                                           : actions.copyAllPagesToClipboard()
                                   ))}>
                                    <Icon key="btn-export-fumen-icon" classNames={['left']} iconSize={18}>
                                        content_copy
                                    </Icon>
                                    {i18n.ListViewMenu.Buttons.Fumen()}
                                </a>
                                <a href="#" key="btn-copy-url" datatest="btn-copy-url" style={btnStyle}
                                   className="waves-effect waves-light btn red"
                                   onclick={runAndClose(() => actions.copyListViewUrlToClipboard())}>
                                    <Icon key="btn-copy-url-icon" classNames={['left']} iconSize={18}>
                                        content_copy
                                    </Icon>
                                    {i18n.ListViewMenu.Buttons.UrlCopy()}
                                </a>
                                <div key="section-tetgram-copy" datatest="section-tetgram-copy">
                                    <a href="#" key="btn-export-tetgram" datatest="btn-export-tetgram"
                                       style={btnStyle} className="waves-effect waves-light btn red"
                                       onclick={runAndClose(() => actions.copyTetgramRawToClipboard())}>
                                        <Icon key="btn-export-tetgram-icon" classNames={['left']} iconSize={18}>
                                            content_copy
                                        </Icon>
                                        {i18n.ListViewMenu.Buttons.TetgramRaw()}
                                        <span style={hintStyle}>{i18n.ListViewMenu.Buttons.TetgramRawHint()}</span>
                                    </a>
                                </div>
                            </div>

                            <div key="section-external" datatest="section-external" style={sectionStyle}>
                                <div style={sectionHeadingStyle}>{i18n.ListViewMenu.Sections.Url()}</div>
                                <div key="shorten-urls" style={topSettingStyle}>
                                    <div style={settingNameStyle}>{i18n.ListViewMenu.ShortUrl.Title()}</div>
                                    <label>
                                        <input key="switch-shorten-urls" datatest="switch-shorten-urls"
                                               type="checkbox" checked={shortenUrls}
                                               onchange={onchangeShortenUrls}/>
                                        <span>{i18n.ListViewMenu.ShortUrl.Description()}</span>
                                    </label>
                                </div>
                                <a href="#" key="btn-export-url" datatest="btn-export-url"
                                   style={externalLinkStyle} className="waves-effect waves-teal"
                                   onclick={runAndClose(() => (
                                       useLeft ? actions.exportLeftSegmentAsUrl() : actions.exportListViewAsUrl()
                                   ))}>
                                    <Icon key="btn-export-url-icon" classNames={['left']} iconSize={18}>link</Icon>
                                    {i18n.ListViewMenu.Buttons.Url()}
                                </a>
                                <a href="#" key="btn-export-fumen-zui" datatest="btn-export-fumen-zui"
                                   style={externalLinkStyle} className="waves-effect waves-teal"
                                   onclick={runAndClose(() => actions.openListViewInFumenZui())}>
                                    <Icon key="btn-export-fumen-zui-icon" classNames={['left']} iconSize={18}>
                                        open_in_new
                                    </Icon>
                                    {i18n.ListViewMenu.Buttons.FumenZui()}
                                </a>
                                <a href="#" key="btn-export-external-site" datatest="btn-export-external-site"
                                   style={externalLinkStyle} className="waves-effect waves-teal"
                                   onclick={runAndClose(() => actions.openListViewInExternalSite())}>
                                    <Icon key="btn-export-external-site-icon" classNames={['left']} iconSize={18}>
                                        open_in_new
                                    </Icon>
                                    {i18n.ListViewMenu.Buttons.ExternalSite()}
                                </a>
                                <a href="#" key="btn-export-fumen-for-mobile"
                                   datatest="btn-export-fumen-for-mobile" style={externalLinkStyle}
                                   className="waves-effect waves-teal"
                                   onclick={runAndClose(() => actions.openListViewInFumenForMobile())}>
                                    <Icon key="btn-export-fumen-for-mobile-icon" classNames={['left']} iconSize={18}>
                                        open_in_new
                                    </Icon>
                                    {i18n.ListViewMenu.Buttons.FumenForMobile()}
                                </a>
                                <div key="section-tetgram" datatest="section-tetgram">
                                    <a href="#" key="btn-export-tetgram-url" datatest="btn-export-tetgram-url"
                                       style={externalLinkStyle} className="waves-effect waves-teal"
                                       onclick={runAndClose(() => actions.openListViewInTetgram())}>
                                        <Icon key="btn-export-tetgram-url-icon" classNames={['left']} iconSize={18}>
                                            open_in_new
                                        </Icon>
                                        {i18n.ListViewMenu.Buttons.TetgramUrl()}
                                        <span datatest="hint-tetgram-url" style={hintStyle}>
                                            {i18n.ListViewMenu.Buttons.TetgramUrlHint()}
                                        </span>
                                    </a>
                                </div>
                            </div>
                        </div>
                    )}
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

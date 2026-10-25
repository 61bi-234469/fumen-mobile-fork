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
    exportShowPageNumbers: boolean;
    exportShowComments: boolean;
    imageOptionsOpen: boolean;
    otherSitesOpen: boolean;
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
        setExportShowPageNumbers: (data: { enabled: boolean }) => void;
        setExportShowComments: (data: { enabled: boolean }) => void;
        setExportImageOptionsOpen: (data: { open: boolean }) => void;
        setExportOtherSitesOpen: (data: { open: boolean }) => void;
        setGifFrameDelay: (data: { delayMs: number }) => void;
        openListViewInFumenZui: () => void;
        openListViewInFumenForMobile: () => void;
        openListViewInExternalSite: () => void;
        openListViewInTetgram: () => void;
    };
}

// 取り込み・書き出しは開いた入口で決まるため、タブで切り替えず別の窓として出す。
// 書き出しは「共有・画像・他のサイト」の目的別に並べ、細かい設定は折りたたみに入れる。
export const ListViewMenuModal: Component<ListViewMenuModalProps> = (
    {
        treeEnabled,
        exportScope,
        menuTab,
        pageCount,
        selectedPathPageCount,
        gifFrameDelayMs,
        shortenUrls,
        exportShowPageNumbers,
        exportShowComments,
        imageOptionsOpen,
        otherSitesOpen,
        actions,
    },
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
    const runAndClose = (run: () => void) => (event?: Event) => {
        if (event !== undefined) {
            event.preventDefault();
        }
        run();
        close();
        destroy();
    };

    const useLeft = treeEnabled && exportScope === 'left';

    const contentStyle = style({
        padding: '16px 16px 4px 16px',
        textAlign: 'left',
    });

    // Materialize 既定の幅（スマホで 80%）だと 2 列のボタン名が切れるので、狭い画面では端まで使う
    const modalStyle = style({
        maxHeight: '85%',
        maxWidth: px(400),
        width: `calc(100% - ${px(32)})`,
    });

    const headerStyle = style({
        alignItems: 'center',
        display: 'flex',
        gap: px(8),
        justifyContent: 'space-between',
        margin: '0px 0px 8px 0px',
    });

    const titleStyle = style({
        flexShrink: 0,
        fontSize: px(20),
        fontWeight: 'bold',
        margin: '0px',
        whiteSpace: 'nowrap',
    });

    const pageCountStyle = style({
        color: '#757575',
        fontSize: px(13),
        whiteSpace: 'nowrap',
    });

    // 範囲は「設定」なので、下の操作ボタン（横いっぱいの 2 つ並び）と形を分ける。
    // 題名の右に寄せた小さな切り替えにし、灰色の溝の中で選択中だけを白く浮かせる。
    const scopeGroupStyle = style({
        backgroundColor: '#eceff1',
        borderRadius: px(8),
        display: 'flex',
        flex: '0 1 auto',
        gap: px(2),
        minWidth: '0',
        padding: px(2),
    });

    const scopeButtonBase = {
        border: 'none',
        borderRadius: px(6),
        cursor: 'pointer',
        fontSize: px(12),
        lineHeight: px(16),
        outline: 'none',
        padding: '4px 10px',
        whiteSpace: 'nowrap' as const,
    };

    const scopeActiveStyle = style({
        ...scopeButtonBase,
        backgroundColor: '#fff',
        boxShadow: '0 1px 2px rgba(0, 0, 0, .2)',
        color: '#1565c0',
        fontWeight: 'bold',
    });

    const scopeInactiveStyle = style({
        ...scopeButtonBase,
        backgroundColor: 'transparent',
        color: '#607d8b',
    });

    // 各段は枠で囲まず、細い区切り線だけで分ける
    const sectionStyle = style({
        borderTop: '1px solid #eeeeee',
        display: 'block',
        padding: '12px 0px',
    });

    const sectionHeadingStyle = style({
        color: '#616161',
        fontSize: px(13),
        fontWeight: 'bold',
        margin: '0px 0px 8px 0px',
    });

    const rowStyle = style({
        display: 'flex',
        gap: px(8),
    });

    const buttonBase: CSSProperties = {
        alignItems: 'center',
        display: 'flex',
        flex: '1 1 0',
        gap: px(6),
        height: px(38),
        justifyContent: 'center',
        lineHeight: px(18),
        margin: '0px',
        minWidth: '0',
        padding: '0px 10px',
        textTransform: 'none',
        whiteSpace: 'nowrap',
    };

    // 塗りは各窓の主な操作 1 つだけ。他は枠線ボタンにする
    const primaryButtonStyle = style(buttonBase);

    const outlineButtonStyle = style({
        ...buttonBase,
        backgroundColor: '#fff',
        border: '1px solid #d0d0d0',
        borderRadius: px(2),
        color: '#424242',
    });

    const summaryStyle = style({
        color: '#616161',
        cursor: 'pointer',
        fontSize: px(13),
        fontWeight: 'bold',
        outline: 'none',
        userSelect: 'none',
    });

    const optionsSummaryStyle = style({
        color: '#757575',
        cursor: 'pointer',
        fontSize: px(12),
        margin: '8px 0px 0px 0px',
        outline: 'none',
        userSelect: 'none',
    });

    const optionsBodyStyle = style({
        display: 'grid',
        gap: px(6),
        padding: '8px 0px 0px 4px',
    });

    const gifDelayRowStyle = style({
        alignItems: 'center',
        color: '#424242',
        display: 'flex',
        fontSize: px(13),
        gap: px(6),
        whiteSpace: 'nowrap',
    });

    const gifDelayInputStyle = style({
        height: px(28),
        margin: '0px',
        textAlign: 'center',
        width: px(64),
    });

    const siteListStyle = style({
        display: 'grid',
        padding: '6px 0px 0px 0px',
    });

    const siteRowStyle = style({
        alignItems: 'center',
        borderBottom: '1px solid #f5f5f5',
        display: 'flex',
        gap: px(8),
        minHeight: px(36),
    });

    const siteLinkStyle = style({
        alignItems: 'center',
        color: '#1e88e5',
        display: 'flex',
        flex: '1 1 auto',
        fontSize: px(14),
        gap: px(8),
        minWidth: '0',
        padding: '6px 0px',
    });

    const smallButtonStyle = style({
        alignItems: 'center',
        backgroundColor: '#fff',
        border: '1px solid #d0d0d0',
        borderRadius: px(14),
        color: '#424242',
        cursor: 'pointer',
        display: 'flex',
        flex: '0 0 auto',
        fontSize: px(12),
        gap: px(6),
        padding: '3px 10px',
    });

    const treeBadgeStyle = style({
        backgroundColor: '#e3f2fd',
        borderRadius: px(8),
        color: '#1565c0',
        fontSize: px(11),
        lineHeight: px(16),
        padding: '0px 6px',
        whiteSpace: 'nowrap',
    });

    const warningHintStyle = style({
        color: '#e65100',
        fontSize: px(11),
        lineHeight: px(14),
        margin: '2px 0px 4px 26px',
    });

    const checkboxRowStyle = style({
        display: 'block',
        margin: '10px 0px 0px 0px',
    });

    // details の開閉は state と同期させ、次に開いたときも保つ
    const ontoggle = (current: boolean, set: (data: { open: boolean }) => void) => (event: Event) => {
        const open = (event.target as HTMLDetailsElement).open;
        if (open !== current) {
            set({ open });
        }
    };

    const onchangeGifFrameDelay = (event: Event) => {
        const target = event.target as HTMLInputElement;
        const value = parseInt(target.value, 10);
        if (!isNaN(value) && value >= 100 && value <= 10000) {
            actions.setGifFrameDelay({ delayMs: value });
        }
    };

    const onchangeShortenUrls = (event: Event) => {
        const target = event.target as HTMLInputElement;
        actions.setListViewShortenUrls({ enabled: target.checked });
    };

    const onchangePageNumbers = (event: Event) => {
        actions.setExportShowPageNumbers({ enabled: (event.target as HTMLInputElement).checked });
    };

    const onchangeComments = (event: Event) => {
        actions.setExportShowComments({ enabled: (event.target as HTMLInputElement).checked });
    };

    const title = menuTab === 'import' ? i18n.ListViewMenu.Tabs.Import() : i18n.ListViewMenu.Tabs.Export();

    const importBody = (
        <div key="panel-list-view-menu-import" datatest="panel-list-view-menu-import">
            <div key="section-read" datatest="section-read" style={sectionStyle}>
                <div style={sectionHeadingStyle}>{i18n.ListViewMenu.Sections.Clipboard()}</div>
                <div style={rowStyle}>
                    <a href="#" key="btn-import" datatest="btn-import" style={primaryButtonStyle}
                       className="waves-effect waves-light btn red"
                       onclick={runAndClose(() => actions.importPagesFromClipboard({ mode: 'import' }))}>
                        <Icon key="btn-import-icon" iconSize={18}>move_to_inbox</Icon>
                        {i18n.ListViewMenu.Buttons.Import()}
                    </a>
                    <a href="#" key="btn-add" datatest="btn-add" style={outlineButtonStyle}
                       className="waves-effect btn-flat"
                       onclick={runAndClose(() => actions.importPagesFromClipboard({ mode: 'add' }))}>
                        <Icon key="btn-add-icon" iconSize={18}>add</Icon>
                        {i18n.ListViewMenu.Buttons.Insert()}
                    </a>
                </div>
            </div>
        </div>
    );

    // 範囲を選べるのはツリー有効時だけ。それ以外は題名の右にページ数だけを出す
    const scopeControl = treeEnabled ? (
        <div key="export-scope" datatest="export-scope" role="radiogroup"
             aria-label={i18n.ListViewMenu.Scope.Label()} style={scopeGroupStyle}>
            <button key="btn-scope-all" datatest="btn-scope-all" type="button" role="radio"
                    aria-checked={exportScope === 'all' ? 'true' : 'false'}
                    style={exportScope === 'all' ? scopeActiveStyle : scopeInactiveStyle}
                    onclick={() => actions.setExportScope({ scope: 'all' })}>
                {i18n.ListViewMenu.Scope.AllWithCount(pageCount)}
            </button>
            <button key="btn-scope-left" datatest="btn-scope-left" type="button" role="radio"
                    aria-checked={exportScope === 'left' ? 'true' : 'false'}
                    style={exportScope === 'left' ? scopeActiveStyle : scopeInactiveStyle}
                    onclick={() => actions.setExportScope({ scope: 'left' })}>
                {i18n.ListViewMenu.Scope.LeftToActiveWithCount(selectedPathPageCount)}
            </button>
        </div>
    ) : undefined;

    const siteRow = (key: string, label: string, iconName: string, onclick: () => void, extra?: any) => (
        <div key={`${key}-row`} style={siteRowStyle}>
            <a href="#" key={key} datatest={key} style={siteLinkStyle} className="waves-effect waves-teal"
               onclick={runAndClose(onclick)}>
                <Icon key={`${key}-icon`} iconSize={18}>{iconName}</Icon>
                {label}
            </a>
            {extra}
        </div>
    );

    const tetgramRawButton = (
        <button key="btn-export-tetgram" datatest="btn-export-tetgram" type="button" style={smallButtonStyle}
                onclick={runAndClose(() => actions.copyTetgramRawToClipboard())}>
            {i18n.ListViewMenu.Buttons.TetgramRaw()}
            {treeEnabled ? (
                <span key="badge-tetgram-raw-tree" datatest="badge-tetgram-raw-tree" style={treeBadgeStyle}>
                    {i18n.ListViewMenu.Buttons.TetgramRawHint()}
                </span>
            ) : undefined}
        </button>
    );

    const exportBody = (
        <div key="panel-list-view-menu-export" datatest="panel-list-view-menu-export">
            <div key="section-export" datatest="section-export" style={sectionStyle}>
                <div style={sectionHeadingStyle}>{i18n.ListViewMenu.Sections.Share()}</div>
                <div style={rowStyle}>
                    <a href="#" key="btn-copy-url" datatest="btn-copy-url" style={primaryButtonStyle}
                       className="waves-effect waves-light btn red"
                       onclick={runAndClose(() => actions.copyListViewUrlToClipboard())}>
                        <Icon key="btn-copy-url-icon" iconSize={18}>link</Icon>
                        {i18n.ListViewMenu.Buttons.UrlCopy()}
                    </a>
                    <a href="#" key="btn-export-fumen" datatest="btn-export-fumen" style={outlineButtonStyle}
                       className="waves-effect btn-flat"
                       onclick={runAndClose(() => (
                           useLeft ? actions.copyLeftSegmentToClipboard() : actions.copyAllPagesToClipboard()
                       ))}>
                        <Icon key="btn-export-fumen-icon" iconSize={18}>content_copy</Icon>
                        {i18n.ListViewMenu.Buttons.Fumen()}
                    </a>
                </div>
            </div>

            <div key="section-image" datatest="section-image" style={sectionStyle}>
                <div style={sectionHeadingStyle}>{i18n.ListViewMenu.Sections.Image()}</div>
                <div style={rowStyle}>
                    <a href="#" key="btn-export-image" datatest="btn-export-image" style={outlineButtonStyle}
                       className="waves-effect btn-flat"
                       onclick={runAndClose(() => (
                           useLeft ? actions.exportLeftSegmentAsImage() : actions.exportListViewAsImage()
                       ))}>
                        <Icon key="btn-export-image-icon" iconSize={18}>image</Icon>
                        {i18n.ListViewMenu.Buttons.Png()}
                    </a>
                    <a href="#" key="btn-export-gif" datatest="btn-export-gif" style={outlineButtonStyle}
                       className="waves-effect btn-flat"
                       onclick={runAndClose(() => (
                           useLeft ? actions.exportLeftSegmentAsGif() : actions.exportListViewAsGif()
                       ))}>
                        <Icon key="btn-export-gif-icon" iconSize={18}>gif</Icon>
                        {i18n.ListViewMenu.Buttons.Gif()}
                    </a>
                </div>
                <details key="image-display-options" datatest="image-display-options" open={imageOptionsOpen}
                         ontoggle={ontoggle(imageOptionsOpen, actions.setExportImageOptionsOpen)}>
                    <summary key="image-options-summary" datatest="image-options-summary"
                             style={optionsSummaryStyle}>
                        {i18n.ListViewMenu.Sections.ImageOptions()}
                    </summary>
                    <div key="image-options-body" style={optionsBodyStyle}>
                        <label key="label-export-page-numbers">
                            <input key="toggle-export-page-numbers" datatest="toggle-export-page-numbers"
                                   type="checkbox" checked={exportShowPageNumbers}
                                   onchange={onchangePageNumbers}/>
                            <span>{i18n.ListViewMenu.ImageOptions.PageNumbers()}</span>
                        </label>
                        <label key="label-export-comments">
                            <input key="toggle-export-comments" datatest="toggle-export-comments"
                                   type="checkbox" checked={exportShowComments}
                                   onchange={onchangeComments}/>
                            <span>{i18n.ListViewMenu.ImageOptions.Comments()}</span>
                        </label>
                        <div key="gif-frame-delay" style={gifDelayRowStyle}>
                            <span>{i18n.ListViewMenu.ImageOptions.GifFrameDelay()}</span>
                            <input key="input-gif-frame-delay" datatest="input-gif-frame-delay"
                                   type="number" value={gifFrameDelayMs} min={100} max={10000}
                                   step={100} onchange={onchangeGifFrameDelay}
                                   style={gifDelayInputStyle}/>
                            <span>{i18n.ListViewMenu.GifFrameDelayUnit()}</span>
                        </div>
                    </div>
                </details>
            </div>

            <details key="section-external" datatest="section-external" style={sectionStyle}
                     open={otherSitesOpen} ontoggle={ontoggle(otherSitesOpen, actions.setExportOtherSitesOpen)}>
                <summary key="other-sites-summary" datatest="other-sites-summary" style={summaryStyle}>
                    {i18n.ListViewMenu.Sections.OtherSites()}
                </summary>
                <div key="other-sites-list" style={siteListStyle}>
                    {siteRow('btn-export-url', i18n.ListViewMenu.Buttons.Url(), 'link', () => (
                        useLeft ? actions.exportLeftSegmentAsUrl() : actions.exportListViewAsUrl()
                    ))}
                    {siteRow('btn-export-fumen-zui', i18n.ListViewMenu.Buttons.FumenZui(), 'open_in_new',
                        () => actions.openListViewInFumenZui())}
                    {siteRow('btn-export-external-site', i18n.ListViewMenu.Buttons.ExternalSite(), 'open_in_new',
                        () => actions.openListViewInExternalSite())}
                    {siteRow('btn-export-fumen-for-mobile', i18n.ListViewMenu.Buttons.FumenForMobile(),
                        'open_in_new', () => actions.openListViewInFumenForMobile())}
                    <div key="section-tetgram" datatest="section-tetgram">
                        {siteRow('btn-export-tetgram-url', i18n.ListViewMenu.Buttons.TetgramUrl(), 'open_in_new',
                            () => actions.openListViewInTetgram(), tetgramRawButton)}
                        {treeEnabled ? (
                            <div key="hint-tetgram-url" datatest="hint-tetgram-url" style={warningHintStyle}>
                                {i18n.ListViewMenu.Buttons.TetgramUrlHint()}
                            </div>
                        ) : undefined}
                    </div>
                    <label key="shorten-urls" datatest="shorten-urls" style={checkboxRowStyle}>
                        <input key="switch-shorten-urls" datatest="switch-shorten-urls"
                               type="checkbox" checked={shortenUrls}
                               onchange={onchangeShortenUrls}/>
                        <span>{i18n.ListViewMenu.ShortUrl.Label()}</span>
                    </label>
                </div>
            </details>
        </div>
    );

    return (
        <div key="list-view-menu-modal-top">
            <div key="mdl-list-view-menu" datatest="mdl-list-view-menu" data-menu={menuTab}
                 className="modal" style={modalStyle} oncreate={oncreate}>
                <div key="modal-content" className="modal-content" style={contentStyle}>
                    <div key="menu-header" style={headerStyle}>
                        <h4 key="menu-label" datatest="list-view-menu-title" style={titleStyle}>{title}</h4>
                        {menuTab === 'export' && !treeEnabled ? (
                            <span key="scope-summary-all" datatest="scope-summary-all" style={pageCountStyle}>
                                {i18n.ListViewMenu.Scope.PageCount(pageCount)}
                            </span>
                        ) : undefined}
                        {menuTab === 'export' ? scopeControl : undefined}
                    </div>
                    {menuTab === 'import' ? importBody : exportBody}
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

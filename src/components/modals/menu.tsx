import { Component, ComponentWithText, px, style } from '../../lib/types';
import { h } from 'hyperapp';
import { resources } from '../../states';
import { CommentType, Platforms, Screens } from '../../lib/enums';
import { TreeViewMode } from '../../lib/fumen/tree_types';
import { i18n } from '../../locales/keys';
import { Icon } from '../atomics/icons';
import { getFieldLayout as getReaderFieldLayout } from '../../views/reader';
import { getFieldLayout as getEditorFieldLayout } from '../../views/editor/editor';
import { getNavigatorHeight } from '../../views/commons';

declare const M: any;

interface MenuProps {
    version: string;
    screen: Screens;
    comment: CommentType;
    treeEnabled: boolean;
    treeViewMode: TreeViewMode;
    display: {
        width: number;
        height: number;
    };
    platform: Platforms;
    editorSidePanelWidth: number;
    actions: {
        closeMenuModal: () => void;
        changeToReaderScreen: () => void;
        changeToDrawerScreen: (data: { refresh?: boolean }) => void;
        changeToListViewScreen: () => void;
        changeToTreeViewScreen: () => void;
        setTreeViewMode: (data: { mode: TreeViewMode }) => void;
        changeCommentMode: (data: { type: CommentType }) => void;
        removeUnsettledItems: () => void;
        loadNewFumen: () => void;
        firstPage: () => void;
        lastPage: () => void;
        openAppendModal: () => void;
        openClipboardModal: () => void;
        changeGhostVisible: (data: { visible: boolean }) => void;
        reopenCurrentPage: () => void;
        openFumenModal: () => void;
        openUserSettingsModal: () => void;
        openListViewMenuModal: (data: { initialTab: 'export' | 'import' }) => void;
    };
}

export const MenuModal: Component<MenuProps> = (
    {
        version, screen, comment, treeEnabled, treeViewMode,
        display, platform, editorSidePanelWidth, actions,
    },
) => {
    const oncreate = (element: HTMLDivElement) => {
        const instance = M.Modal.init(element, {
            onOpenEnd: () => {
                const element = document.getElementById('textarea-fumen');
                if (element !== null) {
                    element.focus();
                }
            },
            onCloseStart: () => {
                actions.closeMenuModal();
            },
        });

        instance.open();

        resources.modals.menu = instance;
    };

    const ondestroy = () => {
        const modal = resources.modals.menu;
        if (modal !== undefined) {
            modal.close();
        }
        resources.modals.menu = undefined;
    };

    const isTreeScreen = screen === Screens.ListView && treeEnabled && treeViewMode === TreeViewMode.Tree;
    const isListScreen = screen === Screens.ListView && !isTreeScreen;

    const modeButtons = [
        screen !== Screens.Reader ?
            <SettingButton key="btn-readonly" datatest="btn-readonly" href="#"
                           icons={[{ name: 'visibility', size: 31.25 }]}
                           onclick={() => {
                               actions.changeToReaderScreen();
                               actions.closeMenuModal();
                           }}>{i18n.Menu.Buttons.Readonly()}</SettingButton>
            : undefined,

        screen !== Screens.Editor ?
            <SettingButton key="btn-writable" datatest="btn-writable" href="#"
                           icons={[{ name: 'mode_edit', size: 31.25 }]}
                           onclick={() => {
                               actions.changeToDrawerScreen({ refresh: true });
                               actions.closeMenuModal();
                           }}>{i18n.Menu.Buttons.Writable()}</SettingButton>
            : undefined,

        !isListScreen ?
            <SettingButton key="btn-list-screen" datatest="btn-list-screen" href="#"
                           icons={[{ name: 'list', size: 31.25 }]}
                           onclick={() => {
                               actions.removeUnsettledItems();
                               if (treeEnabled && treeViewMode === TreeViewMode.Tree) {
                                   actions.setTreeViewMode({ mode: TreeViewMode.List });
                               }
                               actions.changeToListViewScreen();
                               actions.closeMenuModal();
                           }}>{i18n.Menu.Buttons.List()}</SettingButton>
            : undefined,

        !isTreeScreen ?
            <SettingButton key="btn-tree-screen" datatest="btn-tree-screen" href="#"
                           icons={[{ name: 'account_tree', size: 30 }]}
                           onclick={() => {
                               actions.removeUnsettledItems();
                               actions.changeToTreeViewScreen();
                               actions.closeMenuModal();
                           }}>{i18n.Menu.Buttons.Tree()}</SettingButton>
            : undefined,
    ];

    const pageButtons = [
        <SettingButton key="btn-new-fumen" datatest="btn-new-fumen" href="#"
                       icons={[{ name: 'insert_drive_file', size: 32.3 }]}
                       onclick={() => {
                           actions.removeUnsettledItems();
                           actions.loadNewFumen();
                           actions.changeToDrawerScreen({ refresh: true });
                           actions.closeMenuModal();
                       }}>
            {i18n.Menu.Buttons.New()}
        </SettingButton>,

        <SettingButton key="btn-list-menu-import" datatest="btn-list-menu-import" href="#"
                       icons={[{ name: 'file_download', size: 30 }]}
                       onclick={() => {
                           actions.removeUnsettledItems();
                           actions.openListViewMenuModal({ initialTab: 'import' });
                           actions.closeMenuModal();
                       }}>
            {i18n.ListViewMenu.Tabs.Import()}
        </SettingButton>,

        <SettingButton key="btn-list-menu-export" datatest="btn-list-menu-export" href="#"
                       icons={[{ name: 'file_upload', size: 30 }]}
                       onclick={() => {
                           actions.removeUnsettledItems();
                           actions.openListViewMenuModal({ initialTab: 'export' });
                           actions.closeMenuModal();
                       }}>
            {i18n.ListViewMenu.Tabs.Export()}
        </SettingButton>,
    ];

    const generalButtons = [
        screen === Screens.Reader || screen === Screens.Editor ?
            <SettingButton key="btn-save-playfield-to-image" href="#"
                           datatest="btn-save-playfield-to-image"
                           icons={[{ name: 'file_download', size: 30 }]}
                           onclick={() => {
                               function downloadURI(uri: string, name: string) {
                                   const link = document.createElement('a');
                                   if (link == null) {
                                       throw new Error('Unexpected: Failed to create an a-element');
                                   }

                                   link.download = name;
                                   link.href = uri;
                                   document.body.appendChild(link);
                                   link.click();
                                   document.body.removeChild(link);
                               }

                               function savePlayfieldToImage(
                                   config: { x: number, y: number, width: number, height: number },
                               ) {
                                   const dataURL = resources.konva.stage.toDataURL(config);
                                   if (dataURL != null) {
                                       downloadURI(dataURL, 'playfield_fumen.png');
                                   } else {
                                       M.toast({
                                           html: 'Failed to download image',
                                           classes: 'top-toast',
                                           displayLength: 5000,
                                       });
                                   }
                               }

                               switch (screen) {
                               case Screens.Reader: {
                                   const layout = getReaderFieldLayout({
                                       ...display,
                                       topLeftY: getNavigatorHeight(platform),
                                   });
                                   savePlayfieldToImage({
                                       ...layout.topLeft,
                                       ...layout.size,
                                   });
                                   break;
                               }
                               case Screens.Editor: {
                                   // キャプチャ座標はKonvaステージ相対のため、
                                   // パネル表示中もブロックサイズの一致だけ合わせればよい
                                   const layout = getEditorFieldLayout({
                                       ...display,
                                       topLeftY: getNavigatorHeight(platform),
                                       sidePanelWidth: editorSidePanelWidth,
                                   });
                                   savePlayfieldToImage({
                                       ...layout.topLeft,
                                       ...layout.size,
                                   });
                                   break;
                               }
                               }

                               actions.closeMenuModal();
                           }}>
                {i18n.Menu.Buttons.SavePlayfieldToImage()}
            </SettingButton>
            : undefined,

        <SettingButton key="btn-user-settings" datatest="btn-user-settings" href="#"
                       icons={[{ name: 'build', size: 30 }]}
                       onclick={() => {
                           actions.closeMenuModal();
                           actions.openUserSettingsModal();
                       }}>
            {i18n.Menu.Buttons.UserSettings()}
        </SettingButton>,

        <SettingButton key="btn-help" datatest="btn-help" href="./help.html"
                       icons={[{ name: 'help_outline', size: 31.25 }]}>
            {i18n.Menu.Buttons.Help()}
        </SettingButton>,
    ];

    const legacyButtons = [
        <SettingButton key="btn-copy-fumen" datatest="btn-copy-fumen" href="#"
                       icons={[{ name: 'content_copy', size: 29.3 }]}
                       onclick={() => {
                           actions.removeUnsettledItems();
                           actions.closeMenuModal();
                           actions.openClipboardModal();
                       }}>
            {i18n.Menu.Buttons.Clipboard()}
        </SettingButton>,

        <SettingButton key="btn-open-fumen" datatest="btn-open-fumen" href="#"
                       icons={[{ name: 'open_in_new', size: 32.3 }]}
                       onclick={() => {
                           actions.removeUnsettledItems();
                           actions.closeMenuModal();
                           actions.openFumenModal();
                       }}>
            {i18n.Menu.Buttons.Open()}
        </SettingButton>,

        <SettingButton key="btn-append-fumen" datatest="btn-append-fumen" href="#"
                       icons={[{ name: 'library_add', size: 29 }]}
                       onclick={() => {
                           actions.closeMenuModal();
                           actions.openAppendModal();
                       }}>
            {i18n.Menu.Buttons.Append()}
        </SettingButton>,

        <SettingButton key="btn-first-page" datatest="btn-first-page" href="#"
                       icons={[{ name: 'fast_rewind', size: 32.3 }]}
                       onclick={() => {
                           actions.firstPage();
                           actions.closeMenuModal();
                       }}>
            {i18n.Menu.Buttons.FirstPage()}
        </SettingButton>,

        <SettingButton key="btn-last-page" datatest="btn-last-page" href="#"
                       icons={[{ name: 'fast_forward', size: 32.3 }]}
                       onclick={() => {
                           actions.lastPage();
                           actions.closeMenuModal();
                       }}>
            {i18n.Menu.Buttons.LastPage()}
        </SettingButton>,

        comment !== CommentType.PageSlider ?
            <SettingButton key="btn-page-slider" href="#"
                           datatest="btn-page-slider"
                           icons={[{ name: 'looks_one', size: 30 }]}
                           onclick={() => {
                               actions.changeCommentMode({ type: CommentType.PageSlider });
                               actions.closeMenuModal();
                           }}>
                {i18n.Menu.Buttons.PageSlider()}
            </SettingButton>
            : undefined,

        screen === Screens.Reader && comment === CommentType.PageSlider ?
            <SettingButton key="btn-show-comment" href="#"
                           datatest="btn-show-comment"
                           icons={[{ name: 'text_fields', size: 32 }]}
                           onclick={() => {
                               actions.changeCommentMode({ type: CommentType.Writable });
                               actions.closeMenuModal();
                           }}>
                {i18n.Menu.Buttons.ShowComment()}
            </SettingButton>
            : undefined,

        screen === Screens.Editor && comment !== CommentType.Writable ?
            <SettingButton key="btn-comment-writable" href="#"
                           datatest="btn-comment-writable"
                           icons={[{ name: 'text_fields', size: 32 }]}
                           onclick={() => {
                               actions.changeCommentMode({ type: CommentType.Writable });
                               actions.closeMenuModal();
                           }}>
                {i18n.Menu.Buttons.WritableComment()}
            </SettingButton>
            : undefined,

        screen === Screens.Editor && comment !== CommentType.Readonly ?
            <SettingButton key="btn-comment-readonly" href="#"
                           datatest="btn-comment-readonly"
                           icons={[{ name: 'lock_outline', size: 30 }]}
                           onclick={() => {
                               actions.changeCommentMode({ type: CommentType.Readonly });
                               actions.closeMenuModal();
                           }}>
                {i18n.Menu.Buttons.ReadonlyComment()}
            </SettingButton>
            : undefined,
    ];

    return (
        <div key="menu-modal-top">
            <div key="mdl-open-fumen" datatest="mdl-open-fumen"
                 className="modal bottom-sheet" oncreate={oncreate} ondestroy={ondestroy}>
                <div key="modal-content" className="modal-content">

                    <h4 key="memu-title">
                        {i18n.Menu.Title()}&nbsp;
                        <span style={style({ color: '#999', fontSize: '50%' })}>[{i18n.Menu.Build(version)}]</span>
                    </h4>

                    <MenuSection key="menu-section-mode" datatest="menu-section-mode"
                                 label={i18n.Menu.Sections.Mode()}>
                        {modeButtons}
                    </MenuSection>

                    <MenuSection key="menu-section-page" datatest="menu-section-page"
                                 label={i18n.Menu.Sections.Page()}>
                        {pageButtons}
                    </MenuSection>

                    <MenuSection key="menu-section-general" datatest="menu-section-general"
                                 label={i18n.Menu.Sections.General()}>
                        {generalButtons}
                    </MenuSection>

                    <MenuSection key="menu-section-legacy" datatest="menu-section-legacy"
                                 label={i18n.Menu.Sections.Legacy()}>
                        {legacyButtons}
                    </MenuSection>

                    <div key="menu-bottom-space" style={style({ height: px(10), width: '100%' })}/>
                </div>
            </div>
        </div>
    );
};

interface MenuSectionProps {
    key: string;
    datatest: string;
    label: string;
}

const MenuSection: Component<MenuSectionProps & { children?: any }> = ({ key, datatest, label }, children) => (
    <div key={key} datatest={datatest} style={style({ margin: '0 0 6px 0' })}>
        <div key={`${key}-heading`} datatest={`${datatest}-heading`}
             style={style({
                 borderBottom: '1px solid #ddd',
                 color: '#777',
                 fontSize: px(11),
                 fontWeight: '700',
                 letterSpacing: '.05em',
                 lineHeight: px(18),
                 margin: '4px 0 2px',
             })}>
            {label}
        </div>
        <div key={`${key}-buttons`} style={style({
            margin: 0,
            padding: 0,
            display: 'flex',
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'start',
            alignItems: 'center',
        })}>
            {children}
        </div>
    </div>
);

interface SettingButtonProps {
    href?: string;
    onclick?: (event: MouseEvent) => void;
    icons: { name: string, size: number }[];
    key: string;
    datatest: string;
    textSize?: number;
    enable?: boolean;
}

export const SettingButton: ComponentWithText<SettingButtonProps> = (
    { href = '#', key, onclick, icons, datatest, textSize = 13, enable = true }, showName,
) => {
    const iconsElements = icons.map(icon => (
        <Icon key={`${key}-icon-${icon.name}`} classNames={enable ? [] : ['disabled']} iconSize={icon.size}>
            {icon.name}
        </Icon>
    ));
    return <a key={key} href={href} onclick={onclick !== undefined ? (event: MouseEvent) => {
        onclick(event);
        event.stopPropagation();
        event.preventDefault();
    } : undefined} style={style({
        minWidth: px(60),
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        flexShrink: 0,
    })}>
        <div key={`${key}-icon`} datatest={datatest}
             className={`z-depth-1 ${enable ? ' ' : 'disabled'}`}
             style={style({
                 width: px(50),
                 height: px(40),
                 lineHeight: px(40),
                 display: 'flex',
                 alignItems: 'center',
                 justifyContent: 'center',
                 color: enable ? '#333' : '#bdbdbd',
                 margin: px(5),
                 border: `solid 1px ${enable ? '#999' : '#bdbdbd'}`,
                 boxSizing: 'border-box',
                 cursor: 'pointer',
             })}
        >
            {...iconsElements}
        </div>

        <div key={`${key}-text`}
             style={style({
                 textAlign: 'center',
                 fontSize: px(textSize),
                 color: enable ? '#333' : '#bdbdbd',
                 whiteSpace: 'nowrap',
             })}>
            {showName}
        </div>
    </a>;
};

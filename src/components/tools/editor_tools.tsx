import { Component, px, style } from '../../lib/types';
import { h } from 'hyperapp';
import { ToolButton } from './tool_button';
import { ToolText } from './tool_text';
import { ColorPalette } from '../../lib/colors';
import { EditShortcuts } from '../../states';
import { displayShortcut } from '../../lib/shortcuts';

interface Props {
    height: number;
    width: number;
    currentPage: number;
    maxPage: number;
    palette: ColorPalette;
    undoCount: number;
    redoCount: number;
    inferenceCount: number;
    editShortcuts: EditShortcuts;
    shortcutLabelVisible: boolean;
    loop: boolean;
    actions: {
        openFumenModal: () => void;
        openMenuModal: () => void;
        executeNewFumen: () => void;
        changeToListViewScreen: () => void;
        changeToTreeViewScreen: () => void;
        startAnimation: () => void;
        pauseAnimation: () => void;
        backPage: (data: { loop: boolean }) => void;
        nextPage: (data: { loop: boolean }) => void;
        firstPage: () => void;
        lastPage: () => void;
        duplicatePageOnly: (data: { index: number }) => void;
        duplicatePageToGray: (data: { index: number }) => void;
        undo: () => void;
        redo: () => void;
    };
}

export const EditorTools: Component<Props> = (
    {
        currentPage,
        maxPage,
        height,
        width,
        palette,
        undoCount,
        redoCount,
        inferenceCount,
        editShortcuts,
        shortcutLabelVisible,
        loop,
        actions,
    },
) => {
    const compact = width < 420;
    const buttonHeight = height - (compact ? 8 : 10);
    const edgeWidth = compact ? 34 : 40;
    const navigationWidth = compact ? 28 : 35;
    const addWidth = compact ? 30 : 35;
    const pageWidth = compact ? 52 : 75;
    const iconSize = compact ? 27 : 33.75;
    const edgeIconSize = compact ? 27 : 30;
    const itemGap = compact ? 0 : 2;

    // ショートカットラベルを取得
    const getLabel = (key: keyof EditShortcuts): string | undefined => {
        if (compact || !shortcutLabelVisible) {
            return undefined;
        }
        const code = editShortcuts[key];
        return code ? displayShortcut(code) : undefined;
    };
    const navProperties = style({
        width: '100%',
        height: px(height),
        margin: 0,
        padding: 0,
    });

    const divProperties = style({
        width: '100%',
        height: px(height),
        margin: 0,
        padding: 0,
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
    });

    const colors = {
        baseClass: palette.baseClass,
        baseCode: palette.baseCode,
        darkCode: palette.darkCode,
    };
    const themeColor = `page-footer tools ${palette.baseClass}`;

    const pages = `${currentPage} / ${maxPage}`;

    return (
        <nav datatest="tools" className={themeColor} style={navProperties}>
            <div className="nav-wrapper" style={divProperties}>

                <ToolButton iconName="view_list" datatest="btn-list-view" stickyLeft={true} stickyOffset={3}
                            width={edgeWidth} height={buttonHeight}
                            key="btn-list-view" fontSize={edgeIconSize} colors={colors}
                            shortcutLabel={getLabel('ListView')}
                            actions={{
                                onclick: () => actions.changeToListViewScreen(),
                                onlongpress: () => actions.changeToTreeViewScreen(),
                            }}/>

                <ToolButton iconName="undo" datatest="btn-undo" width={navigationWidth} height={buttonHeight}
                            key="btn-undo" fontSize={iconSize} marginRight={itemGap} colors={colors}
                            shortcutLabel={getLabel('Undo')} shortcutLabelColor="#fff"
                            actions={{ onclick: () => actions.undo() }} enable={0 < undoCount || 0 < inferenceCount}/>

                <ToolButton iconName="redo" datatest="btn-redo" width={navigationWidth} height={buttonHeight}
                            key="btn-redo" fontSize={iconSize} marginRight={compact ? 1 : 4} colors={colors}
                            shortcutLabel={getLabel('Redo')} shortcutLabelColor="#fff"
                            actions={{ onclick: () => actions.redo() }} enable={0 < redoCount}/>

                <ToolButton iconName="navigate_before" datatest="btn-back-page"
                            width={navigationWidth} height={buttonHeight}
                            key="btn-back-page" fontSize={iconSize} marginRight={itemGap} colors={colors}
                            shortcutLabel={getLabel('PrevPage')}
                            actions={{
                                onclick: () => actions.backPage({ loop }),
                                onlongpress: () => actions.firstPage(),
                            }} enable={loop || 1 < currentPage}/>

                <ToolText datatest="text-pages" height={buttonHeight}
                          minWidth={pageWidth} fontSize={compact ? 15 : 18} marginRight={itemGap}>
                    {pages}
                </ToolText>

                <ToolButton iconName="navigate_next" datatest="btn-next-page"
                            width={navigationWidth} height={buttonHeight}
                            key="btn-next-page" fontSize={iconSize} marginRight={compact ? 1 : 4} colors={colors}
                            shortcutLabel={getLabel('NextPage')}
                            actions={{
                                onclick: () => actions.nextPage({ loop }),
                                onlongpress: () => actions.lastPage(),
                            }}
                            enable={loop || currentPage < maxPage}/>

                <ToolButton iconName="add" datatest="btn-insert-page" width={addWidth} height={buttonHeight}
                            key="btn-insert-page" fontSize={edgeIconSize} marginRight={itemGap} colors={colors}
                            shortcutLabel={getLabel('InsertPage')}
                            actions={{ onclick: () => actions.duplicatePageOnly({ index: currentPage }) }}/>

                <ToolButton iconName="menu" datatest="btn-open-menu" sticky={true} stickyOffset={3}
                            key="btn-open-menu" width={edgeWidth} height={buttonHeight}
                            fontSize={compact ? 28 : 32} colors={colors}
                            shortcutLabel={getLabel('Menu')}
                            actions={{
                                onclick: () => actions.openMenuModal(),
                                onlongpress: () => actions.executeNewFumen(),
                            }}/>
            </div>
        </nav>
    );
};

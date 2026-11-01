import { button, div, i, img, span } from '@hyperapp/html';
import { VNode } from 'hyperapp';
import { px, style } from '../lib/types';
import { Page } from '../lib/fumen/types';
import { SerializedTree, TreeLayout, TreeNodeId } from '../lib/fumen/tree_types';
import { calculateTreeLayout, isVirtualNode } from '../lib/fumen/tree_utils';
import { generateThumbnail, THUMBNAIL_HEIGHT, THUMBNAIL_WIDTH } from '../lib/thumbnail';
import { lazyThumbnail } from './lazy_thumbnail';
import { i18n } from '../locales/keys';

export const PAGE_STRIP_THUMBNAIL_WIDTH = 32;
export const PAGE_STRIP_TREE_THUMBNAIL_WIDTH = 24;
const ITEM_BORDER = 2;
const NUMBER_HEIGHT = 13;
const ITEM_GAP_X = 4;
const ITEM_GAP_Y = 6;
const PADDING = 6;
const CLOSE_BUTTON_SPACE = 36;
// Tree 表示は縦にもスクロールさせ、盤面を隠しすぎないよう 2.5 行までにする
const TREE_VISIBLE_ROWS = 2.5;
const Z_INDEX = 106;

const ACCENT = '#3B82F6';

export interface PageStripTreeInput {
    nodes: SerializedTree['nodes'];
    rootId: TreeNodeId | null;
}

interface Props {
    pages: Page[];
    currentIndex: number;
    guideLineColor: boolean;
    bottom: number;
    width: number;
    // Tree 管理が有効なときだけ渡す
    tree?: PageStripTreeInput;
    actions: {
        openPageWhenChange: (data: { index: number }) => void;
        closePageStrip: () => void;
    };
}

export const thumbnailHeightFor = (width: number) => Math.round(width * THUMBNAIL_HEIGHT / THUMBNAIL_WIDTH);

export const treeCellSize = () => {
    const thumbnailWidth = PAGE_STRIP_TREE_THUMBNAIL_WIDTH;
    return {
        width: thumbnailWidth + ITEM_BORDER * 2 + ITEM_GAP_X,
        height: thumbnailHeightFor(thumbnailWidth) + ITEM_BORDER * 2 + NUMBER_HEIGHT + ITEM_GAP_Y,
    };
};

let layoutCache: { nodes: SerializedTree['nodes']; rootId: TreeNodeId | null; layout: TreeLayout } | null = null;

// 開いている間はページ移動のたびに再描画されるので、ツリーが同じなら配置を使い回す
const getTreeLayout = (tree: PageStripTreeInput): TreeLayout => {
    if (layoutCache !== null && layoutCache.nodes === tree.nodes && layoutCache.rootId === tree.rootId) {
        return layoutCache.layout;
    }
    const layout = calculateTreeLayout({ nodes: tree.nodes, rootId: tree.rootId, version: 2 });
    layoutCache = { layout, nodes: tree.nodes, rootId: tree.rootId };
    return layout;
};

// ページ番号ごとの (深さ, レーン)。全ページが揃わない壊れたツリーは undefined で横一列に戻す
export const resolveTreeCells = (
    tree: PageStripTreeInput | undefined, pageCount: number,
): ({ x: number; y: number }[] | undefined) => {
    if (tree === undefined || tree.rootId === null || tree.nodes.length === 0) {
        return undefined;
    }
    const layout = getTreeLayout(tree);
    const cells: ({ x: number; y: number } | undefined)[] = Array(pageCount).fill(undefined);
    for (const node of tree.nodes) {
        if (isVirtualNode(node)) {
            continue;
        }
        const position = layout.positions.get(node.id);
        if (position === undefined || node.pageIndex < 0 || pageCount <= node.pageIndex) {
            return undefined;
        }
        cells[node.pageIndex] = position;
    }
    if (cells.some(cell => cell === undefined)) {
        return undefined;
    }
    return cells as { x: number; y: number }[];
};

// ボタン操作（Enter/Space）とフォーカス移動（Tab）は、グローバルの編集ショートカット
// （既定で Space=InsertPage、Tab=ListView）に渡さない。Escape やページ送りはそのまま届く
export const isStripOwnedKey = (event: KeyboardEvent) => (
    event.key === 'Enter' || event.key === ' ' || event.key === 'Tab'
);

const stopStripOwnedKey = (event: KeyboardEvent) => {
    if (isStripOwnedKey(event)) {
        event.stopPropagation();
    }
};

// 現在ページが枠の外にあるときだけ寄せる。center は開いた直後の位置合わせ
const keepCurrentVisible = (container: HTMLElement, center: boolean) => {
    const current = container.querySelector('[aria-current="page"]') as HTMLElement | null;
    if (current === null) {
        return;
    }
    const box = container.getBoundingClientRect();
    const item = current.getBoundingClientRect();
    if (center) {
        container.scrollLeft += (item.left + item.width / 2) - (box.left + box.width / 2);
        container.scrollTop += (item.top + item.height / 2) - (box.top + box.height / 2);
        return;
    }
    const visibleRight = box.right - CLOSE_BUTTON_SPACE;
    if (item.left < box.left) {
        container.scrollLeft -= box.left - item.left + PADDING;
    } else if (visibleRight < item.right) {
        container.scrollLeft += item.right - visibleRight + PADDING;
    }
    if (item.top < box.top) {
        container.scrollTop -= box.top - item.top;
    } else if (box.bottom < item.bottom) {
        container.scrollTop += item.bottom - box.bottom;
    }
};

const thumbnailItem = (
    { pages, index, isCurrent, guideLineColor, thumbnailWidth, position, onselect }: {
        pages: Page[];
        index: number;
        isCurrent: boolean;
        guideLineColor: boolean;
        thumbnailWidth: number;
        position?: { left: number; top: number };
        onselect: () => void;
    },
): VNode<any> => {
    const thumbnailHeight = thumbnailHeightFor(thumbnailWidth);
    return div({
        key: `page-thumbnail-${index}`,
        datatest: 'page-thumbnail-item',
        'data-page': `${index + 1}`,
        role: 'button',
        tabindex: 0,
        'aria-label': i18n.PageStrip.Item(index + 1),
        'aria-current': isCurrent ? 'page' : undefined,
        onclick: (event: MouseEvent) => {
            event.stopPropagation();
            onselect();
        },
        onkeydown: (event: KeyboardEvent) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                event.stopPropagation();
                onselect();
            }
        },
        style: style({
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            flexShrink: 0,
            cursor: 'pointer',
            ...(position !== undefined ? {
                position: 'absolute',
                left: px(position.left),
                top: px(position.top),
            } : {}),
        }),
    }, [
        img({
            key: 'thumbnail',
            alt: '',
            draggable: false,
            width: thumbnailWidth,
            height: thumbnailHeight,
            style: style({
                display: 'block',
                width: px(thumbnailWidth),
                height: px(thumbnailHeight),
                backgroundColor: '#000',
                border: `${ITEM_BORDER}px solid ${isCurrent ? ACCENT : 'transparent'}`,
                borderRadius: px(3),
                boxSizing: 'content-box',
            }),
            ...lazyThumbnail(() => generateThumbnail(pages, index, guideLineColor, false)),
        }),
        span({
            key: 'number',
            style: style({
                fontSize: px(11),
                lineHeight: px(NUMBER_HEIGHT),
                color: isCurrent ? ACCENT : '#bdbdbd',
            }),
        }, `${index + 1}`),
    ]);
};

export const PageThumbnailStrip = (
    { pages, currentIndex, guideLineColor, bottom, width, tree, actions }: Props,
): VNode<any>[] => {
    const cells = resolveTreeCells(tree, pages.length);
    const treeMode = cells !== undefined;
    const thumbnailWidth = treeMode ? PAGE_STRIP_TREE_THUMBNAIL_WIDTH : PAGE_STRIP_THUMBNAIL_WIDTH;
    const cellSize = treeCellSize();

    const items = pages.map((_, index) => thumbnailItem({
        pages,
        index,
        guideLineColor,
        thumbnailWidth,
        isCurrent: index === currentIndex,
        position: cells !== undefined
            ? { left: cells[index].x * cellSize.width, top: cells[index].y * cellSize.height }
            : undefined,
        onselect: () => {
            actions.openPageWhenChange({ index });
            actions.closePageStrip();
        },
    }));

    const content = cells !== undefined
        ? div({
            key: 'page-thumbnail-tree',
            datatest: 'page-thumbnail-tree',
            style: style({
                position: 'relative',
                width: px((Math.max(...cells.map(cell => cell.x)) + 1) * cellSize.width),
                height: px((Math.max(...cells.map(cell => cell.y)) + 1) * cellSize.height),
            }),
        }, items)
        : div({
            key: 'page-thumbnail-row',
            style: style({
                display: 'flex',
                flexDirection: 'row',
                gap: px(ITEM_GAP_X),
            }),
        }, items);

    return [
        // 盤面などストリップ外のタップは閉じるだけにして、描画操作へ渡さない
        div({
            key: 'page-thumbnail-strip-scrim',
            datatest: 'page-thumbnail-strip-scrim',
            onclick: () => actions.closePageStrip(),
            style: style({
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: px(bottom),
                zIndex: Z_INDEX - 1,
            }),
        }),
        div({
            key: 'page-thumbnail-strip',
            datatest: 'page-thumbnail-strip',
            role: 'region',
            'aria-label': i18n.PageStrip.Label(),
            onkeydown: stopStripOwnedKey,
            onkeyup: stopStripOwnedKey,
            style: style({
                position: 'fixed',
                left: 0,
                bottom: px(bottom),
                width: px(width),
                zIndex: Z_INDEX,
                backgroundColor: '#212121',
                borderTop: '1px solid #424242',
                boxSizing: 'border-box',
            }),
        }, [
            div({
                key: `page-thumbnail-scroll-${treeMode ? 'tree' : 'row'}`,
                'data-current-page': `${currentIndex + 1}`,
                oncreate: (element: HTMLElement) => keepCurrentVisible(element, true),
                // ページが変わったときだけ追従し、手動でずらしたスクロール位置は他の再描画で戻さない
                onupdate: (element: HTMLElement, old: { [key: string]: unknown }) => {
                    if (old['data-current-page'] !== `${currentIndex + 1}`) {
                        keepCurrentVisible(element, false);
                    }
                },
                style: style({
                    overflow: 'auto',
                    padding: `${PADDING}px ${CLOSE_BUTTON_SPACE}px ${PADDING}px ${PADDING + 2}px`,
                    maxHeight: treeMode ? px(Math.round(cellSize.height * TREE_VISIBLE_ROWS) + PADDING * 2) : undefined,
                    boxSizing: 'border-box',
                }),
            }, [content]),
            button({
                key: 'btn-page-thumbnail-strip-close',
                datatest: 'btn-page-thumbnail-strip-close',
                type: 'button',
                title: i18n.PageStrip.Close(),
                'aria-label': i18n.PageStrip.Close(),
                onclick: () => actions.closePageStrip(),
                style: style({
                    position: 'absolute',
                    top: px(4),
                    right: px(4),
                    width: px(28),
                    height: px(28),
                    padding: 0,
                    border: 'none',
                    borderRadius: px(6),
                    backgroundColor: '#424242',
                    color: '#e0e0e0',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }),
            }, [
                i({ className: 'material-icons', 'aria-hidden': 'true', style: style({ fontSize: px(18) }) }, 'close'),
            ]),
        ]),
    ];
};

import { Component, px, style } from '../../lib/types';
import { h } from 'hyperapp';
import { Page } from '../../lib/fumen/types';
import { ListViewItem } from './list_view_item';
import { generateThumbnail, getThumbnailHeight, THUMBNAIL_WIDTH } from '../../lib/thumbnail';
import { Pages, isTextCommentResult } from '../../lib/pages';

interface Props {
    pages: Page[];
    guideLineColor: boolean;
    draggingIndex: number | null;
    dropTargetIndex: number | null;  // Now represents slot index (0 to pages.length)
    containerWidth: number;
    containerHeight: number;
    scale: number;
    trimTopBlank: boolean;
    sortable: boolean;
    // 現在ページのハイライト（エディタのサイドパネル用。フル画面では undefined）
    currentIndex?: number;
    // 浮きボタンに最後の行が隠れないよう、下に空ける余白
    bottomPadding?: number;
    actions: {
        onDragStart: (pageIndex: number) => void;
        onDragOver: (pageIndex: number, e: DragEvent) => void;
        onDragLeave: () => void;
        onDrop: () => void;
        onDragEnd: () => void;
        onCommentChange: (pageIndex: number, comment: string) => void;
        onItemClick: (pageIndex: number) => void;
        onPageClick: (pageIndex: number) => void;
    };
}

const COLUMNS = 5;
const ITEM_MIN_WIDTH = 100;
const ITEM_MAX_WIDTH = 160;
const CONTAINER_PADDING = 10;

// カードが1枚以上入るときだけグリッド全体を中央に寄せる。入らないときに中央揃えにすると左側も切れる。
// 縦スクロールバーの幅は環境で違うので、描画後の clientWidth で判定する
export const alignGrid = (itemSize: number) => (container: HTMLElement) => {
    const grid = container.firstElementChild as HTMLElement | null;
    if (grid === null) {
        return;
    }
    const innerWidth = container.clientWidth - CONTAINER_PADDING * 2;
    grid.style.justifyContent = itemSize <= innerWidth ? 'center' : 'flex-start';
};

export const ListViewGrid: Component<Props> = ({
    pages,
    guideLineColor,
    draggingIndex,
    dropTargetIndex,
    containerWidth,
    containerHeight,
    scale,
    trimTopBlank,
    sortable,
    currentIndex,
    bottomPadding = CONTAINER_PADDING,
    actions,
}) => {
    const baseItemSize = Math.max(
        ITEM_MIN_WIDTH,
        Math.min(ITEM_MAX_WIDTH, Math.floor((containerWidth - 20) / COLUMNS)),
    );
    const itemSize = Math.round(baseItemSize * scale);
    const thumbnailCssWidth = Math.max(1, itemSize - 8);
    const devicePixelRatio = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
    const thumbnailRenderScale = (thumbnailCssWidth / THUMBNAIL_WIDTH) * devicePixelRatio;

    const containerStyle = style({
        width: '100%',
        height: px(containerHeight),
        overflowY: 'auto',
        overflowX: 'hidden',
        padding: `${px(CONTAINER_PADDING)} ${px(CONTAINER_PADDING)} ${px(bottomPadding)}`,
        boxSizing: 'border-box',
        backgroundColor: '#f5f5f5',
    });

    // justifyContent は alignGrid が実際の幅から決める
    const gridStyle = style({
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fill, ${px(itemSize)})`,
        alignItems: 'stretch',
        gap: '8px',
    });

    const pagesObj = new Pages(pages);

    const getCommentText = (pageIndex: number): string => {
        try {
            const result = pagesObj.getComment(pageIndex);
            if (isTextCommentResult(result)) {
                return result.text;
            }
            return result.quiz;
        } catch {
            return '';
        }
    };

    const isCommentChanged = (pageIndex: number): boolean => {
        const page = pages[pageIndex];
        // comment.text が定義されていれば、そのページ自体にコメントが記入されている
        // comment.ref が定義されていれば、以前のページのコメントを参照している（踏襲）
        return page.comment.text !== undefined;
    };

    const items = pages.map((page, index) => {
        const thumbnailSource = () => generateThumbnail(
            pages, index, guideLineColor, trimTopBlank, thumbnailRenderScale,
        );
        const thumbnailHeight = getThumbnailHeight(pages, index, trimTopBlank);
        const commentText = getCommentText(index);
        const commentChanged = isCommentChanged(index);

        // Slot N means "insert before page N", so page N shows left indicator
        const showLeftIndicator = dropTargetIndex === index && draggingIndex !== null;
        // Slot = pages.length means "insert after last page", so last page shows right indicator
        const showRightIndicator = dropTargetIndex === pages.length
            && index === pages.length - 1
            && draggingIndex !== null;

        return ListViewItem({
            sortable,
            actions,
            itemSize,
            thumbnailSource,
            thumbnailHeight,
            showLeftIndicator,
            showRightIndicator,
            pageIndex: index,
            comment: commentText,
            isCommentChanged: commentChanged,
            isDragging: draggingIndex === index,
            isCurrent: currentIndex === index,
        });
    });

    return (
        <div
            key="list-view-grid-container"
            style={containerStyle}
            oncreate={alignGrid(itemSize)}
            onupdate={alignGrid(itemSize)}
        >
            <div
                key="list-view-grid"
                style={gridStyle}
            >
                {items}
            </div>
        </div>
    );
};

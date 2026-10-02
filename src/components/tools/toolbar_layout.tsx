import { h, VNode } from 'hyperapp';
import { Component, px, style } from '../../lib/types';
import { measureTextWidth, MeasureText } from '../../lib/text_measure';

export type ToolbarTier = 'normal' | 'compact' | 'narrow';
export type ToolbarScreen = 'editor' | 'reader' | 'list';

export interface ToolbarMetrics {
    edgeWidth: number;
    navigationWidth: number;
    addWidth: number;
    pageMinWidth: number;
    gap: number;
    pageFontSize: number;
    iconSize: number;
    edgeIconSize: number;
    menuIconSize: number;
    playIconSize: number;
    buttonInset: number;
}

export const TOOLBAR_METRICS: { [tier in ToolbarTier]: ToolbarMetrics } = {
    normal: {
        edgeWidth: 40, navigationWidth: 35, addWidth: 35, pageMinWidth: 75, gap: 4,
        pageFontSize: 18, iconSize: 33.75, edgeIconSize: 30, menuIconSize: 32, playIconSize: 40, buttonInset: 10,
    },
    compact: {
        edgeWidth: 34, navigationWidth: 28, addWidth: 30, pageMinWidth: 52, gap: 2,
        pageFontSize: 15, iconSize: 27, edgeIconSize: 27, menuIconSize: 28, playIconSize: 34, buttonInset: 8,
    },
    narrow: {
        edgeWidth: 32, navigationWidth: 26, addWidth: 28, pageMinWidth: 48, gap: 1,
        pageFontSize: 15, iconSize: 24, edgeIconSize: 24, menuIconSize: 24, playIconSize: 30, buttonInset: 8,
    },
};

const TIERS: ToolbarTier[] = ['normal', 'compact', 'narrow'];

export const TOOLBAR_SIDE_PADDING = 3;
export const SEPARATOR_WIDTH = 1;
export const SEPARATOR_MARGIN = 4;
const SEPARATOR_TOTAL = SEPARATOR_WIDTH + SEPARATOR_MARGIN * 2;
const PAGE_FONT_WEIGHT = 400;
const MIN_PAGE_FONT_SIZE = 11;
const PAGE_FONT_STEP = .5;

// TreeViewToggle の固定寸法から求めた幅。部品の寸法を変えたら合わせて更新する
export const TREE_TOGGLE_WIDTH_OFF = 71;
export const TREE_TOGGLE_WIDTH_ON = 154;

export interface ToolbarFitInput {
    screen: ToolbarScreen;
    width: number;
    currentPage?: number;
    maxPage?: number;
    treeEnabled?: boolean;
    measure?: MeasureText;
}

export interface ToolbarFit {
    tier: ToolbarTier;
    metrics: ToolbarMetrics;
    requiredWidth: number;
    pageText: string;
    pageTitle?: string;
    pageFontSize: number;
    pageMinWidth: number;
    hideListTransfer: boolean;
}

const sumRow = (widths: number[], gap: number) => widths.length === 0
    ? 0
    : widths.reduce((sum, value) => sum + value, 0) + gap * (widths.length - 1);

// 右端の［区切り｜歯車｜⋮］。中は gap なし
const clusterWidth = (metrics: ToolbarMetrics) => SEPARATOR_TOTAL + metrics.edgeWidth * 2;

// ページ表示を除いた、各画面の左右と中央の幅の合計（左右の余白を含む）
const fixedWidth = (screen: ToolbarScreen, metrics: ToolbarMetrics, treeEnabled: boolean, hideTransfer: boolean) => {
    const { edgeWidth, navigationWidth, addWidth, gap } = metrics;
    const padding = TOOLBAR_SIDE_PADDING * 2;
    switch (screen) {
    case 'editor': {
        const left = edgeWidth + SEPARATOR_TOTAL;
        // undo・redo・前・ページ・次・＋ の6つ。ページの幅は呼び出し側で足す
        const center = navigationWidth * 4 + addWidth + gap * 5;
        return padding + left + center + clusterWidth(metrics);
    }
    case 'reader': {
        const left = sumRow([edgeWidth, edgeWidth], gap);
        // 前・ページ・次・編集 の4つ
        const center = navigationWidth * 2 + edgeWidth + gap * 3;
        return padding + left + center + clusterWidth(metrics);
    }
    case 'list': {
        const left = sumRow([edgeWidth, treeEnabled ? TREE_TOGGLE_WIDTH_ON : TREE_TOGGLE_WIDTH_OFF], gap);
        const tools = sumRow(hideTransfer ? [edgeWidth] : [edgeWidth, edgeWidth, edgeWidth], gap);
        return padding + left + tools + clusterWidth(metrics);
    }
    }
};

// 対応する最小の画面幅は320px。それより狭いと、最後の手段（List の取り込み・書き出しを隠す、
// ページ表示を11pxや今のページ番号だけにする）でも収まらない場合がある
export const chooseToolbarTier = (
    { screen, width, currentPage = 1, maxPage = 1, treeEnabled = false, measure = measureTextWidth }: ToolbarFitInput,
): ToolbarFit => {
    const fullText = `${currentPage} / ${maxPage}`;
    const result = (
        tier: ToolbarTier, requiredWidth: number, overrides: Partial<ToolbarFit> = {},
    ): ToolbarFit => ({
        tier,
        requiredWidth,
        metrics: TOOLBAR_METRICS[tier],
        pageText: fullText,
        pageFontSize: TOOLBAR_METRICS[tier].pageFontSize,
        pageMinWidth: TOOLBAR_METRICS[tier].pageMinWidth,
        hideListTransfer: false,
        ...overrides,
    });

    if (screen === 'list') {
        for (const tier of TIERS) {
            const requiredWidth = fixedWidth(screen, TOOLBAR_METRICS[tier], treeEnabled, false);
            if (requiredWidth <= width) {
                return result(tier, requiredWidth);
            }
        }
        // narrow でも入らないときだけ、取り込み・書き出しを ⋮ のシートに任せる
        return result('narrow', fixedWidth(screen, TOOLBAR_METRICS.narrow, treeEnabled, true), {
            hideListTransfer: true,
        });
    }

    for (const tier of TIERS) {
        const metrics = TOOLBAR_METRICS[tier];
        const pageWidth = Math.max(metrics.pageMinWidth, measure(fullText, metrics.pageFontSize, PAGE_FONT_WEIGHT));
        const requiredWidth = fixedWidth(screen, metrics, false, false) + pageWidth;
        if (requiredWidth <= width) {
            return result(tier, requiredWidth);
        }
    }

    // narrow でも入らないときは、ページ表示だけを縮める。全体の表記が入らなければ今のページ番号だけにする
    const metrics = TOOLBAR_METRICS.narrow;
    const fixed = fixedWidth(screen, metrics, false, false);
    const available = Math.max(0, width - fixed);
    const pageMinWidth = Math.min(metrics.pageMinWidth, available);
    const fitText = (text: string): number | undefined => {
        for (let size = metrics.pageFontSize; size >= MIN_PAGE_FONT_SIZE; size -= PAGE_FONT_STEP) {
            if (measure(text, size, PAGE_FONT_WEIGHT) <= available) {
                return size;
            }
        }
        return undefined;
    };

    const fullSize = fitText(fullText);
    const pageText = fullSize !== undefined ? fullText : `${currentPage}`;
    const pageFontSize = fullSize ?? fitText(pageText) ?? MIN_PAGE_FONT_SIZE;
    const pageWidth = Math.max(pageMinWidth, measure(pageText, pageFontSize, PAGE_FONT_WEIGHT));
    return result('narrow', fixed + pageWidth, {
        pageText,
        pageFontSize,
        pageMinWidth,
        pageTitle: fullSize !== undefined ? undefined : fullText,
    });
};

interface SeparatorProps {
    key: string;
    datatest?: string;
}

export const ToolbarSeparator: Component<SeparatorProps> = ({ key, datatest }) => (
    <span key={key} datatest={datatest} aria-hidden="true" style={style({
        display: 'block',
        flexShrink: 0,
        width: px(SEPARATOR_WIDTH),
        height: px(24),
        margin: `0 ${px(SEPARATOR_MARGIN)}`,
        backgroundColor: 'rgba(255,255,255,.55)',
    })}/>
);

interface RowProps {
    key: string;
    gap: number;
    justifyContent?: 'flex-start' | 'center' | 'flex-end';
}

// ボタンを縮めずに横に並べる入れ物
export const ToolbarRow: Component<RowProps> = ({ key, gap, justifyContent = 'flex-start' }, children) => (
    <div key={key} style={style({
        justifyContent,
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: px(gap),
        minWidth: 0,
    })}>
        {children}
    </div>
);

interface LayoutProps {
    datatest: string;
    className: string;
    height: number;
    fixedToBottom?: boolean;
    left: VNode<any>[];
    center: VNode<any>[];
    right: VNode<any>[];
    leftGap: number;
    centerGap: number;
}

// 左右の区画は中身の幅のまま、中央の区画が残りを使う。左右の幅が違うと中央の群は少しずれるが、重ならないことを優先する
export const ToolbarLayout: Component<LayoutProps> = (
    { datatest, className, height, fixedToBottom = false, left, center, right, leftGap, centerGap },
) => {
    const navProperties = style({
        width: '100%',
        height: px(height),
        margin: 0,
        padding: 0,
        ...(fixedToBottom ? { position: 'fixed', bottom: 0, left: 0, zIndex: 100 } : {}),
    });

    const gridProperties = style({
        width: '100%',
        height: px(height),
        margin: 0,
        padding: `0 ${px(TOOLBAR_SIDE_PADDING)}`,
        display: 'grid',
        gridTemplateColumns: 'max-content minmax(0, 1fr) max-content',
        alignItems: 'center',
    });

    return (
        <nav datatest={datatest} className={className} style={navProperties}>
            <div className="nav-wrapper" style={gridProperties}>
                <ToolbarRow key="toolbar-left" gap={leftGap}>{left}</ToolbarRow>
                <ToolbarRow key="toolbar-center" gap={centerGap} justifyContent="center">{center}</ToolbarRow>
                <ToolbarRow key="toolbar-right" gap={0} justifyContent="flex-end">{right}</ToolbarRow>
            </div>
        </nav>
    );
};

/**
 * @jest-environment jsdom
 */

import { default as i18next } from 'i18next';
import { resources as resourcesEn } from '../../locales/en/translation';
import { resources as resourcesJa } from '../../locales/ja/translation';
import { Page } from '../../lib/fumen/types';
import { TreeNode } from '../../lib/fumen/tree_types';
import { calculateTreeLayout } from '../../lib/fumen/tree_utils';
import {
    PAGE_STRIP_THUMBNAIL_WIDTH, PAGE_STRIP_TREE_THUMBNAIL_WIDTH, PageThumbnailStrip, resolveTreeCells, treeCellSize,
} from '../page_thumbnail_strip';

const findAll = (vnode: any, predicate: (node: any) => boolean, found: any[] = []): any[] => {
    if (vnode === null || typeof vnode !== 'object') {
        return found;
    }
    if (predicate(vnode)) {
        found.push(vnode);
    }
    (vnode.children ?? []).forEach((child: any) => findAll(child, predicate, found));
    return found;
};
const byDatatest = (roots: any[], datatest: string): any[] => roots.reduce(
    (found: any[], root: any) => findAll(root, node => node.attributes?.datatest === datatest, found),
    [],
);

const pages = (count: number) => Array.from({ length: count }, (_, index) => ({ index }) as unknown as Page);

// 0-1-2-3-4 の主系列と、1 から分かれる 5-6 の枝（DFS 前順 = ページ順）
const branchedNodes: TreeNode[] = [
    { id: 'root', parentId: null, pageIndex: -1, childrenIds: ['n0'] },
    { id: 'n0', parentId: 'root', pageIndex: 0, childrenIds: ['n1'] },
    { id: 'n1', parentId: 'n0', pageIndex: 1, childrenIds: ['n2', 'n5'] },
    { id: 'n2', parentId: 'n1', pageIndex: 2, childrenIds: ['n3'] },
    { id: 'n3', parentId: 'n2', pageIndex: 3, childrenIds: ['n4'] },
    { id: 'n4', parentId: 'n3', pageIndex: 4, childrenIds: [] },
    { id: 'n5', parentId: 'n1', pageIndex: 5, childrenIds: ['n6'] },
    { id: 'n6', parentId: 'n5', pageIndex: 6, childrenIds: [] },
];

const render = (overrides: Partial<Parameters<typeof PageThumbnailStrip>[0]> = {}) => {
    const openPageWhenChange = jest.fn();
    const closePageStrip = jest.fn();
    const roots = PageThumbnailStrip({
        pages: pages(7),
        currentIndex: 2,
        guideLineColor: true,
        bottom: 50,
        width: 375,
        actions: { openPageWhenChange, closePageStrip },
        ...overrides,
    });
    return { roots, openPageWhenChange, closePageStrip };
};

describe('PageThumbnailStrip', () => {
    beforeAll(async () => {
        await i18next.init({
            lng: 'en',
            resources: { en: { translation: resourcesEn }, ja: { translation: resourcesJa } },
        });
    });

    test('lists every page in page order and marks only the current one', () => {
        const { roots } = render();
        const items = byDatatest(roots, 'page-thumbnail-item');

        expect(items.map(item => item.attributes['data-page'])).toEqual(['1', '2', '3', '4', '5', '6', '7']);
        expect(items.map(item => item.attributes['aria-current'])).toEqual(
            [undefined, undefined, 'page', undefined, undefined, undefined, undefined],
        );
        expect(items[0].attributes['aria-label']).toBe('Page 1');
        expect(byDatatest(roots, 'page-thumbnail-tree')).toHaveLength(0);
        expect(items[0].children[0].attributes.width).toBe(PAGE_STRIP_THUMBNAIL_WIDTH);
    });

    test('tapping a thumbnail opens that page without closing the strip', () => {
        const { roots, openPageWhenChange, closePageStrip } = render();
        const items = byDatatest(roots, 'page-thumbnail-item');

        items[4].attributes.onclick({ stopPropagation: () => undefined });

        expect(openPageWhenChange).toHaveBeenCalledWith({ index: 4 });
        expect(closePageStrip).not.toHaveBeenCalled();
    });

    test('the scrim and close button close the strip', () => {
        const { roots, closePageStrip } = render();

        byDatatest(roots, 'page-thumbnail-strip-scrim')[0].attributes.onclick();
        byDatatest(roots, 'btn-page-thumbnail-strip-close')[0].attributes.onclick();

        expect(closePageStrip).toHaveBeenCalledTimes(2);
    });

    test('keeps Enter, Space, and Tab inside the strip but lets Escape and page keys through', () => {
        const { roots } = render();
        const onkeydown = byDatatest(roots, 'page-thumbnail-strip')[0].attributes.onkeydown;
        const press = (key: string) => {
            const event = { key, stopPropagation: jest.fn() };
            onkeydown(event);
            return event.stopPropagation.mock.calls.length > 0;
        };

        expect([' ', 'Enter', 'Tab'].map(press)).toEqual([true, true, true]);
        expect(['Escape', '1', 'ArrowRight'].map(press)).toEqual([false, false, false]);
    });

    test('follows the current page only when it changes', () => {
        const { roots } = render();
        const scroller = findAll(roots[1], node => node.attributes?.['data-current-page'] !== undefined)[0];
        const element = document.createElement('div');
        const current = document.createElement('div');
        current.setAttribute('aria-current', 'page');
        element.appendChild(current);
        const rect = (left: number, width: number) => ({
            left, width, right: left + width, top: 0, bottom: 80, height: 80,
        }) as DOMRect;
        element.getBoundingClientRect = () => rect(0, 300);
        current.getBoundingClientRect = () => rect(500, 40);
        Object.defineProperty(element, 'scrollLeft', { value: 0, writable: true });

        scroller.attributes.onupdate(element, { 'data-current-page': '3' });
        expect(element.scrollLeft).toBe(0);

        scroller.attributes.onupdate(element, { 'data-current-page': '2' });
        expect(element.scrollLeft).toBeGreaterThan(0);
    });

    test('places tree pages on a depth x lane grid without connector lines', () => {
        const { roots } = render({ tree: { nodes: branchedNodes, rootId: 'root' } });
        const items = byDatatest(roots, 'page-thumbnail-item');
        const cell = treeCellSize();
        const layout = calculateTreeLayout({ nodes: branchedNodes, rootId: 'root', version: 2 });

        expect(byDatatest(roots, 'page-thumbnail-tree')).toHaveLength(1);
        expect(items.map(item => item.attributes['data-page'])).toEqual(['1', '2', '3', '4', '5', '6', '7']);
        branchedNodes.filter(node => 0 <= node.pageIndex).forEach((node) => {
            const position = layout.positions.get(node.id)!;
            expect(items[node.pageIndex].attributes.style).toMatchObject({
                position: 'absolute',
                left: `${position.x * cell.width}px`,
                top: `${position.y * cell.height}px`,
            });
        });
        // 枝のページ（6, 7）は主系列の下のレーン
        expect(items[5].attributes.style.top).toBe(`${cell.height}px`);
        expect(items[5].attributes.style.left).toBe(`${2 * cell.width}px`);
        expect(items[0].children[0].attributes.width).toBe(PAGE_STRIP_TREE_THUMBNAIL_WIDTH);
        expect(findAll(roots[1], node => ['svg', 'path', 'line'].includes(node.nodeName))).toHaveLength(0);
    });

    test('falls back to one row when the tree does not cover every page', () => {
        expect(resolveTreeCells({ nodes: branchedNodes, rootId: 'root' }, 8)).toBeUndefined();
        expect(resolveTreeCells({ nodes: [], rootId: null }, 7)).toBeUndefined();
        expect(resolveTreeCells(undefined, 7)).toBeUndefined();

        const { roots } = render({ pages: pages(8), tree: { nodes: branchedNodes, rootId: 'root' } });
        expect(byDatatest(roots, 'page-thumbnail-tree')).toHaveLength(0);
        expect(byDatatest(roots, 'page-thumbnail-item')).toHaveLength(8);
    });
});

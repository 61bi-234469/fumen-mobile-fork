import { chooseToolbarTier, TOOLBAR_METRICS, ToolbarFitInput } from '../toolbar_layout';
import { estimateTextWidth } from '../../../lib/text_measure';
import { AppActionCluster } from '../app_action_cluster';

// 1文字 = 文字サイズの半分の幅とみなす測定関数
const halfEm = (text: string, size: number) => text.length * size * .5;

const fit = (input: Omit<ToolbarFitInput, 'measure'>, measure = halfEm) => chooseToolbarTier({ ...input, measure });

describe('chooseToolbarTier', () => {
    test.each([
        ['editor', 414, 'normal'],
        ['editor', 413, 'compact'],
        ['editor', 330, 'compact'],
        ['editor', 329, 'narrow'],
        ['editor', 320, 'narrow'],
        ['reader', 376, 'normal'],
        ['reader', 375, 'compact'],
        ['reader', 301, 'compact'],
        ['reader', 300, 'narrow'],
    ] as const)('%s at %ipx uses the %s tier', (screen, width, tier) => {
        const result = fit({ screen, width, currentPage: 1, maxPage: 5 });
        expect(result.tier).toBe(tier);
        expect(result.requiredWidth).toBeLessThanOrEqual(width);
        expect(result.pageText).toBe('1 / 5');
        expect(result.pageTitle).toBeUndefined();
    });

    test('required widths match the design table when the page text fits the minimum width', () => {
        expect(fit({ screen: 'editor', width: 1000 }).requiredWidth).toBe(6 + 49 + 270 + 89);
        expect(fit({ screen: 'editor', width: 413 }).requiredWidth).toBe(6 + 43 + 204 + 77);
        expect(fit({ screen: 'editor', width: 329 }).requiredWidth).toBe(6 + 41 + 185 + 73);
        expect(fit({ screen: 'reader', width: 1000 }).requiredWidth).toBe(6 + 84 + 197 + 89);
        expect(fit({ screen: 'reader', width: 375 }).requiredWidth).toBe(6 + 70 + 148 + 77);
        expect(fit({ screen: 'reader', width: 300 }).requiredWidth).toBe(6 + 65 + 135 + 73);
    });

    test('measures the actual page text and drops a tier when it exceeds the minimum width', () => {
        // '1826 / 1826' は 11文字。通常の 18px で 99px となり、最小幅 75px を 24px 超える
        const long = { screen: 'editor' as const, currentPage: 1826, maxPage: 1826 };
        expect(fit({ ...long, width: 414 }).tier).toBe('compact');
        expect(fit({ ...long, width: 414 + 24 }).tier).toBe('normal');
        expect(fit({ ...long, width: 414 + 24 }).requiredWidth).toBe(414 + 24);
    });

    test('shrinks the page font when even the narrow tier does not fit', () => {
        // narrow のページ以外は 305 - 48 = 257px。325px では 68px が残り、15px の 82.5px は入らない
        const result = fit({ screen: 'editor', width: 325, currentPage: 1826, maxPage: 1826 });
        expect(result.tier).toBe('narrow');
        expect(result.pageText).toBe('1826 / 1826');
        expect(result.pageTitle).toBeUndefined();
        expect(result.pageFontSize).toBe(12);
        expect(result.pageMinWidth).toBe(TOOLBAR_METRICS.narrow.pageMinWidth);
        expect(result.requiredWidth).toBeLessThanOrEqual(325);
    });

    test('shows only the current page when the shrunk text still does not fit', () => {
        // Reader の narrow のページ以外は 279 - 48 = 231px。260px では 29px しか残らない
        const result = fit({ screen: 'reader', width: 260, currentPage: 1826, maxPage: 1826 });
        expect(result.tier).toBe('narrow');
        expect(result.pageText).toBe('1826');
        expect(result.pageTitle).toBe('1826 / 1826');
        expect(result.pageFontSize).toBe(14.5);
        expect(result.pageMinWidth).toBe(29);
        expect(result.requiredWidth).toBeLessThanOrEqual(260);
    });

    test.each([
        [false, 338, 'normal'],
        [false, 337, 'compact'],
        [false, 296, 'compact'],
        [false, 295, 'narrow'],
        [true, 421, 'normal'],
        [true, 420, 'compact'],
        [true, 379, 'compact'],
        [true, 378, 'narrow'],
        [true, 364, 'narrow'],
    ] as const)('list with tree=%s at %ipx uses the %s tier and keeps import/export', (treeEnabled, width, tier) => {
        const result = fit({ treeEnabled, width, screen: 'list' });
        expect(result.tier).toBe(tier);
        expect(result.hideListTransfer).toBe(false);
        expect(result.requiredWidth).toBeLessThanOrEqual(width);
    });

    test('list hides import/export only when even the narrow tier does not fit', () => {
        const result = fit({ screen: 'list', width: 363, treeEnabled: true });
        expect(result.tier).toBe('narrow');
        expect(result.hideListTransfer).toBe(true);
        expect(result.requiredWidth).toBe(6 + 187 + 32 + 73);

        expect(fit({ screen: 'list', width: 320, treeEnabled: true }).requiredWidth).toBeLessThanOrEqual(320);
        expect(fit({ screen: 'list', width: 320, treeEnabled: false }).hideListTransfer).toBe(false);
    });
});

describe('chooseToolbarTier at the 320px minimum width', () => {
    // 1文字の幅を多めに見積もる estimateTextWidth でも、最長の想定（1826ページ・ツリーON）が収まる
    test.each([
        ['editor', false],
        ['reader', false],
        ['list', true],
    ] as const)('%s fits', (screen, treeEnabled) => {
        const result = chooseToolbarTier({
            screen, treeEnabled, width: 320, currentPage: 1826, maxPage: 1826, measure: estimateTextWidth,
        });
        // requiredWidth には、実際に表示するページ文字列をその文字サイズで測った幅が入る
        expect(result.requiredWidth).toBeLessThanOrEqual(320);
    });
});

describe('AppActionCluster', () => {
    const render = () => AppActionCluster({
        buttonHeight: 46,
        metrics: TOOLBAR_METRICS.normal,
        settingsDatatest: 'btn-editor-user-settings',
        colors: { baseClass: 'red', baseCode: '#f00', darkCode: '#800' },
        actions: { openUserSettingsModal: jest.fn(), openMenuModal: jest.fn() },
    }) as any;

    test('puts the separator, settings and more buttons in that order with more at the right end', () => {
        const children = render().children;
        expect(children.map((child: any) => child.attributes.datatest)).toEqual([
            'tools-cluster-separator', 'btn-editor-user-settings', 'btn-open-menu',
        ]);
        expect(children[0].attributes['aria-hidden']).toBe('true');
    });

    test('opens the menu with a plain click and has no long-press binding', () => {
        const more = render().children[2];
        expect(more.attributes.onpointerdown).toBeUndefined();
        expect(more.attributes.onclick).toBeInstanceOf(Function);
        expect(more.children[0].children).toEqual(['more_vert']);
    });
});

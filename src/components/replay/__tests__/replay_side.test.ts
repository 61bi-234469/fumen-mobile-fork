jest.mock('../replay_board', () => ({
    renderReplayBoard: jest.fn(() => 'board.png'),
}));

import { FieldConstants, Piece } from '../../../lib/enums';
import { IRField, ReplayVisualState } from '../../../lib/ttrm/types';
import { ReplayPoint, ReplayStats } from '../../../lib/ttrm/timeline';
import { replaySide, visibleReplayActiveCells } from '../replay_side';

const emptyField = (): IRField =>
    Array.from({ length: FieldConstants.PlayBlocks }).map(() => Piece.Empty);

const point = (): ReplayPoint => ({
    kind: 'initial',
    index: 0,
    frame: 0,
    field: emptyField(),
    hold: null,
    current: Piece.T,
    next: [Piece.I],
    clippedRowCount: 0,
});

const stats: ReplayStats = {
    placed: 0,
    totalLocks: 1,
    frame: 0,
    seconds: 0,
    pps: 0,
    apm: 0,
    app: 0,
    vs: 0,
    area: 0,
    b2b: 0,
    ren: 0,
    attack: 0,
    garbageCleared: 0,
    gauge: 0,
    tanked: 0,
};

const visual = (active: ReplayVisualState['active']): ReplayVisualState => ({
    active,
    frame: 12,
    field: emptyField(),
    sourceHeight: 0,
    clippedRowCount: 0,
    hold: Piece.I,
    current: Piece.O,
    next: [Piece.J, Piece.S],
});

const findAllByDatatest = (node: any, value: string): any[] => {
    if (node === undefined || node === null || typeof node !== 'object') {
        return [];
    }
    if (Array.isArray(node)) {
        return node.reduce((found, child) => found.concat(findAllByDatatest(child, value)), []);
    }
    const self = node.attributes?.datatest === value ? [node] : [];
    return self.concat(findAllByDatatest(node.children, value));
};

const textContents = (node: any): string[] => {
    if (typeof node === 'string') return [node];
    if (node === undefined || node === null || typeof node !== 'object') return [];
    if (Array.isArray(node)) return node.reduce((texts, child) => texts.concat(textContents(child)), [] as string[]);
    return textContents(node.children);
};

const render = (value: ReplayVisualState) => replaySide({
    stats,
    variant: 'self',
    size: 'full',
    point: point(),
    visual: value,
    blockSize: 10,
    guideLineColor: true,
    label: 'self',
    counterText: 'start',
    queueWidth: 40,
});

describe('replaySide realtime visual', () => {
    test('draws four active cells over the settled board and exposes stable selectors', () => {
        const active = {
            frame: 12,
            piece: Piece.T,
            rotation: 0,
            x: 4,
            y: 20,
            cells: [[3, 20], [4, 20], [5, 20], [4, 21]] as [number, number][],
        };
        const vnode = render(visual(active));
        const overlay = findAllByDatatest(vnode, 'replay-active-self')[0];
        const board = findAllByDatatest(vnode, 'replay-board-self')[0];

        expect(overlay.attributes['data-active-piece']).toEqual('T');
        expect(overlay.attributes['data-active-cells']).toEqual(JSON.stringify(active.cells));
        const cells = findAllByDatatest(vnode, 'replay-active-self-cell');
        expect(cells).toHaveLength(4);
        expect(cells[0].attributes.style.left).toEqual('30px');
        expect(cells[0].attributes.style.top).toEqual('20px');
        expect(board.attributes.src).toEqual('board.png');
        expect(board.attributes['data-visual-frame']).toEqual('12');
        expect(findAllByDatatest(vnode, 'replay-hold-0')[0].attributes['data-piece']).toEqual('I');
        // 操作中のOはactiveとして描くため、NEXTの先頭へ重複表示しない。
        expect(findAllByDatatest(vnode, 'replay-next-0')[0].attributes['data-piece']).toEqual('J');
    });

    test('keeps the legacy current-first queue when no active pose exists', () => {
        const vnode = render(visual(undefined));

        expect(findAllByDatatest(vnode, 'replay-active-self')).toHaveLength(0);
        expect(findAllByDatatest(vnode, 'replay-next-0')[0].attributes['data-piece']).toEqual('O');
    });

    test('labels the replay chain counter as Combo', () => {
        expect(textContents(render(visual(undefined)))).toContain('Combo 0');
    });

    test('shows replay rates with two decimals and keeps VS above AREA at the field edge', () => {
        const vnode = replaySide({
            ...{
                variant: 'self' as const,
                size: 'full' as const,
                point: point(),
                visual: visual(undefined),
                blockSize: 10,
                guideLineColor: true,
                label: 'self',
                counterText: 'start',
                queueWidth: 40,
            },
            stats: { ...stats, pps: 1.2, apm: 72.345, app: 0.6, vs: 90.5, area: 432.1 },
        });

        expect(textContents(findAllByDatatest(vnode, 'replay-side-stats')[0]))
            .toEqual(['1.20 pps', '72.34 apm', '0.60 app']);
        expect(textContents(findAllByDatatest(vnode, 'replay-field-stats')[0]))
            .toEqual(['90.50 vs', '432.10 area']);
        expect(findAllByDatatest(vnode, 'replay-side-stats')[0].attributes.style)
            .toMatchObject({ bottom: '0px', position: 'absolute' });
        expect(findAllByDatatest(vnode, 'replay-field-stats')[0].attributes.style)
            .toMatchObject({ bottom: '0px', position: 'absolute' });
    });

    test('keeps both stat groups in the compact layout', () => {
        const vnode = replaySide({
            stats,
            variant: 'opponent',
            size: 'compact',
            point: point(),
            visual: visual(undefined),
            blockSize: 10,
            guideLineColor: true,
            label: 'opponent',
            counterText: 'start',
            queueWidth: 40,
        });

        expect(findAllByDatatest(vnode, 'replay-opponent-side-stats')).toHaveLength(1);
        expect(findAllByDatatest(vnode, 'replay-opponent-field-stats')).toHaveLength(1);
    });

    test('does not draw cells outside the 10x23 replay board', () => {
        const active = {
            frame: 0,
            piece: Piece.I,
            rotation: 1,
            x: 0,
            y: 22,
            cells: [[0, 21], [0, 22], [0, 23], [-1, 22]] as [number, number][],
        };

        expect(visibleReplayActiveCells(active)).toEqual([[0, 21], [0, 22]]);
    });
});

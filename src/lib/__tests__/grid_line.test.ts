import { intermediateCellIndices } from '../grid_line';

describe('intermediateCellIndices', () => {
    test('returns no cells for the same index', () => {
        expect(intermediateCellIndices(5, 5, 10)).toEqual([]);
    });

    test('returns no cells for adjacent indices', () => {
        expect(intermediateCellIndices(5, 6, 10)).toEqual([]);
        expect(intermediateCellIndices(5, 15, 10)).toEqual([]);
        expect(intermediateCellIndices(5, 16, 10)).toEqual([]);
    });

    test('fills a horizontal gap, endpoints excluded', () => {
        expect(intermediateCellIndices(0, 4, 10)).toEqual([1, 2, 3]);
    });

    test('fills a horizontal gap in reverse order', () => {
        expect(intermediateCellIndices(4, 0, 10)).toEqual([3, 2, 1]);
    });

    test('fills a vertical gap', () => {
        expect(intermediateCellIndices(5, 35, 10)).toEqual([15, 25]);
    });

    test('fills a diagonal gap', () => {
        expect(intermediateCellIndices(0, 22, 10)).toEqual([11]);
    });

    test('fills a shallow slope with one cell per column', () => {
        // (0,0) -> (4,2): one cell per step, no gaps wider than diagonal adjacency
        const cells = intermediateCellIndices(0, 24, 10);
        expect(cells).toHaveLength(3);
        const xs = cells.map(c => c % 10);
        expect(xs).toEqual([1, 2, 3]);
    });
});

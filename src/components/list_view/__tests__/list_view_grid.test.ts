import { alignGrid } from '../list_view_grid';

const container = (clientWidth: number) => {
    const grid = { style: { justifyContent: '' } };
    return { grid, element: { clientWidth, firstElementChild: grid } as unknown as HTMLElement };
};

describe('alignGrid', () => {
    test('centers the grid when a card exactly fits the inner width', () => {
        // 左右の余白 10px ずつを除いた幅が 300px
        const { grid, element } = container(320);
        alignGrid(300)(element);
        expect(grid.style.justifyContent).toBe('center');
    });

    test('keeps the grid left aligned when a card is 1px wider than the inner width', () => {
        const { grid, element } = container(320);
        alignGrid(301)(element);
        expect(grid.style.justifyContent).toBe('flex-start');
    });

    test('re-evaluates after the container width changes', () => {
        const { grid, element } = container(320);
        alignGrid(301)(element);
        (element as { clientWidth: number }).clientWidth = 321;
        alignGrid(301)(element);
        expect(grid.style.justifyContent).toBe('center');
    });
});

// Bresenham line between two cells on a fixed-width grid.
// Returns the intermediate cell indices only (both endpoints excluded),
// ordered from `fromIndex` toward `toIndex`.
export const intermediateCellIndices = (fromIndex: number, toIndex: number, width: number): number[] => {
    let x0 = fromIndex % width;
    let y0 = Math.floor(fromIndex / width);
    const x1 = toIndex % width;
    const y1 = Math.floor(toIndex / width);

    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;

    const cells: number[] = [];
    while (x0 !== x1 || y0 !== y1) {
        const e2 = 2 * err;
        if (e2 >= dy) {
            err += dy;
            x0 += sx;
        }
        if (e2 <= dx) {
            err += dx;
            y0 += sy;
        }
        if (x0 === x1 && y0 === y1) {
            break;
        }
        cells.push(x0 + y0 * width);
    }
    return cells;
};

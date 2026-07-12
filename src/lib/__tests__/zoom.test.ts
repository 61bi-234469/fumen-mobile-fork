import { snapZoomPercent, ZOOM_SNAP_THRESHOLD } from '../zoom';

describe('snapZoomPercent', () => {
    test('snaps values within threshold above 100 to 100', () => {
        expect(snapZoomPercent(107)).toBe(100);
    });

    test('snaps values within threshold below 100 to 100', () => {
        expect(snapZoomPercent(93)).toBe(100);
    });

    test('does not snap values just outside the threshold', () => {
        expect(snapZoomPercent(92)).toBe(92);
        expect(snapZoomPercent(108)).toBe(108);
    });

    test('leaves 100 unchanged', () => {
        expect(snapZoomPercent(100)).toBe(100);
    });

    test('snaps at the exact threshold boundary', () => {
        expect(snapZoomPercent(100 + ZOOM_SNAP_THRESHOLD)).toBe(100);
        expect(snapZoomPercent(100 - ZOOM_SNAP_THRESHOLD)).toBe(100);
    });

    test('rounds non-snapped fractional values', () => {
        expect(snapZoomPercent(150.4)).toBe(150);
        expect(snapZoomPercent(150.6)).toBe(151);
    });
});

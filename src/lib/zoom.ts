export const ZOOM_SNAP_THRESHOLD = 7;

// Snaps the slider's percent value to 100 near the 100% mark.
export const snapZoomPercent = (percent: number): number => {
    if (Math.abs(percent - 100) <= ZOOM_SNAP_THRESHOLD) {
        return 100;
    }
    return Math.round(percent);
};

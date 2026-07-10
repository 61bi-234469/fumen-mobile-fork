/**
 * Edge auto-scroll for tree-view drags.
 *
 * A single requestAnimationFrame loop scrolls the tree scroll container while the
 * pointer stays near its edges. The loop is a module singleton: starting a new
 * session replaces the previous one, and stopping cancels the frame.
 */

const EDGE_ZONE = 48;
const MAX_SPEED = 14; // px per frame at the very edge

interface AutoScrollSession {
    container: HTMLElement;
    lastClientX: number;
    lastClientY: number;
    /** Re-evaluate the drop target after the container scrolled under the pointer. */
    onScrolled: (clientX: number, clientY: number) => void;
}

let session: AutoScrollSession | null = null;
let rafId: number | null = null;

const axisSpeed = (position: number, min: number, max: number): number => {
    if (position < min + EDGE_ZONE) {
        return -MAX_SPEED * Math.min(1, (min + EDGE_ZONE - position) / EDGE_ZONE);
    }
    if (position > max - EDGE_ZONE) {
        return MAX_SPEED * Math.min(1, (position - (max - EDGE_ZONE)) / EDGE_ZONE);
    }
    return 0;
};

const tick = () => {
    rafId = null;
    if (!session) return;

    const { container, lastClientX, lastClientY, onScrolled } = session;
    const rect = container.getBoundingClientRect();
    const dx = axisSpeed(lastClientX, rect.left, rect.right);
    const dy = axisSpeed(lastClientY, rect.top, rect.bottom);

    if (dx !== 0 || dy !== 0) {
        const prevLeft = container.scrollLeft;
        const prevTop = container.scrollTop;
        container.scrollLeft = prevLeft + dx;
        container.scrollTop = prevTop + dy;
        if (container.scrollLeft !== prevLeft || container.scrollTop !== prevTop) {
            onScrolled(lastClientX, lastClientY);
        }
    }

    rafId = requestAnimationFrame(tick);
};

export const startTreeAutoScroll = (
    container: HTMLElement,
    onScrolled: (clientX: number, clientY: number) => void,
): void => {
    session = {
        container,
        onScrolled,
        lastClientX: Number.NaN,
        lastClientY: Number.NaN,
    };
    if (rafId === null) {
        rafId = requestAnimationFrame(tick);
    }
};

export const updateTreeAutoScrollPointer = (clientX: number, clientY: number): void => {
    if (!session) return;
    session.lastClientX = clientX;
    session.lastClientY = clientY;
};

export const stopTreeAutoScroll = (): void => {
    session = null;
    if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
    }
};

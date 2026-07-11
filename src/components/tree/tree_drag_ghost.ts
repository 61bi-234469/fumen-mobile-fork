/**
 * Imperative position updates for the tree-drag ghost thumbnail.
 *
 * The ghost element itself is rendered by fumen_graph.tsx (only while dragging).
 * High-frequency pointer coordinates never enter the Hyperapp state; instead the
 * SVG transform is patched directly inside a requestAnimationFrame callback.
 */

const GHOST_SELECTOR = '[datatest="tree-drag-ghost"]';
const GHOST_POINTER_OFFSET = 14;

let rafId: number | null = null;
let pendingPosition: { x: number; y: number } | null = null;

const applyPendingPosition = () => {
    rafId = null;
    if (!pendingPosition) return;
    const element = document.querySelector(GHOST_SELECTOR);
    if (!element) return;
    const { x, y } = pendingPosition;
    element.setAttribute(
        'transform',
        `translate(${x + GHOST_POINTER_OFFSET}, ${y + GHOST_POINTER_OFFSET})`,
    );
    element.setAttribute('visibility', 'visible');
};

/** Move the ghost to the given tree (pre-scale SVG) coordinates. */
export const updateTreeDragGhost = (svgX: number, svgY: number): void => {
    pendingPosition = { x: svgX, y: svgY };
    if (rafId === null) {
        rafId = requestAnimationFrame(applyPendingPosition);
    }
};

/** Cancel any pending frame and forget the last position (drop/cancel/unmount). */
export const resetTreeDragGhost = (): void => {
    if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
    }
    pendingPosition = null;
};

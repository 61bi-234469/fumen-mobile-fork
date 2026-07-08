let treeTouchStartPosition: { x: number; y: number } | null = null;

export const setTreeTouchStartPosition = (pos: { x: number; y: number } | null): void => {
    treeTouchStartPosition = pos;
};

export const getTreeTouchStartPosition = (): { x: number; y: number } | null =>
    treeTouchStartPosition;

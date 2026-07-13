/** @jest-environment jsdom */

jest.mock('../../actions', () => ({ actions: {} }));

import { rectSelectActions } from '../rect_select';

const state = (): any => ({
    rectSelect: { phase: 'none', dragAnchor: null, rect: null, floating: null, moveAnchor: null },
    parts: { items: [], selectedId: null },
    fumen: { pages: [] },
});

describe('rectangle selection actions', () => {
    test('selects a normalized rectangle without changing pages', () => {
        const initial = state();
        const started = {
            ...initial,
            ...rectSelectActions.rectSelectTouchStart({ index: 42 })(initial),
        };
        const moved = {
            ...started,
            ...rectSelectActions.rectSelectTouchMove({ index: 11 })(started),
        };
        const ended = {
            ...moved,
            ...rectSelectActions.rectSelectTouchEnd()(moved),
        };

        expect(ended.rectSelect.phase).toBe('selected');
        expect(ended.rectSelect.rect).toEqual({ minX: 1, minY: 1, maxX: 2, maxY: 4 });
        expect(ended.fumen.pages).toBe(initial.fumen.pages);
    });

    test('dragging outside a floating selection commits it and immediately starts a new selection', () => {
        const initial = state();
        const floatingState = {
            ...initial,
            mode: { blackTransparentPaste: false },
            rectSelect: {
                phase: 'floating' as const,
                dragAnchor: null,
                rect: { minX: 0, minY: 0, maxX: 1, maxY: 1 },
                floating: {
                    width: 2, height: 2, cells: [0, 0, 0, 0],
                    x: 0, y: 0, sourceRect: { minX: 0, minY: 0, maxX: 1, maxY: 1 },
                },
                moveAnchor: null,
            },
        };

        const next = rectSelectActions.rectSelectTouchStart({ index: 55 })(floatingState)!;

        expect(next.rectSelect!.phase).toBe('selecting');
        expect(next.rectSelect!.floating).toBeNull();
        expect(next.rectSelect!.rect).toEqual({ minX: 5, minY: 5, maxX: 5, maxY: 5 });
    });

    test('cancels a preview without changing pages', () => {
        const initial = state();
        const selecting = {
            ...initial,
            rectSelect: {
                ...initial.rectSelect,
                phase: 'selected' as const,
                rect: { minX: 0, minY: 0, maxX: 1, maxY: 1 },
            },
        };
        const next = rectSelectActions.cancelRectSelect()(selecting)!;
        expect(next.rectSelect!.phase).toBe('none');
        expect(next.fumen).toBeUndefined();
    });
});

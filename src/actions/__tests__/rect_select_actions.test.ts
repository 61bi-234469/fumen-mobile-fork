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

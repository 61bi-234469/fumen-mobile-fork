import { State } from '../../states';
import { Piece } from '../../lib/enums';

jest.mock('../../actions', () => ({ actions: {} }));

// tslint:disable-next-line:no-var-requires
const { rectSelectActions } = require('../rect_select');

describe('rectSelectActions', () => {
    test('does not add highlight darkening to transformed select previews', () => {
        const state = {
            rectSelect: {
                status: 'floating',
                rect: { minX: 1, minY: 1, maxX: 2, maxY: 2 },
                anchorIndex: null,
                floating: {
                    cells: [Piece.T, Piece.L, Piece.Empty, Piece.I],
                    width: 2,
                    height: 2,
                    sourceRect: { minX: 1, minY: 1, maxX: 2, maxY: 2 },
                    targetX: 1,
                    targetY: 1,
                    pointerOffsetX: 0,
                    pointerOffsetY: 0,
                },
            },
        } as unknown as State;

        const rotated = rectSelectActions.rotateSelectedPartLeft()(state) as any;
        const mirrored = rectSelectActions.mirrorSelectedPart()(state) as any;

        expect(rotated.rectSelect.floating.previewHighlight).toBeUndefined();
        expect(mirrored.rectSelect.floating.previewHighlight).toBeUndefined();
    });

    test('starts a new selection on an outside click after a rectangle is selected', () => {
        const state = {
            rectSelect: {
                status: 'selected',
                rect: { minX: 1, minY: 1, maxX: 2, maxY: 2 },
                anchorIndex: null,
                floating: null,
            },
            parts: { items: [], selectedId: null, blackTransparent: true },
        } as unknown as State;

        const next = rectSelectActions.startRectSelection({ index: 5 + 5 * 10 })(state) as any;

        expect(next.rectSelect).toEqual({
            status: 'selecting',
            rect: { minX: 5, minY: 5, maxX: 5, maxY: 5 },
            anchorIndex: 55,
            floating: null,
            reselectOnNextTouch: false,
        });
    });
});

import { State } from '../../states';

jest.mock('../../actions', () => ({ actions: {} }));

// tslint:disable-next-line:no-var-requires
const { rectSelectActions } = require('../rect_select');

describe('rectSelectActions', () => {
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

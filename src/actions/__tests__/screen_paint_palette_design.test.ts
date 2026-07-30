import { modeActions } from '../screen';
import type { State } from '../../states';

jest.mock('../../actions', () => ({
    actions: {},
    main: {},
}));

jest.mock('../../states', () => ({
    resources: { konva: { stage: { isReady: false } } },
}));

const createState = (paintPaletteMinoDesign: boolean): State => ({
    mode: { paintPaletteMinoDesign } as State['mode'],
    editorUi: { primaryTool: 'paint' } as State['editorUi'],
} as State);

describe('changePaintPaletteMinoDesign', () => {
    test('enables the mino design', () => {
        const state = createState(false);
        const next = modeActions.changePaintPaletteMinoDesign({ enable: true })(state) as Partial<State>;

        expect(next.mode!.paintPaletteMinoDesign).toBe(true);
        expect(next.editorUi).toBeUndefined();
        expect(state.mode.paintPaletteMinoDesign).toBe(false);
    });

    test('disables the mino design', () => {
        const next = modeActions.changePaintPaletteMinoDesign({ enable: false })(
            createState(true)) as Partial<State>;

        expect(next.mode!.paintPaletteMinoDesign).toBe(false);
    });

    test('returns no state update for an unchanged setting', () => {
        expect(modeActions.changePaintPaletteMinoDesign({ enable: true })(createState(true))).toBeUndefined();
        expect(modeActions.changePaintPaletteMinoDesign({ enable: false })(createState(false))).toBeUndefined();
    });
});

import { modeActions } from '../screen';
import type { State } from '../../states';

jest.mock('../../actions', () => ({
    actions: {},
    main: {},
}));

jest.mock('../../states', () => ({
    resources: { konva: { stage: { isReady: false } } },
}));

const apply = (state: State, action: (state: Readonly<State>) => any): State => {
    const next = action(state);
    return next === undefined ? state : { ...state, ...next } as State;
};

const createState = (flagsHidden: boolean, inspector: State['editorUi']['inspector']): State => ({
    mode: { flagsHidden } as State['mode'],
    editorUi: { inspector } as State['editorUi'],
} as State);

describe('changeFlagsHidden', () => {
    test('hides FLAGS and closes an open FLAGS inspector', () => {
        const next = apply(createState(false, 'flags'), modeActions.changeFlagsHidden({ hidden: true }));

        expect(next.mode.flagsHidden).toBe(true);
        expect(next.editorUi.inspector).toBe('none');
    });

    test('does not open an inspector when FLAGS are shown again', () => {
        const next = apply(createState(true, 'none'), modeActions.changeFlagsHidden({ hidden: false }));

        expect(next.mode.flagsHidden).toBe(false);
        expect(next.editorUi.inspector).toBe('none');
    });

    test('returns no state update for an unchanged setting without an open FLAGS inspector', () => {
        const state = createState(true, 'utils');

        expect(modeActions.changeFlagsHidden({ hidden: true })(state)).toBeUndefined();
    });
});

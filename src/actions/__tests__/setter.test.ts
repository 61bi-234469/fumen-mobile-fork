import { Piece, Rotation } from '../../lib/enums';
import { setterActions } from '../setter';
import { HighlightType } from '../../state_types';

jest.mock('../../env', () => ({
    PageEnv: {
        Version: 'test',
        Debug: false,
    },
}));

jest.mock('../../actions', () => ({
    actions: {},
    main: {},
}));

const emptyField = () => Array.from({ length: 240 }, () => ({
    piece: Piece.Empty,
    highlight: HighlightType.Normal,
}));

describe('setField ghost rendering', () => {
    test('does not render a ghost for a completed COMP mino', () => {
        const inferences = [45, 55, 65, 75];
        const next = setterActions.setField({
            inferences,
            field: emptyField(),
            filledHighlight: false,
            ghost: true,
            allowSplit: true,
        })({} as any)!;
        const field = next.field!;

        inferences.forEach((index) => {
            expect(field[index]).toEqual({
                piece: Piece.I,
                highlight: HighlightType.Highlight2,
                markable: true,
            });
        });
        expect(field.some(block => block.highlight === HighlightType.Lighter)).toBe(false);
    });

    test('keeps the ghost for a spawned mino', () => {
        const next = setterActions.setField({
            field: emptyField(),
            move: {
                type: Piece.T,
                rotation: Rotation.Spawn,
                coordinate: { x: 4, y: 5 },
            },
            filledHighlight: false,
            ghost: true,
            inferences: [],
            allowSplit: false,
        })({} as any)!;
        const field = next.field!;

        expect(field.some(block => block.highlight === HighlightType.Lighter)).toBe(true);
    });
});

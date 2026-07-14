import { ModeTypes, Piece, Rotation, TouchTypes } from '../../lib/enums';
import { State } from '../../states';

jest.mock('../../actions', () => ({
    actions: {
        removeUnsettledItems: () => () => undefined,
        cancelRectSelectionPreview: () => () => undefined,
        convertToBlack: () => () => undefined,
        clearFieldAndPiece: () => () => undefined,
        convertToGray: () => () => undefined,
        spawnPiece: () => () => undefined,
    },
}));

// tslint:disable-next-line:no-var-requires
const { editorInteractionActions } = require('../editor_interaction');

const createState = (): State => ({
    mode: {
        type: ModeTypes.DrawingTool,
        touch: TouchTypes.Drawing,
        piece: undefined,
        rotationSystem: 'srs',
    },
    editorUi: {
        primaryTool: 'paint',
        paintTool: 'pen',
        pieceAction: 'spawn',
        inspector: 'none',
        paletteSelection: 'comp',
        lastMino: Piece.T,
        compactPanel: 'comment',
    },
    fumen: {
        currentIndex: 0,
        pages: [{ index: 0 }],
    },
} as State);

const apply = (state: State, action: (state: State) => Partial<State> | undefined): State => {
    const next = action(state);
    return next === undefined ? state : { ...state, ...next } as State;
};

describe('editorInteractionActions', () => {
    test('opens an inspector without changing the active tool or legacy touch mode', () => {
        const state = createState();
        state.mode.type = ModeTypes.Piece;
        state.mode.touch = TouchTypes.MovePiece;
        state.editorUi.primaryTool = 'piece';

        const next = apply(state, editorInteractionActions.openEditorInspector({ inspector: 'utils' }));

        expect(next.editorUi.inspector).toBe('utils');
        expect(next.editorUi.primaryTool).toBe('piece');
        expect(next.mode.type).toBe(ModeTypes.Piece);
        expect(next.mode.touch).toBe(TouchTypes.MovePiece);
    });

    test('maps paint subtools to the existing mode and touch state', () => {
        const state = createState();
        state.editorUi.inspector = 'flags';

        const next = apply(state, editorInteractionActions.changePaintTool({ tool: 'fillRow' }));

        expect(next.editorUi.primaryTool).toBe('paint');
        expect(next.editorUi.paintTool).toBe('fillRow');
        expect(next.editorUi.inspector).toBe('none');
        expect(next.mode.type).toBe(ModeTypes.FillRow);
        expect(next.mode.touch).toBe(TouchTypes.FillRow);
    });

    test('palette selection returns to paint while retaining paintTool and lastMino', () => {
        const state = createState();
        state.editorUi.primaryTool = 'piece';
        state.editorUi.paintTool = 'fill';
        state.editorUi.lastMino = Piece.L;

        const next = apply(state, editorInteractionActions.selectEditorPalette({ selection: Piece.Gray }));

        expect(next.editorUi.primaryTool).toBe('paint');
        expect(next.editorUi.paintTool).toBe('fill');
        expect(next.editorUi.paletteSelection).toBe(Piece.Gray);
        expect(next.editorUi.lastMino).toBe(Piece.L);
        expect(next.mode.type).toBe(ModeTypes.Fill);
        expect(next.mode.touch).toBe(TouchTypes.Fill);
        expect(next.mode.piece).toBe(Piece.Gray);
    });

    test('piece mode chooses drag only when the current page already has a piece', () => {
        const state = createState();
        const spawn = apply(state, editorInteractionActions.changePrimaryTool({ tool: 'piece' }));
        expect(spawn.editorUi.pieceAction).toBe('spawn');
        expect(spawn.mode.touch).toBe(TouchTypes.Piece);

        state.fumen.pages[0].piece = {
            type: Piece.T,
            rotation: Rotation.Spawn,
            coordinate: { x: 4, y: 20 },
        };
        const drag = apply(state, editorInteractionActions.changePrimaryTool({ tool: 'piece' }));
        expect(drag.editorUi.pieceAction).toBe('drag');
        expect(drag.mode.touch).toBe(TouchTypes.MovePiece);
    });
});

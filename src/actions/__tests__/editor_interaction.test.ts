import { ModeTypes, Piece, Rotation, TouchTypes } from '../../lib/enums';
import { State } from '../../states';

jest.mock('../../actions', () => ({
    actions: {
        removeUnsettledItems: () => () => undefined,
        cancelRectSelectionPreview: () => () => undefined,
        convertToBlack: () => () => undefined,
        clearFieldAndPiece: () => () => undefined,
        clearPiece: () => () => undefined,
        resetPiece: () => () => undefined,
        convertToGray: () => () => undefined,
        spawnPiece: () => () => undefined,
        toggleInfinitePieceQueue: () => () => undefined,
        toggleBlackTransparentPaste: () => (state: State) => ({
            parts: { ...state.parts, blackTransparent: false },
        }),
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
        infinitePieceQueue: false,
        bottomSlot: 'tray',
    },
    fumen: {
        currentIndex: 0,
        pages: [{ index: 0 }],
    },
    rectSelect: {
        status: 'none', rect: null, anchorIndex: null, floating: null,
    },
    parts: { items: [], selectedId: null, blackTransparent: true },
} as unknown as State);

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
        state.editorUi.primaryTool = 'paint';
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

    test('paint pen restores the previous palette after erasing', () => {
        const state = createState();
        const colored = apply(state, editorInteractionActions.selectEditorPalette({ selection: Piece.T }));
        const erased = apply(colored, editorInteractionActions.selectEditorPalette({ selection: Piece.Empty }));

        expect(erased.editorUi.paletteSelection).toBe(Piece.Empty);
        expect(erased.editorUi.previousPaletteSelection).toBe(Piece.T);

        const restored = apply(erased, editorInteractionActions.changePaintTool({
            tool: 'pen', restorePalette: true,
        }));
        expect(restored.editorUi.paletteSelection).toBe(Piece.T);
        expect(restored.mode.piece).toBe(Piece.T);
    });

    test('paint pen falls back to comp when no previous palette exists', () => {
        const state = createState();
        state.editorUi.paletteSelection = Piece.Empty;

        const restored = apply(state, editorInteractionActions.changePaintTool({
            tool: 'pen', restorePalette: true,
        }));

        expect(restored.editorUi.paletteSelection).toBe('comp');
        expect(restored.mode.piece).toBeUndefined();
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

    test('clicking a mino palette entry keeps PIECE mode active', () => {
        const state = createState();
        state.editorUi.primaryTool = 'piece';

        const next = apply(state, editorInteractionActions.selectEditorPalette({ selection: Piece.T }));

        expect(next.editorUi.primaryTool).toBe('piece');
        expect(next.editorUi.paletteSelection).toBe(Piece.T);
        expect(next.editorUi.lastMino).toBe(Piece.T);
        expect(next.editorUi.pieceAction).toBe('spawn');
        expect(next.mode.type).toBe(ModeTypes.Piece);
        expect(next.mode.touch).toBe(TouchTypes.Piece);
    });

    test('pressing the active tool button again toggles the tray closed, then open', () => {
        const state = createState();
        state.editorUi.primaryTool = 'piece';
        state.editorUi.bottomSlot = 'tray';

        const closed = apply(state, editorInteractionActions.changePrimaryTool({ tool: 'piece' }));
        expect(closed.editorUi.primaryTool).toBe('piece');
        expect(closed.editorUi.bottomSlot).toBe('sentLine');

        const reopened = apply(closed, editorInteractionActions.changePrimaryTool({ tool: 'piece' }));
        expect(reopened.editorUi.bottomSlot).toBe('tray');
    });

    test('switching to a different tool always shows the tray, even if it was hidden', () => {
        const state = createState();
        state.editorUi.primaryTool = 'piece';
        state.editorUi.bottomSlot = 'sentLine';

        const next = apply(state, editorInteractionActions.changePrimaryTool({ tool: 'select' }));
        expect(next.editorUi.primaryTool).toBe('select');
        expect(next.editorUi.bottomSlot).toBe('tray');
    });

    test('leaving SELECT clears both the selection rectangle and active part', () => {
        const state = createState();
        state.editorUi.primaryTool = 'select';
        state.rectSelect = {
            status: 'selected',
            rect: { minX: 1, minY: 1, maxX: 2, maxY: 2 },
            anchorIndex: null,
            floating: null,
        };
        state.parts.selectedId = 'part';

        const next = apply(state, editorInteractionActions.changePrimaryTool({ tool: 'paint' }));

        expect(next.rectSelect.status).toBe('none');
        expect(next.parts.selectedId).toBeNull();
    });

    test('pressing the active part slot again does nothing while it is floating', () => {
        const state = createState();
        state.editorUi.primaryTool = 'select';
        state.parts = {
            items: [{
                id: 'part', slot: Piece.T, width: 1, height: 1, cells: [Piece.T], pinned: false, createdAt: 1,
            }],
            selectedId: 'part',
            blackTransparent: true,
        };
        state.rectSelect = {
            status: 'floating',
            rect: null,
            anchorIndex: null,
            floating: {
                cells: [Piece.T], width: 1, height: 1, sourceRect: null,
                targetX: 4, targetY: 22, pointerOffsetX: 0, pointerOffsetY: 0,
            },
        };

        const next = editorInteractionActions.selectEditorPalette({ selection: Piece.T })(state);

        expect(next).toBeUndefined();
    });

    test('transparency changes keep the floating selection preview active', () => {
        const state = createState();
        state.editorUi.primaryTool = 'select';
        state.rectSelect = {
            status: 'floating',
            rect: { minX: 1, minY: 1, maxX: 2, maxY: 2 },
            anchorIndex: null,
            floating: {
                cells: [Piece.Empty, Piece.T, Piece.Empty, Piece.Empty],
                width: 2,
                height: 2,
                sourceRect: { minX: 1, minY: 1, maxX: 2, maxY: 2 },
                targetX: 4,
                targetY: 4,
                pointerOffsetX: 0,
                pointerOffsetY: 0,
            },
        };

        const next = apply(state, editorInteractionActions.selectEditorPalette({ selection: 'comp' }));

        expect(next.rectSelect.status).toBe('floating');
        expect(next.parts.blackTransparent).toBe(false);
        expect(next.editorUi.paletteSelection).toBe('comp');
    });

    test('pressing PAINT while in Slide/Comment mode returns to the paint tray instead of toggling it closed', () => {
        const state = createState();
        state.mode.type = ModeTypes.Slide;
        state.editorUi.primaryTool = 'paint';
        state.editorUi.bottomSlot = 'tray';

        const next = apply(state, editorInteractionActions.changePrimaryTool({ tool: 'paint' }));
        expect(next.editorUi.bottomSlot).toBe('tray');
        expect(next.mode.type).not.toBe(ModeTypes.Slide);
    });
});

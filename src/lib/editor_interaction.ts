import { ModeTypes, parsePieceName, Piece, TouchTypes } from './enums';
import {
    EditorInspector,
    PaintTool,
    PaletteSelection,
    PieceAction,
    PrimaryTool,
    State,
} from '../states';

export const getPrimaryTool = (state: State): PrimaryTool => state.editorUi.primaryTool;
export const getPaintTool = (state: State): PaintTool => state.editorUi.paintTool;
export const getPieceAction = (state: State): PieceAction => state.editorUi.pieceAction;
export const getInspector = (state: State): EditorInspector => state.editorUi.inspector;
export const getPaletteSelection = (state: State): PaletteSelection => state.editorUi.paletteSelection;

// ツールやパレットの切り替えは通常インスペクタを閉じるが、「UTILSメニューを開いたままにする」設定の
// ときは UTILS だけ残す。並行して通常操作するための設定なので、操作のたびに閉じては意味がないため。
export const inspectorAfterToolChange = (state: State): EditorInspector => (
    state.mode.utilsMenuPinned && state.editorUi.inspector === 'utils' ? 'utils' : 'none'
);

export const legacyModeForPaintTool = (paintTool: PaintTool): { type: ModeTypes; touch: TouchTypes } => {
    switch (paintTool) {
    case 'fill':
        return { type: ModeTypes.Fill, touch: TouchTypes.Fill };
    case 'fillRow':
        return { type: ModeTypes.FillRow, touch: TouchTypes.FillRow };
    default:
        return { type: ModeTypes.DrawingTool, touch: TouchTypes.Drawing };
    }
};

export const isMinoPaletteSelection = (
    selection: PaletteSelection,
): selection is Piece.I | Piece.L | Piece.O | Piece.Z | Piece.T | Piece.J | Piece.S => (
    selection !== 'comp' && selection !== Piece.Empty && selection !== Piece.Gray
);

export const paletteMinoImageSrc = (piece: Piece, guideLineColor: boolean): string => {
    const name = parsePieceName(piece) ?? '';
    return guideLineColor ? `img/${name}.svg` : `img/${name}_classic.svg`;
};

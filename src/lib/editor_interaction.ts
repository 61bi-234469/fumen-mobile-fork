import { isMinoPiece, ModeTypes, parsePieceName, Piece, TouchTypes } from './enums';
import {
    EditorInspector,
    PaintTool,
    PaletteSelection,
    PieceAction,
    PrimaryTool,
    State,
} from '../states';
import { PageFieldOperation, Pages } from './pages';
import { hasAnyLiftableMino } from './spawn_mino_convert';

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

// SPAWNミノ⇄ペイント トグルボタンの表示方向。押す前に行き先が分かるようにするための表示専用の判定で、
// 実際の変換対象は toggleSpawnMinoAndBlocks 側の決定木が決める。
// 'to-paint' はSPAWNミノをブロックへ、'to-mino' はブロックをSPAWNミノへ、
// 'pick' は対象選択待ち、'none' は対象なし（disabled）。
export type SpawnMinoToggleDirection = 'to-paint' | 'to-mino' | 'pick' | 'none';

export const spawnMinoToggleDirection = (state: State): SpawnMinoToggleDirection => {
    if (state.editorUi.spawnMinoToggle.pickArmed) {
        return 'pick';
    }

    const pageIndex = state.fumen.currentIndex;
    const page = state.fumen.pages[pageIndex];
    if (page === undefined) {
        return 'none';
    }
    if (page.piece !== undefined && isMinoPiece(page.piece.type)) {
        return 'to-paint';
    }

    const rawField = new Pages(state.fumen.pages).getField(pageIndex, PageFieldOperation.Command);
    return hasAnyLiftableMino(rawField) ? 'to-mino' : 'none';
};

export const paletteMinoImageSrc = (piece: Piece, guideLineColor: boolean): string => {
    const name = parsePieceName(piece) ?? '';
    return guideLineColor ? `img/${name}.svg` : `img/${name}_classic.svg`;
};
